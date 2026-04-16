/**
 * Organic Social Media Content Generation
 *
 * AI-powered content creation for Facebook & Instagram organic posts.
 * Uses elite copywriting frameworks from:
 * - Justin Welsh (hooks, pattern interrupts)
 * - Russell Brunson (storytelling, engagement)
 * - Nicholas Cole (specificity, category design)
 * - Simon Sinek (purpose-driven content)
 */

import OpenAI from 'openai';
import {
  BUSINESS_CONTEXT,
  getBusinessSummary,
  getSeasonalContext,
} from './business-context';
import {
  JUSTIN_WELSH_HOOKS,
  RUSSELL_BRUNSON_FRAMEWORKS,
  NICHOLAS_COLE_FRAMEWORKS,
  SIMON_SINEK_FRAMEWORKS,
  POWER_FRAMEWORKS,
  POWER_HEADLINES,
} from './copywriting-frameworks';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==========================================
// CONTENT PILLARS FOR LOCKSAFE UK
// ==========================================

export const CONTENT_PILLARS = {
  'anti-fraud': {
    name: 'anti-fraud',
    displayName: 'Anti-Fraud Education',
    description: 'Educational content about locksmith scams, how to spot them, and how LockSafe prevents them',
    color: '#EF4444',
    icon: 'ShieldAlert',
    toneGuidelines: ['protective', 'authoritative', 'empowering'],
    topicExamples: [
      'Common locksmith scam tactics',
      'Signs of a cowboy locksmith',
      'Why documentation matters',
      'Price transparency importance',
      'How scammers target vulnerable people',
    ],
    hashtags: ['#LocksmithScams', '#AntiScam', '#ProtectYourself', '#LockSafeUK', '#ConsumerProtection'],
    postsPerWeek: 3,
  },
  'tips': {
    name: 'tips',
    displayName: 'Security Tips & Advice',
    description: 'Practical home security tips, lock maintenance, and preventive advice',
    color: '#3B82F6',
    icon: 'Lightbulb',
    toneGuidelines: ['helpful', 'practical', 'friendly'],
    topicExamples: [
      'How to maintain your locks',
      'Signs your locks need replacing',
      'Home security checklist',
      'What to do when locked out',
      'Key safety best practices',
    ],
    hashtags: ['#HomeSecurity', '#SecurityTips', '#LocksmithAdvice', '#HomeSafety', '#LockMaintenance'],
    postsPerWeek: 2,
  },
  'stories': {
    name: 'stories',
    displayName: 'Customer Stories & Testimonials',
    description: 'Real stories from customers, success stories, and transformation narratives',
    color: '#10B981',
    icon: 'Heart',
    toneGuidelines: ['empathetic', 'authentic', 'celebratory'],
    topicExamples: [
      'Customer saved from scam',
      'Emergency lockout resolution',
      'Elderly customer protection',
      'Business security upgrade',
      'Peace of mind stories',
    ],
    hashtags: ['#CustomerStories', '#RealPeople', '#LockSafeProtects', '#Testimonial', '#TrustStory'],
    postsPerWeek: 2,
  },
  'behind-scenes': {
    name: 'behind-scenes',
    displayName: 'Behind the Scenes',
    description: 'Company culture, locksmith verification process, team stories',
    color: '#8B5CF6',
    icon: 'Building2',
    toneGuidelines: ['transparent', 'personable', 'trustworthy'],
    topicExamples: [
      'How we verify locksmiths',
      'Why we reject 70% of applicants',
      'A day in the life of our support team',
      'How we built our platform',
      'Our founder\'s story',
    ],
    hashtags: ['#BehindTheScenes', '#MeetTheTeam', '#StartupLife', '#Transparency', '#HowWeWork'],
    postsPerWeek: 1,
  },
  'stats': {
    name: 'stats',
    displayName: 'Stats & Facts',
    description: 'Industry statistics, company achievements, impact numbers',
    color: '#F59E0B',
    icon: 'BarChart3',
    toneGuidelines: ['factual', 'impactful', 'credible'],
    topicExamples: [
      'Jobs protected milestone',
      'Industry scam statistics',
      'Average response time',
      'Customer satisfaction rates',
      'Money saved for customers',
    ],
    hashtags: ['#Stats', '#Facts', '#ByTheNumbers', '#Impact', '#Results'],
    postsPerWeek: 1,
  },
  'engagement': {
    name: 'engagement',
    displayName: 'Community Engagement',
    description: 'Questions, polls, discussions, and community building content',
    color: '#EC4899',
    icon: 'MessageCircle',
    toneGuidelines: ['conversational', 'curious', 'inclusive'],
    topicExamples: [
      'Have you ever been locked out?',
      'What security concerns you most?',
      'Share your locksmith experience',
      'Quiz: Can you spot the scam?',
      'What would you do?',
    ],
    hashtags: ['#Question', '#TellUs', '#Community', '#YourThoughts', '#Discussion'],
    postsPerWeek: 2,
  },
} as const;

