/**
 * WhatsApp Job Request Flow for LockSafe UK
 *
 * Mirrors the Bland AI voice pathway for job creation:
 * 1. Collect customer info (name, phone, email)
 * 2. Check/create account
 * 3. Collect address and service details
 * 4. Create job in database
 * 5. Send dashboard link
 *
 * Uses OpenClaw NLP for natural language understanding.
 */

import prisma from "@/lib/db";
import { processNaturalLanguageQuery } from "@/lib/openclaw-nlp";
import {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  getSession,
  updateSession,
  type CustomerSession,
} from "@/lib/whatsapp-business";
import {
  checkOrCreateCustomer,
  createJob as createJobInDb,
  sendJobNotifications,
} from "@/lib/customer-service";

// Check if OpenAI is configured
const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;

// ============================================
// JOB REQUEST SESSION STATE
// ============================================

export interface JobRequestSession {
  step: JobRequestStep;
  data: Partial<JobRequestData>;
  lastPromptAt: Date;
  retryCount: number;
}

export type JobRequestStep =
  | "idle"
  | "ask_name"
  | "ask_email"
  | "confirm_email"
  | "ask_postcode"
  | "ask_street"
  | "ask_house_number"
  | "confirm_address"
  | "ask_problem"
  | "ask_property_type"
  | "creating_account"
  | "creating_job"
  | "job_created"
  | "completed";

export interface JobRequestData {
  customerName: string;
  phone: string;
  email: string;
  postcode: string;
  streetName: string;
  houseNumber: string;
  fullAddress: string;
  problemType: string;
  propertyType: string;
  description: string;
  customerId?: string;
  jobId?: string;
  jobNumber?: string;
  continueUrl?: string;
  isNewAccount?: boolean;
}

// In-memory job request sessions (use Redis in production)
const jobRequestSessions = new Map<string, JobRequestSession>();

// ============================================
// SESSION MANAGEMENT
// ============================================

export function getJobRequestSession(phone: string): JobRequestSession {
  let session = jobRequestSessions.get(phone);

  if (!session) {
    session = {
      step: "idle",
      data: { phone },
      lastPromptAt: new Date(),
      retryCount: 0,
    };
    jobRequestSessions.set(phone, session);
  }

  return session;
}

export function updateJobRequestSession(
  phone: string,
  updates: Partial<JobRequestSession>
): JobRequestSession {
  const session = getJobRequestSession(phone);
  Object.assign(session, updates);
  session.lastPromptAt = new Date();
  jobRequestSessions.set(phone, session);
  return session;
}

export function resetJobRequestSession(phone: string): void {
  jobRequestSessions.delete(phone);
}

// ============================================
// START JOB REQUEST FLOW
// ============================================

/**
 * Start the job request flow
 */
export async function startJobRequest(phone: string, customerName?: string): Promise<void> {
  const session = getJobRequestSession(phone);

  // Check if customer already exists
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      phone: { contains: phone.slice(-10) },
    },
    select: { id: true, name: true, email: true },
  });

  if (existingCustomer && existingCustomer.email) {
    // Existing customer with email - pre-fill data
    session.data = {
      phone,
      customerName: existingCustomer.name,
      email: existingCustomer.email,
      customerId: existingCustomer.id,
    };
    session.step = "ask_postcode";
    updateJobRequestSession(phone, session);

    await sendTextMessage(
      phone,
      `👋 Welcome back, ${existingCustomer.name}!\n\n` +
      `I'll help you request an emergency locksmith.\n\n` +
      `Let's start with the location. *What's the postcode* where you need the locksmith?`
    );
  } else {
    // New customer
    session.data = { phone };

    if (customerName) {
      session.data.customerName = customerName;
      session.step = "ask_email";
      updateJobRequestSession(phone, session);

      await sendTextMessage(
        phone,
        `Thanks ${customerName}! 👋\n\n` +
        `I need your *email address* to create your account. ` +
        `This is where you'll receive quotes from locksmiths and manage your request.\n\n` +
        `Please type your email address:`
      );
    } else {
      session.step = "ask_name";
      updateJobRequestSession(phone, session);

      await sendTextMessage(
        phone,
        `🔧 *LockSafe UK Emergency Locksmith*\n\n` +
        `I'll help you request a locksmith. First, *what's your name?*`
      );
    }
  }
}

