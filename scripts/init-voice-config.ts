import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const systemPrompt = `You are Sarah, a professional and empathetic AI receptionist for LockSafe, a UK-based anti-fraud locksmith marketplace. Your role is to handle customer inquiries with care, especially during stressful emergency situations. You should: 1) Identify if it's an emergency (lockout) or scheduled service, 2) Collect location (UK postcode), service type, and contact details, 3) For emergencies: dispatch immediately to nearest locksmith, 4) For appointments: check availability and book, 5) Answer questions about pricing, service areas, and locksmith verification, 6) Speak naturally in British English, 7) Be calm and reassuring for stressed customers, 8) Escalate complex issues to human support.`;

const greetingMessage = `Hello! Thank you for calling LockSafe, the UK's trusted anti-fraud locksmith service. I'm Sarah, your AI assistant. I'm here to help you 24/7 with emergency lockouts, lock installations, rekeying, and security consultations. How can I assist you today?`;

async function main() {
  // Check if config already exists
  const existing = await prisma.voiceAgentConfig.findFirst({
    where: { isActive: true }
  });

  if (existing) {
    console.log('✅ VoiceAgentConfig already exists:');
    console.log(`   ID: ${existing.id}`);
    console.log(`   Name: ${existing.name}`);
    console.log(`   Active: ${existing.isActive}`);
    console.log(`   Language: ${existing.language}`);
    return existing;
  }

  // Insert initial config
  const config = await prisma.voiceAgentConfig.create({
    data: {
      name: "default",
      isActive: true,
      systemPrompt,
      greetingMessage,
      fallbackMessage: "I'm sorry, I didn't quite catch that. Could you please repeat?",
      language: "en-GB",
      speakingRate: 1.0,
      maxCallDuration: 600,
      silenceTimeout: 10,
      enableRecording: true,
      businessHoursStart: "00:00",
      businessHoursEnd: "23:59",
      afterHoursMessage: "Thank you for calling LockSafe. Our lines are currently closed, but we're available 24/7 for emergencies. Please call back or leave a message.",
      enableDispatch: true,
      enableBooking: true,
      enableFAQ: true,
      enableEscalation: true,
      isPaused: false,
      blockedNumbers: [],
    }
  });

  console.log('✅ VoiceAgentConfig created successfully:');
  console.log(`   ID: ${config.id}`);
  console.log(`   Name: ${config.name}`);
  console.log(`   Active: ${config.isActive}`);
  console.log(`   Language: ${config.language}`);
  console.log(`   Max Call Duration: ${config.maxCallDuration}s`);
  console.log(`   Business Hours: ${config.businessHoursStart} - ${config.businessHoursEnd}`);
  console.log(`   Features: dispatch=${config.enableDispatch}, booking=${config.enableBooking}, FAQ=${config.enableFAQ}, escalation=${config.enableEscalation}`);
  return config;
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
