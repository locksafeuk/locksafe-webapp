import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is LockSafe free for customers?",
    answer: "Yes, 100% free. There are no platform fees, booking fees, or hidden charges for customers. You simply pay the locksmith directly for their assessment and work. LockSafe makes money by charging locksmiths a commission (15% on assessment fees, 25% on work quotes) - you never pay us anything.",
  },
  {
    question: "What is the assessment fee?",
    answer: "When a locksmith applies for your job, they set their own assessment fee (typically £25-£49). This covers their travel to your location and time to diagnose the problem. You pay this directly to the locksmith to confirm the booking. Once on-site, the locksmith will provide a separate quote for the actual work. If you decline the work quote, you've only paid the assessment fee - no hidden charges.",
  },
  {
    question: "What if the locksmith doesn't arrive?",
    answer: "You're fully protected. If a locksmith accepts your job but fails to arrive within their agreed ETA (plus a 30-minute grace period), you can request and receive an automatic full refund of your assessment fee. No questions asked, no disputes. The locksmith's connected payment account is automatically debited - we don't use your refund money, they do.",
  },
  {
    question: "How do you verify your locksmiths?",
    answer: "Every locksmith on our platform goes through a rigorous verification process: DBS background check, proof of qualifications, insurance verification, and reference checks. We also continuously monitor ratings and investigate any complaints.",
  },
  {
    question: "What makes LockSafe different from other locksmith services?",
    answer: "Three things no competitor offers: (1) Automatic refund guarantee if the locksmith doesn't show up, (2) Legally-binding digital paper trail on every job, and (3) You see the full quote BEFORE work starts and can decline. We're the UK's first anti-fraud locksmith platform.",
  },
  {
    question: "How does the refund protection work?",
    answer: "When you pay the assessment fee, the money goes through our secure platform. If the locksmith doesn't arrive within their quoted ETA plus a 30-minute grace period, you can request a full refund. We refund you 100% of the assessment fee. The locksmith is charged the FULL amount (not just their share) because they failed to deliver. The platform keeps its commission since it successfully connected you. This policy keeps locksmiths accountable.",
  },
  {
    question: "How long does it take for a locksmith to arrive?",
    answer: "Our average response time is 15-30 minutes in urban areas. You'll see the exact ETA when a locksmith accepts your job. In rural areas, it may take slightly longer, but we always show you realistic estimates.",
  },
  {
    question: "What if I'm not happy with the work quote?",
    answer: "You have complete control. When the locksmith provides their on-site quote for the work, you can accept or decline. If you decline, you've only paid the assessment fee (which you paid upfront to confirm the booking) and the job is closed. There's no pressure and no hidden fees.",
  },
  {
    question: "How are locksmiths protected?",
    answer: "Locksmiths are protected too: (1) Customer's card is verified before you travel, (2) GPS tracking proves you arrived at the location, (3) Digital signature from customer confirms they approved the work, (4) Complete PDF documentation protects against false claims. Payment is guaranteed through our platform.",
  },
  {
    question: "Is the service available 24/7?",
    answer: "Yes, we have verified locksmiths available around the clock, 365 days a year. Emergency lockouts don't follow business hours, and neither do we. Pricing may vary for out-of-hours calls, but this is always shown upfront.",
  },
  {
    question: "What does the PDF report contain?",
    answer: "The legal PDF report includes: complete job timeline with timestamps, GPS location data, all photos taken (before/during/after), diagnostic details, itemised quote, your digital signature, locksmith details, and payment confirmation. It's your complete protection against disputes.",
  },
  {
    question: "Do you cover commercial properties?",
    answer: "Yes, we serve both residential and commercial properties across the UK. For businesses, we offer additional services like access control systems, master key systems, and emergency lockout support with SLA agreements.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit/debit cards, Apple Pay, Google Pay, and bank transfers. Payment is processed securely through our platform - the locksmith never handles your payment details directly.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-16 md:py-24 bg-white">
      <div className="section-container">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-full px-4 py-2 text-sm font-medium mb-4">
              FAQ
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
              Frequently Asked Questions
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={`faq-${index + 1}`}
                value={`item-${index}`}
                className="bg-white border border-slate-200 rounded-xl px-6 data-[state=open]:border-orange-300 data-[state=open]:shadow-sm"
              >
                <AccordionTrigger className="text-left font-semibold text-slate-900 hover:text-orange-600 hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="text-center mt-12">
            <p className="text-slate-600">
              Have more questions? Email us at{" "}
              <a
                href="mailto:contact@locksafe.uk"
                className="text-orange-600 hover:underline font-medium"
              >
                contact@locksafe.uk
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