// ============================================
// PROCESS USER RESPONSE
// ============================================

/**
 * Process a response in the job request flow
 */
export async function processJobRequestResponse(
  phone: string,
  message: string,
  buttonId?: string
): Promise<boolean> {
  const session = getJobRequestSession(phone);

  // Check if we're in an active job request flow
  if (session.step === "idle" || session.step === "completed") {
    return false; // Not in job request flow
  }

  const lowerMessage = message.toLowerCase().trim();

  // Handle cancel at any point
  if (lowerMessage === "cancel" || lowerMessage === "stop" || buttonId === "cancel_request") {
    resetJobRequestSession(phone);
    await sendButtonMessage(
      phone,
      "❌ Job request cancelled.\n\nIf you change your mind, just say *\"I need a locksmith\"* to start again.",
      [
        { id: "start_request", title: "🔧 Request Locksmith" },
        { id: "track_job", title: "📍 Track Existing Job" },
      ]
    );
    return true;
  }

  // Process based on current step
  switch (session.step) {
    case "ask_name":
      return await handleNameResponse(phone, message, session);

    case "ask_email":
      return await handleEmailResponse(phone, message, session);

    case "confirm_email":
      return await handleEmailConfirmation(phone, message, buttonId, session);

    case "ask_postcode":
      return await handlePostcodeResponse(phone, message, session);

    case "ask_street":
      return await handleStreetResponse(phone, message, session);

    case "ask_house_number":
      return await handleHouseNumberResponse(phone, message, session);

    case "confirm_address":
      return await handleAddressConfirmation(phone, message, buttonId, session);

    case "ask_problem":
      return await handleProblemResponse(phone, message, buttonId, session);

    case "ask_property_type":
      return await handlePropertyTypeResponse(phone, message, buttonId, session);

    case "creating_account":
    case "creating_job":
      await sendTextMessage(phone, "⏳ Please wait, I'm processing your request...");
      return true;

    case "job_created":
      return await handlePostJobQuestion(phone, message, session);

    default:
      return false;
  }
}

// ============================================
// STEP HANDLERS
// ============================================