export type ContentPillarKey = keyof typeof CONTENT_PILLARS;

// ==========================================
// TYPES
// ==========================================

export interface OrganicPostRequest {
  pillar: ContentPillarKey;
  topic?: string;
  framework?: 'justin-welsh' | 'russell-brunson' | 'nicholas-cole' | 'simon-sinek' | 'mixed';
  emotionalAngle?: 'urgency' | 'trust' | 'fear' | 'control' | 'benefit' | 'curiosity';
  postType?: 'text' | 'image' | 'carousel' | 'story' | 'reel';
  platforms?: ('facebook' | 'instagram')[];
  tone?: string[];
  includeCallToAction?: boolean;
  maxLength?: number;
}

export interface OrganicPost {
  content: string;
  headline: string;
  hook: string;
  hookType: string;
  hashtags: string[];
  framework: string;
  emotionalAngle: string;
  pillar: ContentPillarKey;
  callToAction?: string;
  reasoning: string;
  imagePrompt?: string; // For AI image generation
}

export interface ContentCalendarSlot {
  date: Date;
  time: string;
  pillar: ContentPillarKey;
  platform: 'facebook' | 'instagram' | 'both';
}

// ==========================================
// ORGANIC CONTENT SYSTEM PROMPT
// ==========================================

function getOrganicContentPrompt(): string {
  return `You are an ELITE social media content creator for LockSafe UK - the UK's first anti-fraud locksmith platform.

You create ORGANIC social media posts (not ads) that build brand awareness, trust, and engagement.

═══════════════════════════════════════════════════════════════
CONTENT CREATION MASTERY
═══════════════════════════════════════════════════════════════

JUSTIN WELSH - Hooks & Engagement:
• Pattern interrupt openers that stop the scroll
• One-liner power for maximum impact
• Curiosity gaps that demand engagement
• Examples: ${JUSTIN_WELSH_HOOKS.patternInterrupts.slice(0, 3).map(p => `"${p.formula}"`).join(', ')}

RUSSELL BRUNSON - Storytelling:
• Epiphany Bridge for emotional connection
• Personal stories that resonate
• Future pacing for transformation
• Example story arc: ${Object.values(RUSSELL_BRUNSON_FRAMEWORKS.epiphanyBridge.locksafeJourney).join(' → ')}

NICHOLAS COLE - Specificity & Category:
• Category Design positioning
• Specific numbers over vague claims
• "Why Now" urgency triggers
• Position as: "${NICHOLAS_COLE_FRAMEWORKS.categoryDesign.positioningStatement}"

SIMON SINEK - Purpose-Driven:
• Start with WHY
• Belief-driven messaging
• Purpose before product
• Our WHY: "${SIMON_SINEK_FRAMEWORKS.goldenCircle.locksafe.why}"

═══════════════════════════════════════════════════════════════
ORGANIC POST RULES (Not Ads)
═══════════════════════════════════════════════════════════════

1. VALUE FIRST - Educate, entertain, or inspire before promoting
2. HUMAN VOICE - Write like a person, not a brand
3. CONVERSATION STARTERS - End with engagement hooks (questions, opinions)
4. PLATFORM NATIVE - Match platform culture and norms
5. VISUAL THINKING - Describe the ideal image to accompany posts
6. HASHTAG STRATEGY - Mix branded, niche, and discovery hashtags
7. STORY ARC - Even short posts should have beginning, middle, end
8. AUTHENTICITY - Share real struggles, lessons, behind-the-scenes
9. CONTROVERSY (ethical) - Take positions on industry issues
10. VULNERABILITY - Founder story, mistakes, learnings

═══════════════════════════════════════════════════════════════
FACEBOOK vs INSTAGRAM DIFFERENCES
═══════════════════════════════════════════════════════════════

FACEBOOK:
• Longer form acceptable (up to 500 words for stories)
• Link sharing works well
• Community building focus
• More conversational, older demographic
• Questions and discussions perform well

INSTAGRAM:
• Shorter, punchier content
• Visual-first thinking
• Hashtags more important (up to 30)
• Stories and carousels for depth
• Younger demographic, more casual

═══════════════════════════════════════════════════════════════
LOCKSAFE UK CONTENT THEMES
═══════════════════════════════════════════════════════════════

ANTI-FRAUD (Primary):
• "The £50 quote that became £380"
• "How to spot a cowboy locksmith"
• "Why documentation is your best friend"

TIPS & ADVICE:
• Security best practices
• Lock maintenance
• What to do when locked out

STORIES:
• Customer transformations
• Locksmith partner features
• Founder journey

STATS & PROOF:
• "2,500+ protected jobs"
• "£0 scam losses"
• "70% rejection rate"

ENGAGEMENT:
• Polls and questions
• "What would you do?"
• Community challenges`;
}

