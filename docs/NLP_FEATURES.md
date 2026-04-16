# NLP Features Documentation (OpenAI Integration)

## Overview

LockSafe UK integrates OpenAI's GPT-4 model to provide natural language processing (NLP) capabilities across various features:

1. **Bot Conversations** - Natural language queries via Telegram/WhatsApp
2. **Ad Copy Generation** - AI-powered marketing content
3. **Content Generation** - Organic social media posts
4. **Customer Support** - Intent classification and response generation

---

## Prerequisites

### OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to `.env`:

```env
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxx"
```

### Current Status

✅ **Already configured**: Your `.env` has an OpenAI API key

---

## Feature 1: Natural Language Bot Queries

### Implementation

Located in `/lib/openclaw-nlp.ts`:

```typescript
import { processNaturalLanguageQuery } from "@/lib/openclaw-nlp";

const result = await processNaturalLanguageQuery(
  userMessage,    // "How many jobs today?"
  contextType,    // "admin" | "locksmith" | "customer"
  userId          // Optional user ID for context
);

console.log(result.response);  // AI-generated answer
console.log(result.intent);    // Detected intent
console.log(result.entities);  // Extracted entities
```

### Supported Contexts

#### Admin Context
- Job statistics queries
- Locksmith performance
- Revenue reports
- Platform health checks

**Example Queries:**
- "How many jobs were completed today?"
- "Which locksmiths are available in London?"
- "What's our revenue this week?"
- "Show me pending jobs"

#### Locksmith Context
- Personal earnings
- Job status
- Availability management
- Performance metrics

**Example Queries:**
- "What are my earnings this month?"
- "Any jobs near SW1?"
- "How many jobs have I completed?"
- "Turn my availability off"

#### Customer Context
- Job tracking
- Quote information
- ETA queries
- Support requests

**Example Queries:**
- "Where is my locksmith?"
- "What's the status of my job?"
- "How much will it cost?"

---

## Feature 2: AI Ad Copy Generation

### Implementation

Located in `/lib/openai-ads.ts`:

```typescript
import { generateAdCopy } from "@/lib/openai-ads";

const result = await generateAdCopy({
  objective: "LEADS",
  targetAudience: "Homeowners in London",
  emotionalAngle: "urgency",
  framework: "pas", // Problem-Agitate-Solve
  includeVariations: true
});

// Returns:
// {
//   headline: "Locked Out? Help is 15 Minutes Away",
//   primaryText: "Don't panic...",
//   description: "24/7 Emergency Locksmith",
//   callToAction: "Get Help Now",
//   variations: [...]
// }
```

### Available Frameworks

| Framework | Description |
|-----------|-------------|
| `pas` | Problem-Agitate-Solve |
| `aida` | Attention-Interest-Desire-Action |
| `emotional` | Emotional connection |
| `social_proof` | Testimonials & trust |
| `urgency` | Time-sensitive messaging |
| `benefit` | Feature-benefit focused |

### Emotional Angles

| Angle | Use Case |
|-------|----------|
| `fear` | Security concerns |
| `urgency` | Emergency situations |
| `trust` | Reliability messaging |
| `relief` | Problem resolution |
| `control` | Empowerment |

### API Endpoint

```
POST /api/admin/ai/generate-copy

{
  "objective": "LEADS",
  "targetAudience": "Homeowners in London",
  "emotionalAngle": "urgency"
}
```

---

## Feature 3: Organic Content Generation

### Implementation

Located in `/lib/organic-content.ts`:

```typescript
import { generateOrganicPost } from "@/lib/organic-content";

const post = await generateOrganicPost({
  pillar: "anti-fraud",           // Content pillar
  framework: "justin-welsh",       // Writing style
  emotionalAngle: "trust",
  platform: "FACEBOOK"
});

// Returns:
// {
//   content: "Full post text...",
//   headline: "Optional headline",
//   hook: "Opening hook line",
//   hashtags: ["#LocksmithUK", "..."]
// }
```

### Content Pillars

| Pillar | Topics |
|--------|--------|
| `anti-fraud` | Scam awareness, verification tips |
| `tips` | Security advice, maintenance |
| `stories` | Customer success stories |
| `education` | How locks work, technology |
| `seasonal` | Holiday security, weather |

### Writing Frameworks

| Framework | Style |
|-----------|-------|
| `justin-welsh` | Personal, conversational |
| `russell-brunson` | Story-driven, persuasive |
| `nicholas-cole` | Listicles, clear structure |
| `simon-sinek` | Purpose-driven, inspiring |

---

## Feature 4: AI Chat Assistant

### Implementation

Chat endpoint for admin dashboard:

```
POST /api/admin/ai/chat

{
  "message": "What's our best performing ad?",
  "context": {
    "currentPage": "/admin/ads",
    "recentData": { ... }
  }
}
```

### System Prompt Context

The AI assistant is configured with:
- Business context (locksmith marketplace)
- Available data sources
- Current user permissions
- Recent activity context

---

## Configuration Options

### Model Selection

Default: `gpt-4-turbo-preview`

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4-turbo-preview", // or "gpt-3.5-turbo" for cost savings
  messages: [...],
  temperature: 0.7,
  max_tokens: 1000
});
```

### Temperature Settings

| Use Case | Temperature |
|----------|-------------|
| Factual queries | 0.2 |
| Creative content | 0.8 |
| Balanced responses | 0.5 |

---

## Error Handling

```typescript
try {
  const result = await processNaturalLanguageQuery(...);
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    // Wait and retry
  } else if (error.code === 'insufficient_quota') {
    // Notify admin, use fallback
  } else {
    // Log and return generic response
  }
}
```

### Fallback Responses

When OpenAI is unavailable:

```typescript
if (!process.env.OPENAI_API_KEY) {
  return {
    response: "AI features are not configured. Please contact support.",
    intent: "unknown",
    fallback: true
  };
}
```

---

## Usage Tracking

AI generations are logged for monitoring:

```prisma
model AIGeneration {
  id              String   @id @default(auto())
  type            String   // copy, query, content
  prompt          String
  output          Json
  tokensUsed      Int
  model           String
  usedInCampaign  String?
  wasAccepted     Boolean
  createdAt       DateTime
}
```

---

## Cost Management

### Token Estimation

| Feature | Avg Tokens/Request |
|---------|-------------------|
| NLP Query | 500-1000 |
| Ad Copy | 1000-2000 |
| Social Post | 800-1500 |
| Chat Response | 500-1500 |

### Cost Optimization

1. **Cache common queries**: Store frequent responses
2. **Use GPT-3.5 for simple tasks**: Lower cost model
3. **Limit max_tokens**: Prevent runaway responses
4. **Rate limit per user**: Prevent abuse

---

## Testing

### Test NLP Endpoint

```bash
curl -X POST "https://YOUR_DOMAIN/api/agent/nlp" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How many jobs today?",
    "context": "admin"
  }'
```

### Test Ad Generation

```bash
curl -X POST "https://YOUR_DOMAIN/api/admin/ai/generate-copy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "objective": "LEADS",
    "emotionalAngle": "urgency"
  }'
```

---

## Production Checklist

- [x] `OPENAI_API_KEY` configured in `.env`
- [ ] Usage monitoring set up
- [ ] Rate limiting configured
- [ ] Error fallbacks implemented
- [ ] Cost alerts configured in OpenAI dashboard
- [ ] Test queries verified

---

## Related Documentation

- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) - Bot integration
- [OPENCLAW_SETUP.md](./OPENCLAW_SETUP.md) - NLP system details