async function handleNameResponse(
  phone: string,
  message: string,
  session: JobRequestSession
): Promise<boolean> {
  // Extract name - use NLP if available
  let name = message.trim();

  // Basic cleanup
  name = name.replace(/^(my name is|i'm|i am|it's|this is)\s+/i, "");
  name = name.replace(/[^\w\s'-]/g, ""); // Remove special chars except hyphen/apostrophe

  if (name.length < 2 || name.length > 50) {
    session.retryCount++;
    if (session.retryCount >= 3) {
      await sendTextMessage(phone, "Let's try again. Just type your first name:");
    } else {
      await sendTextMessage(phone, "Please enter your name (e.g., \"John\" or \"Sarah\"):");
    }
    return true;
  }

  // Capitalize properly
  name = name.split(" ").map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(" ");

  session.data.customerName = name;
  session.step = "ask_email";
  session.retryCount = 0;
  updateJobRequestSession(phone, session);

  await sendTextMessage(
    phone,
    `Thanks ${name}! 👋\n\n` +
    `Now I need your *email address*. This is required to:\n` +
    `• Create your account\n` +
    `• Receive locksmith quotes\n` +
    `• Access your dashboard\n\n` +
    `Please type your email address:`
  );

  return true;
}

async function handleEmailResponse(
  phone: string,
  message: string,
  session: JobRequestSession
): Promise<boolean> {
  const email = message.trim().toLowerCase();

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    session.retryCount++;

    if (session.retryCount >= 3) {
      await sendButtonMessage(
        phone,
        "I'm having trouble with that email. Would you like to try a different one, or speak to an agent?",
        [
          { id: "retry_email", title: "🔄 Try Again" },
          { id: "speak_human", title: "💬 Speak to Agent" },
        ]
      );
    } else {
      await sendTextMessage(
        phone,
        `That doesn't look like a valid email address.\n\n` +
        `Please enter a valid email (e.g., yourname@gmail.com):`
      );
    }
    return true;
  }

  session.data.email = email;
  session.step = "confirm_email";
  session.retryCount = 0;
  updateJobRequestSession(phone, session);

  await sendButtonMessage(
    phone,
    `📧 Please confirm your email:\n\n*${email}*\n\nIs this correct?`,
    [
      { id: "email_correct", title: "✅ Yes, correct" },
      { id: "email_wrong", title: "❌ No, change it" },
    ]
  );

  return true;
}

async function handleEmailConfirmation(
  phone: string,
  message: string,
  buttonId: string | undefined,
  session: JobRequestSession
): Promise<boolean> {
  const isCorrect = buttonId === "email_correct" ||
    message.toLowerCase().includes("yes") ||
    message.toLowerCase().includes("correct");

  if (!isCorrect) {
    session.step = "ask_email";
    updateJobRequestSession(phone, session);

    await sendTextMessage(phone, "No problem! Please type your correct email address:");
    return true;
  }

  // Email confirmed - check/create account
  session.step = "creating_account";
  updateJobRequestSession(phone, session);

  await sendTextMessage(phone, "✅ Great! Let me check our system...");

  try {
    const result = await checkOrCreateAccount(session.data as JobRequestData);

    session.data.customerId = result.customerId;
    session.data.isNewAccount = result.isNew;
    session.step = "ask_postcode";
    updateJobRequestSession(phone, session);

    if (result.isNew) {
      await sendTextMessage(
        phone,
        `✅ I've created your account!\n\n` +
        `After we create your job, you'll receive an email with a link to set your password and access your dashboard.\n\n` +
        `Now, *what's the postcode* where you need the locksmith?`
      );
    } else {
      await sendTextMessage(
        phone,
        `✅ Found your account!\n\n` +
        `Now, *what's the postcode* where you need the locksmith?`
      );
    }
  } catch (error) {
    console.error("[WhatsApp Job] Account creation error:", error);
    await sendTextMessage(
      phone,
      "Sorry, I had trouble accessing our system. Please try again or visit locksafe.uk"
    );
    resetJobRequestSession(phone);
  }

  return true;
}

async function handlePostcodeResponse(
  phone: string,
  message: string,
  session: JobRequestSession
): Promise<boolean> {
  // UK postcode regex
  const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const postcode = message.trim().toUpperCase().replace(/\s+/g, " ");

  if (!postcodeRegex.test(postcode.replace(/\s/g, ""))) {
    session.retryCount++;

    if (session.retryCount >= 3) {
      await sendTextMessage(
        phone,
        "That doesn't look like a UK postcode.\n\n" +
        "Please enter the full postcode (e.g., SW1A 1AA or M1 1AA):"
      );
    } else {
      await sendTextMessage(
        phone,
        "Please enter a valid UK postcode (e.g., SW1A 1AA):"
      );
    }
    return true;
  }

  // Format postcode with space
  const formattedPostcode = postcode.replace(/^(.+?)(\d[A-Z]{2})$/i, "$1 $2");

  session.data.postcode = formattedPostcode;
  session.step = "ask_street";
  session.retryCount = 0;
  updateJobRequestSession(phone, session);

  await sendTextMessage(
    phone,
    `📍 Postcode: *${formattedPostcode}*\n\n` +
    `What's the *street name*?`
  );

  return true;
}

async function handleStreetResponse(
  phone: string,
  message: string,
  session: JobRequestSession
): Promise<boolean> {
  let streetName = message.trim();

  // Remove common prefixes people might add
  streetName = streetName.replace(/^(it's|its|on|at|called)\s+/i, "");

  if (streetName.length < 2 || streetName.length > 100) {
    await sendTextMessage(phone, "Please enter the street name (e.g., \"High Street\" or \"Oak Lane\"):");
    return true;
  }

  // Capitalize properly
  streetName = streetName.split(" ").map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(" ");

  session.data.streetName = streetName;
  session.step = "ask_house_number";
  updateJobRequestSession(phone, session);

  await sendTextMessage(
    phone,
    `📍 ${streetName}\n\n` +
    `What's the *house number* or building name?`
  );

  return true;
}

async function handleHouseNumberResponse(
  phone: string,
  message: string,
  session: JobRequestSession
): Promise<boolean> {
  let houseNumber = message.trim();

  // Remove common prefixes
  houseNumber = houseNumber.replace(/^(it's|its|number|no\.?|#)\s*/i, "");

  if (houseNumber.length < 1 || houseNumber.length > 50) {
    await sendTextMessage(phone, "Please enter the house number or building name:");
    return true;
  }

  session.data.houseNumber = houseNumber;
  session.data.fullAddress = `${houseNumber} ${session.data.streetName}`;
  session.step = "confirm_address";
  updateJobRequestSession(phone, session);

  await sendButtonMessage(
    phone,
    `📍 *Confirm Address*\n\n` +
    `${houseNumber} ${session.data.streetName}\n` +
    `${session.data.postcode}\n\n` +
    `Is this correct?`,
    [
      { id: "address_correct", title: "✅ Yes, correct" },
      { id: "address_wrong", title: "❌ No, change it" },
    ]
  );

  return true;
}

async function handleAddressConfirmation(
  phone: string,
  message: string,
  buttonId: string | undefined,
  session: JobRequestSession
): Promise<boolean> {
  const isCorrect = buttonId === "address_correct" ||
    message.toLowerCase().includes("yes") ||
    message.toLowerCase().includes("correct");

  if (!isCorrect) {
    session.step = "ask_postcode";
    updateJobRequestSession(phone, session);

    await sendTextMessage(phone, "No problem! Let's start again.\n\n*What's the postcode?*");
    return true;
  }

  session.step = "ask_problem";
  updateJobRequestSession(phone, session);

  await sendListMessage(
    phone,
    `Great! Now tell me *what's happened?*\n\n` +
    `Select the option that best describes your situation:`,
    "Select Problem",
    [
      {
        title: "Emergency",
        rows: [
          { id: "prob_locked_out", title: "🚪 Locked Out", description: "Can't get into property" },
          { id: "prob_burglary", title: "🚨 Burglary Damage", description: "Break-in, need security" },
        ],
      },
      {
        title: "Lock Issues",
        rows: [
          { id: "prob_broken_lock", title: "🔓 Broken Lock", description: "Lock not working properly" },
          { id: "prob_key_stuck", title: "🔑 Key Stuck/Broken", description: "Key stuck or snapped" },
          { id: "prob_lost_keys", title: "🗝️ Lost Keys", description: "Lost all keys" },
        ],
      },
      {
        title: "Other",
        rows: [
          { id: "prob_lock_change", title: "🔄 Lock Change", description: "Want to change locks" },
          { id: "prob_other", title: "❓ Something Else", description: "Other locksmith need" },
        ],
      },
    ]
  );

  return true;
}

async function handleProblemResponse(
  phone: string,
  message: string,
  buttonId: string | undefined,
  session: JobRequestSession
): Promise<boolean> {
  // Map button IDs to problem types
  const problemMap: Record<string, { type: string; label: string }> = {
    prob_locked_out: { type: "locked_out", label: "Locked Out" },
    prob_burglary: { type: "burglary", label: "Burglary/Break-in" },
    prob_broken_lock: { type: "broken_lock", label: "Broken Lock" },
    prob_key_stuck: { type: "key_stuck", label: "Key Stuck/Broken" },
    prob_lost_keys: { type: "lost_keys", label: "Lost Keys" },
    prob_lock_change: { type: "lock_change", label: "Lock Change" },
    prob_other: { type: "other", label: "Other" },
  };

  let problem = problemMap[buttonId || ""];

  // Try to understand from text if no button was pressed
  if (!problem) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("locked out") || lowerMessage.includes("cant get in") || lowerMessage.includes("can't get in")) {
      problem = problemMap.prob_locked_out;
    } else if (lowerMessage.includes("burglar") || lowerMessage.includes("break in") || lowerMessage.includes("broken into")) {
      problem = problemMap.prob_burglary;
    } else if (lowerMessage.includes("broken") || lowerMessage.includes("not working") || lowerMessage.includes("damaged")) {
      problem = problemMap.prob_broken_lock;
    } else if (lowerMessage.includes("stuck") || lowerMessage.includes("snapped") || lowerMessage.includes("key broke")) {
      problem = problemMap.prob_key_stuck;
    } else if (lowerMessage.includes("lost") || lowerMessage.includes("no keys")) {
      problem = problemMap.prob_lost_keys;
    } else if (lowerMessage.includes("change") || lowerMessage.includes("replace") || lowerMessage.includes("new lock")) {
      problem = problemMap.prob_lock_change;
    } else {
      // Use NLP to understand
      if (OPENAI_ENABLED) {
        const nlpResult = await processNaturalLanguageQuery(message, "customer");
        // Store the description even if we can't categorize it
        session.data.description = message;
        problem = { type: "other", label: "Other" };
      } else {
        problem = { type: "other", label: "Other" };
        session.data.description = message;
      }
    }
  }

  session.data.problemType = problem.type;
  if (!session.data.description) {
    session.data.description = problem.label;
  }
  session.step = "ask_property_type";
  updateJobRequestSession(phone, session);

  await sendButtonMessage(
    phone,
    `Got it: *${problem.label}*\n\n` +
    `What type of property is this?`,
    [
      { id: "prop_house", title: "🏠 House" },
      { id: "prop_flat", title: "🏢 Flat/Apartment" },
      { id: "prop_commercial", title: "🏪 Business" },
    ]
  );

  // Also offer car option
  await sendButtonMessage(
    phone,
    "Or is it a vehicle?",
    [
      { id: "prop_car", title: "🚗 Car/Vehicle" },
    ]
  );

  return true;
}

async function handlePropertyTypeResponse(
  phone: string,
  message: string,
  buttonId: string | undefined,
  session: JobRequestSession
): Promise<boolean> {
  const propertyMap: Record<string, string> = {
    prop_house: "house",
    prop_flat: "flat",
    prop_commercial: "commercial",
    prop_car: "car",
  };

  let propertyType = propertyMap[buttonId || ""];

  // Try to understand from text
  if (!propertyType) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("house") || lowerMessage.includes("home")) {
      propertyType = "house";
    } else if (lowerMessage.includes("flat") || lowerMessage.includes("apartment")) {
      propertyType = "flat";
    } else if (lowerMessage.includes("business") || lowerMessage.includes("shop") || lowerMessage.includes("office") || lowerMessage.includes("commercial")) {
      propertyType = "commercial";
    } else if (lowerMessage.includes("car") || lowerMessage.includes("vehicle") || lowerMessage.includes("van")) {
      propertyType = "car";
    } else {
      propertyType = "house"; // Default
    }
  }

  session.data.propertyType = propertyType;
  session.step = "creating_job";
  updateJobRequestSession(phone, session);

  await sendTextMessage(
    phone,
    `✅ Got it!\n\n` +
    `📋 *Creating your job request...*\n\n` +
    `• ${session.data.problemType?.replace(/_/g, " ").toUpperCase()}\n` +
    `• ${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)}\n` +
    `• ${session.data.fullAddress}, ${session.data.postcode}\n\n` +
    `Please wait...`
  );

  // Create the job
  try {
    const jobResult = await createJobForWhatsApp(session.data as JobRequestData);

    session.data.jobId = jobResult.jobId;
    session.data.jobNumber = jobResult.jobNumber;
    session.data.continueUrl = jobResult.continueUrl;
    session.step = "job_created";
    updateJobRequestSession(phone, session);

    // Send notifications
    await sendNotifications(session.data as JobRequestData);

    // Send success message
    await sendTextMessage(
      phone,
      `🎉 *Job Created Successfully!*\n\n` +
      `📋 Reference: *${jobResult.jobNumber}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*📱 WHAT HAPPENS NEXT:*\n\n` +
      `1️⃣ Check your email & SMS - you'll receive a link to your dashboard\n\n` +
      `2️⃣ ${session.data.isNewAccount ? "Set your password to log in\n\n3️⃣ " : ""}View quotes from local locksmiths (usually within minutes)\n\n` +
      `${session.data.isNewAccount ? "4️⃣" : "3️⃣"} Choose a locksmith and pay the assessment fee online (~£29)\n\n` +
      `${session.data.isNewAccount ? "5️⃣" : "4️⃣"} Your locksmith will then head to you!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚠️ *IMPORTANT:* No locksmith is dispatched yet - you must accept a quote on your dashboard first.`
    );

    await sendButtonMessage(
      phone,
      `Your dashboard link has been sent to:\n📱 ${session.data.phone}\n📧 ${session.data.email}\n\nHave questions?`,
      [
        { id: "explain_process", title: "❓ How does it work?" },
        { id: "done_thanks", title: "✅ Got it, thanks!" },
      ]
    );

  } catch (error) {
    console.error("[WhatsApp Job] Job creation error:", error);
    session.step = "ask_problem";
    updateJobRequestSession(phone, session);

    await sendTextMessage(
      phone,
      `❌ Sorry, I had trouble creating your job.\n\n` +
      `Please try again, or visit *locksafe.uk* to submit your request online.`
    );
  }

  return true;
}

async function handlePostJobQuestion(
  phone: string,
  message: string,
  session: JobRequestSession
): Promise<boolean> {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("how") || lowerMessage.includes("process") || lowerMessage.includes("work")) {
    await sendTextMessage(
      phone,
      `🔧 *How LockSafe UK Works*\n\n` +
      `1. You've just created a job request in our system\n\n` +
      `2. Local locksmiths will see your job and send quotes with:\n` +
      `   • Their price\n` +
      `   • How quickly they can arrive\n\n` +
      `3. You choose which quote to accept on your dashboard\n\n` +
      `4. You pay the assessment fee online (~£29)\n\n` +
      `5. ONLY THEN does the locksmith head to you\n\n` +
      `6. They diagnose the problem and give you a full quote\n\n` +
      `7. You can accept or decline - no obligation\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ All locksmiths are vetted, insured & DBS checked\n` +
      `💳 Card payment only via Stripe\n` +
      `📞 Support: support@locksafe.uk`
    );
    return true;
  }

  // Mark as completed
  session.step = "completed";
  updateJobRequestSession(phone, session);

  await sendTextMessage(
    phone,
    `✅ You're all set!\n\n` +
    `Your job reference: *${session.data.jobNumber}*\n\n` +
    `Check your phone and email for your dashboard link. Locksmiths will start sending quotes soon!\n\n` +
    `If you need anything else, just message us here. 👋`
  );

  // Clear session after a delay
  setTimeout(() => resetJobRequestSession(phone), 5 * 60 * 1000);

  return true;
}