// ==========================================
// CORE GENERATION FUNCTIONS
// ==========================================

export async function generateOrganicPost(request: OrganicPostRequest): Promise<OrganicPost[]> {
  const businessContext = getBusinessSummary();
  const pillar = CONTENT_PILLARS[request.pillar];
  const seasonalContext = getSeasonalContext();

  const systemPrompt = `${getOrganicContentPrompt()}

═══════════════════════════════════════════════════════════════
LOCKSAFE UK BUSINESS CONTEXT
═══════════════════════════════════════════════════════════════

${businessContext}

${seasonalContext}

PROOF POINTS TO WEAVE IN:
• 2,500+ protected jobs
• £0 scam losses
• 100% dispute resolution rate
• 70% locksmith rejection rate
• 15-min average response
• GPS tracking + photos + signatures + PDF reports`;

  const frameworkInstructions = request.framework === 'mixed' ? `
Use a MIX of copywriting frameworks:
• Justin Welsh hooks for attention
• Russell Brunson storytelling elements
• Nicholas Cole specificity
• Simon Sinek purpose
` : `
Use ${request.framework?.toUpperCase() || 'JUSTIN WELSH'} style specifically.`;

  const userPrompt = `Create 3 organic social media posts for LockSafe UK.

CONTENT PILLAR: ${pillar.displayName}
Description: ${pillar.description}
Tone: ${pillar.toneGuidelines.join(', ')}
Example topics: ${pillar.topicExamples.join(', ')}

${request.topic ? `SPECIFIC TOPIC: ${request.topic}` : ''}
${request.emotionalAngle ? `EMOTIONAL ANGLE: ${request.emotionalAngle}` : ''}
PLATFORMS: ${request.platforms?.join(', ') || 'Facebook and Instagram'}
POST TYPE: ${request.postType || 'text with image'}
${request.includeCallToAction ? 'INCLUDE a soft call-to-action (not salesy)' : 'NO explicit call-to-action'}
MAX LENGTH: ${request.maxLength || 280} characters for main content

${frameworkInstructions}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return JSON with a "posts" array. Each post should have:
- content: The main post text (use \\n for line breaks)
- headline: A bold headline for image overlay (if applicable)
- hook: The opening hook line
- hookType: Type of hook used ("pattern-interrupt", "curiosity-gap", "story", "belief", "question")
- hashtags: Array of relevant hashtags (include pillar hashtags + additional)
- framework: Which copywriting framework was used
- emotionalAngle: The emotional trigger used
- pillar: "${request.pillar}"
- callToAction: Soft CTA if requested (or null)
- reasoning: Why this post will perform well
- imagePrompt: Description of ideal accompanying image

Default hashtags for this pillar: ${pillar.hashtags.join(', ')}

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return (parsed.posts || [parsed]).map((p: OrganicPost) => ({
      content: p.content || '',
      headline: p.headline || '',
      hook: p.hook || '',
      hookType: p.hookType || 'unknown',
      hashtags: p.hashtags || pillar.hashtags,
      framework: p.framework || request.framework || 'mixed',
      emotionalAngle: p.emotionalAngle || request.emotionalAngle || 'benefit',
      pillar: request.pillar,
      callToAction: p.callToAction,
      reasoning: p.reasoning || '',
      imagePrompt: p.imagePrompt,
    }));
  } catch (error) {
    console.error('Error generating organic post:', error);
    throw error;
  }
}

// ==========================================
// SPECIALIZED GENERATORS
// ==========================================

export async function generateStoryPost(topic: string): Promise<OrganicPost[]> {
  return generateOrganicPost({
    pillar: 'stories',
    topic,
    framework: 'russell-brunson',
    emotionalAngle: 'trust',
    postType: 'text',
    includeCallToAction: false,
    maxLength: 500,
  });
}

export async function generateTipPost(topic: string): Promise<OrganicPost[]> {
  return generateOrganicPost({
    pillar: 'tips',
    topic,
    framework: 'nicholas-cole',
    emotionalAngle: 'benefit',
    postType: 'carousel',
    includeCallToAction: true,
    maxLength: 300,
  });
}

export async function generateEngagementPost(): Promise<OrganicPost[]> {
  const engagementTopics = [
    "What's your biggest fear when calling a locksmith?",
    "Have you ever been overcharged by a tradesperson?",
    "Quick poll: How do you find tradespeople?",
    "Story time: Worst lockout experience?",
    "This or that: Change locks or rekey?",
  ];

  const randomTopic = engagementTopics[Math.floor(Math.random() * engagementTopics.length)];

  return generateOrganicPost({
    pillar: 'engagement',
    topic: randomTopic,
    framework: 'justin-welsh',
    emotionalAngle: 'curiosity',
    postType: 'text',
    includeCallToAction: false,
    maxLength: 200,
  });
}

export async function generateStatPost(): Promise<OrganicPost[]> {
  const stats = [
    { stat: "2,500+", description: "jobs protected with zero scam losses" },
    { stat: "70%", description: "of locksmith applicants rejected" },
    { stat: "15 min", description: "average response time" },
    { stat: "100%", description: "dispute resolution rate" },
    { stat: "£0", description: "scam losses reported on our platform" },
  ];

  const randomStat = stats[Math.floor(Math.random() * stats.length)];

  return generateOrganicPost({
    pillar: 'stats',
    topic: `Highlight this stat: ${randomStat.stat} - ${randomStat.description}`,
    framework: 'nicholas-cole',
    emotionalAngle: 'trust',
    postType: 'image',
    includeCallToAction: true,
    maxLength: 150,
  });
}

// ==========================================
// CONTENT CALENDAR GENERATION
// ==========================================

export function generateContentCalendar(
  startDate: Date,
  days: number = 7
): ContentCalendarSlot[] {
  const slots: ContentCalendarSlot[] = [];
  const pillars = Object.values(CONTENT_PILLARS);

  // Calculate total posts per week across all pillars
  const pillarRotation: ContentPillarKey[] = [];
  for (const pillar of pillars) {
    for (let i = 0; i < pillar.postsPerWeek; i++) {
      pillarRotation.push(pillar.name as ContentPillarKey);
    }
  }

  // Shuffle for variety
  const shuffledPillars = pillarRotation.sort(() => Math.random() - 0.5);

  const publishTimes = ['09:00', '12:00', '18:00', '20:00'];
  let pillarIndex = 0;

  for (let d = 0; d < days; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);

    // 2 posts per day
    const postsPerDay = 2;
    for (let p = 0; p < postsPerDay; p++) {
      const pillar = shuffledPillars[pillarIndex % shuffledPillars.length];
      const time = publishTimes[(d * postsPerDay + p) % publishTimes.length];

      slots.push({
        date: new Date(date),
        time,
        pillar,
        platform: p % 2 === 0 ? 'both' : 'facebook', // Alternate platforms
      });

      pillarIndex++;
    }
  }

  return slots;
}

// ==========================================
// BATCH GENERATION FOR AUTOPILOT
// ==========================================

export async function generateWeeklyContent(): Promise<OrganicPost[]> {
  const calendar = generateContentCalendar(new Date(), 7);
  const posts: OrganicPost[] = [];

  // Group by pillar to batch generate
  const pillarGroups = new Map<ContentPillarKey, number>();
  for (const slot of calendar) {
    pillarGroups.set(slot.pillar, (pillarGroups.get(slot.pillar) || 0) + 1);
  }

  // Generate content for each pillar
  for (const [pillar, count] of pillarGroups) {
    const frameworks = ['justin-welsh', 'russell-brunson', 'nicholas-cole', 'simon-sinek'];
    const angles: Array<'trust' | 'urgency' | 'control' | 'benefit' | 'curiosity'> = ['trust', 'urgency', 'control', 'benefit', 'curiosity'];

    for (let i = 0; i < count; i++) {
      const framework = frameworks[i % frameworks.length] as 'justin-welsh' | 'russell-brunson' | 'nicholas-cole' | 'simon-sinek';
      const angle = angles[i % angles.length];

      try {
        const generated = await generateOrganicPost({
          pillar,
          framework,
          emotionalAngle: angle,
          includeCallToAction: i % 2 === 0,
        });

        if (generated.length > 0) {
          posts.push(generated[0]);
        }
      } catch (error) {
        console.error(`Error generating content for ${pillar}:`, error);
      }
    }
  }

  return posts;
}

// ==========================================
// HOOK GENERATORS (Quick Generation)
// ==========================================

export async function generateHooks(
  count: number = 5,
  type?: 'pattern-interrupt' | 'curiosity-gap' | 'story' | 'question'
): Promise<string[]> {
  const hookExamples = type === 'pattern-interrupt'
    ? JUSTIN_WELSH_HOOKS.patternInterrupts.map(p => p.example)
    : type === 'curiosity-gap'
    ? JUSTIN_WELSH_HOOKS.curiosityGaps
    : type === 'story'
    ? [
        "3 years ago, my mother was scammed by a locksmith.",
        "I still remember the day we decided to build LockSafe.",
        "Last week, Sarah called us in tears.",
      ]
    : [
        "What's your biggest fear when calling a locksmith?",
        "Ever been quoted one price and charged another?",
        "How do you choose who to trust in an emergency?",
      ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You write scroll-stopping hooks for LockSafe UK social media.
Examples of great hooks: ${hookExamples.join(' | ')}
Keep hooks under 100 characters. Make them punchy and engaging.`,
      },
      {
        role: 'user',
        content: `Generate ${count} ${type || 'mixed'} hooks for LockSafe UK organic social media posts. Return JSON with "hooks" array of strings.`,
      },
    ],
    temperature: 0.5,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) return hookExamples.slice(0, count);

  const parsed = JSON.parse(content);
  return parsed.hooks || hookExamples.slice(0, count);
}

// ==========================================
// IMAGE PROMPT GENERATOR
// ==========================================

export async function generateImagePrompt(post: OrganicPost): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You create image prompts for social media posts.
For LockSafe UK (locksmith protection platform), create prompts for:
- Professional, trustworthy imagery
- Avoid stock photo clichés
- Consider text overlay space
- Brand colors: Orange (#F97316), Dark slate (#1E293B)
- Modern, clean aesthetic`,
      },
      {
        role: 'user',
        content: `Create an image prompt for this post:

Headline: ${post.headline}
Content: ${post.content.slice(0, 200)}
Pillar: ${post.pillar}
Emotional angle: ${post.emotionalAngle}

Return a detailed image generation prompt (for DALL-E or Midjourney style).`,
      },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  return response.choices[0].message.content || post.imagePrompt || '';
}

// ==========================================
// HASHTAG OPTIMIZATION
// ==========================================

export function optimizeHashtags(
  pillar: ContentPillarKey,
  additionalHashtags: string[] = [],
  platform: 'facebook' | 'instagram' = 'instagram'
): string[] {
  const pillarData = CONTENT_PILLARS[pillar];
  const baseHashtags = [...pillarData.hashtags];

  // Branded hashtags (always include)
  const branded = ['#LockSafeUK', '#AntiScamLocksmith'];

  // Discovery hashtags
  const discovery = [
    '#HomeOwnerTips',
    '#PropertySecurity',
    '#UKHomeowners',
    '#TrustMatters',
    '#ConsumerAdvice',
  ];

  // Combine and dedupe
  let allHashtags = [...new Set([
    ...branded,
    ...baseHashtags,
    ...additionalHashtags,
    ...discovery.slice(0, 3),
  ])];

  // Platform limits
  const maxHashtags = platform === 'instagram' ? 25 : 5;

  return allHashtags.slice(0, maxHashtags);
}

// ==========================================
// POST FORMATTING FOR PLATFORMS
// ==========================================

export function formatPostForPlatform(
  post: OrganicPost,
  platform: 'facebook' | 'instagram'
): string {
  const hashtags = optimizeHashtags(post.pillar, post.hashtags, platform);

  if (platform === 'instagram') {
    // Instagram: shorter, hashtags at end or in first comment
    return `${post.content}\n\n.\n.\n.\n${hashtags.join(' ')}`;
  } else {
    // Facebook: longer allowed, fewer hashtags
    const shortHashtags = hashtags.slice(0, 5).join(' ');
    return `${post.content}\n\n${shortHashtags}`;
  }
}

export default {
  generateOrganicPost,
  generateStoryPost,
  generateTipPost,
  generateEngagementPost,
  generateStatPost,
  generateContentCalendar,
  generateWeeklyContent,
  generateHooks,
  generateImagePrompt,
  optimizeHashtags,
  formatPostForPlatform,
  CONTENT_PILLARS,
};