// ============================================
// SERVICE CALLS (Using shared customer-service)
// ============================================

async function checkOrCreateAccount(data: JobRequestData): Promise<{
  customerId: string;
  isNew: boolean;
}> {
  const result = await checkOrCreateCustomer({
    email: data.email,
    phone: data.phone,
    name: data.customerName,
    source: "whatsapp",
  });

  return {
    customerId: result.customerId,
    isNew: result.isNew,
  };
}

async function createJobForWhatsApp(data: JobRequestData): Promise<{
  jobId: string;
  jobNumber: string;
  continueUrl: string;
}> {
  const result = await createJobInDb({
    customerId: data.customerId!,
    postcode: data.postcode,
    address: data.fullAddress,
    serviceType: data.problemType,
    propertyType: data.propertyType,
    description: data.description,
    source: "whatsapp",
  });

  return {
    jobId: result.jobId,
    jobNumber: result.jobNumber,
    continueUrl: result.continueUrl,
  };
}

async function sendNotifications(data: JobRequestData): Promise<void> {
  try {
    await sendJobNotifications({
      jobId: data.jobId!,
      customerId: data.customerId!,
      customerPhone: data.phone,
      customerEmail: data.email,
      customerName: data.customerName,
      jobNumber: data.jobNumber!,
      continueUrl: data.continueUrl!,
    });
  } catch (error) {
    console.error("[WhatsApp Job] Notification error:", error);
    // Don't throw - notifications are not critical
  }
}

// ============================================
// CHECK IF MESSAGE TRIGGERS JOB REQUEST
// ============================================

/**
 * Check if a message should trigger the job request flow
 */
export function shouldStartJobRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  const triggers = [
    "i need a locksmith",
    "need a locksmith",
    "locked out",
    "lock myself out",
    "locked myself out",
    "can't get in",
    "cant get in",
    "broken lock",
    "lost my keys",
    "lost keys",
    "emergency locksmith",
    "request locksmith",
    "book locksmith",
    "new request",
    "start request",
    "help me",
    "i'm locked out",
    "im locked out",
  ];

  return triggers.some(trigger => lowerMessage.includes(trigger));
}

/**
 * Check if user is in an active job request flow
 */
export function isInJobRequestFlow(phone: string): boolean {
  const session = getJobRequestSession(phone);
  return session.step !== "idle" && session.step !== "completed";
}
