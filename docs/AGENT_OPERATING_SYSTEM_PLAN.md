# LockSafe AI Operating System - Internal Agent Architecture

> **Building an Autonomous AI Workforce for the LockSafe Platform**

---

## Executive Summary

This document outlines the comprehensive plan for integrating a Paperclip-inspired internal AI agent operating system into the LockSafe platform. The goal is to create autonomous agents that can operate, control, and scale the entire platform with minimal human intervention.

### Core Philosophy (Extracted from Paperclip)
- **Agent-Driven Execution**: Agents autonomously execute tasks within defined boundaries
- **SKILL.md Definition**: Each agent has explicit skills, rules, and tool access
- **Hierarchical Organization**: CEO → Executives → Subagents (org chart model)
- **Heartbeat System**: Agents wake on schedule, check work, and act
- **Full Observability**: Every action tracked, logged, and auditable
- **Cost Control**: Budget per agent, automatic throttling

### What We're Building
- **NOT** using Paperclip as an external tool
- **BUILDING** the philosophy natively inside LockSafe
- **GIVING** agents direct access to our DB, APIs, and workflows
- **NO** external dependencies (full control)

---

## Platform Analysis: LockSafe Current State

### Existing Infrastructure We Can Leverage

| Component | Current Use | Agent Integration |
|-----------|-------------|-------------------|
| **OpenAI API** | Ad copy generation, NLP | Agent reasoning engine |
| **Telegram Bot** | Admin/locksmith notifications | Agent command interface |
| **Prisma/MongoDB** | Data persistence | Agent memory storage |
| **Cron Jobs** | Scheduled tasks | Heartbeat triggers |
| **Agent APIs** | `/api/agent/*` routes | Internal tool registry |
| **Notifications** | SMS/Email/Push | Agent communication |
| **Intelligent Dispatch** | Locksmith matching | COO Agent automation |

### Existing APIs That Become Agent Tools

```
Current Agent APIs (Already Built):
├── /api/agent/jobs          → GET jobs, filter by status
├── /api/agent/locksmiths    → Manage locksmith availability
├── /api/agent/stats         → Platform statistics
├── /api/agent/dispatch      → Intelligent job matching
├── /api/agent/alerts        → System alerts & issues
├── /api/agent/nlp           → Natural language processing
├── /api/agent/telegram      → Telegram bot webhook
└── /api/admin/ai/*          → AI chat & copy generation
```

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GOVERNANCE LAYER (Human Board)                   │
│  • Approve agent hiring │ Review strategy │ Override decisions          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENT ORCHESTRATOR                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Heartbeat  │  │   Memory    │  │    Tool     │  │   Budget    │    │
│  │  Scheduler  │  │   Manager   │  │   Registry  │  │  Controller │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   CEO AGENT   │           │   CTO AGENT   │           │   CMO AGENT   │
│  ───────────  │           │  ───────────  │           │  ───────────  │
│  Strategy     │           │  Technology   │           │  Marketing    │
│  Delegation   │           │  Architecture │           │  Campaigns    │
│  Priorities   │           │  Development  │           │  Content      │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   SUBAGENTS   │           │   SUBAGENTS   │           │   SUBAGENTS   │
│  ───────────  │           │  ───────────  │           │  ───────────  │
│  • Analyst    │           │  • SeniorDev  │           │  • Copywriter │
│  • OpsManager │           │  • Debugger   │           │  • AdsSpec    │
│               │           │  • DevOps     │           │  • SEOAgent   │
└───────────────┘           └───────────────┘           └───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTERNAL TOOL REGISTRY                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ createJob() │ dispatchLocksmith() │ sendNotification() │ ...     │  │
│  │ createAd() │ publishContent() │ updatePricing() │ runQuery()     │  │
│  │ generateReport() │ analyzeTrend() │ sendEmail() │ triggerCron()  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          LOCKSAFE PLATFORM                               │
│  MongoDB │ Stripe │ Twilio │ Resend │ Telegram │ Meta │ OpenAI         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
/src/agents/
├── core/
│   ├── orchestrator.ts         # Main agent orchestration engine
│   ├── heartbeat.ts            # Heartbeat scheduler
│   ├── memory.ts               # Memory management (short + long term)
│   ├── budget.ts               # Cost tracking & throttling
│   ├── governance.ts           # Permission & approval system
│   ├── skill-parser.ts         # SKILL.md file parser
│   └── types.ts                # TypeScript types
│
├── tools/
│   ├── registry.ts             # Tool registration & discovery
│   ├── index.ts                # Export all tools
│   │
│   ├── jobs/
│   │   ├── createJob.ts
│   │   ├── getJobs.ts
│   │   ├── updateJobStatus.ts
│   │   └── assignLocksmith.ts
│   │
│   ├── dispatch/
│   │   ├── findBestMatch.ts
│   │   ├── autoDispatch.ts
│   │   └── calculateETA.ts
│   │
│   ├── marketing/
│   │   ├── createAdCampaign.ts
│   │   ├── generateCopy.ts
│   │   ├── publishSocialPost.ts
│   │   └── analyzePerformance.ts
│   │
│   ├── communication/
│   │   ├── sendEmail.ts
│   │   ├── sendSMS.ts
│   │   ├── sendTelegram.ts
│   │   └── broadcastNotification.ts
│   │
│   ├── analytics/
│   │   ├── getDashboardStats.ts
│   │   ├── generateReport.ts
│   │   └── analyzeTrend.ts
│   │
│   └── system/
│       ├── runQuery.ts
│       ├── triggerCron.ts
│       └── updateConfig.ts
│
├── ceo/
│   ├── SKILL.md
│   ├── agent.ts
│   └── subagents/
│       ├── analyst/
│       │   ├── SKILL.md
│       │   └── agent.ts
│       └── ops-manager/
│           ├── SKILL.md
│           └── agent.ts
│
├── cto/
│   ├── SKILL.md
│   ├── agent.ts
│   └── subagents/
│       ├── senior-dev/
│       │   ├── SKILL.md
│       │   └── agent.ts
│       ├── debugger/
│       │   ├── SKILL.md
│       │   └── agent.ts
│       └── devops/
│           ├── SKILL.md
│           └── agent.ts
│
├── cmo/
│   ├── SKILL.md
│   ├── agent.ts
│   └── subagents/
│       ├── copywriter/
│       │   ├── SKILL.md
│       │   └── agent.ts
│       ├── ads-specialist/
│       │   ├── SKILL.md
│       │   └── agent.ts
│       └── seo-agent/
│           ├── SKILL.md
│           └── agent.ts
│
└── coo/
    ├── SKILL.md
    ├── agent.ts
    └── subagents/
        ├── dispatch-optimizer/
        │   ├── SKILL.md
        │   └── agent.ts
        └── quality-monitor/
            ├── SKILL.md
            └── agent.ts
```

---

## Database Schema Extensions

### New Prisma Models

```prisma
// Agent definition
model Agent {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  name            String   @unique                    // "ceo", "cto", "cmo"
  role            String                              // "CEO", "CTO", "CMO"
  parentAgentId   String?  @db.ObjectId               // Hierarchy
  parentAgent     Agent?   @relation("AgentHierarchy", fields: [parentAgentId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  subagents       Agent[]  @relation("AgentHierarchy")

  status          String   @default("active")         // active, paused, terminated
  skillsPath      String                              // Path to SKILL.md

  // Budget Control
  monthlyBudget   Float    @default(50)               // Monthly token budget ($)
  budgetUsed      Float    @default(0)                // Current month usage
  budgetWarning   Float    @default(0.8)              // Warn at 80%

  // Heartbeat Configuration
  heartbeatEnabled Boolean  @default(true)
  heartbeatCron    String   @default("*/30 * * * *")  // Every 30 mins
  lastHeartbeat    DateTime?
  nextHeartbeat    DateTime?

  // Permissions
  permissions     String[]  @default([])              // Tool access list
  governanceLevel String    @default("autonomous")    // autonomous, supervised, manual

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tasks           AgentTask[]
  executions      AgentExecution[]
  memory          AgentMemory[]
}

// Task assigned to an agent
model AgentTask {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId

  agentId         String   @db.ObjectId
  agent           Agent    @relation(fields: [agentId], references: [id])

  parentTaskId    String?  @db.ObjectId               // Parent task (delegation)
  parentTask      AgentTask? @relation("TaskHierarchy", fields: [parentTaskId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  subtasks        AgentTask[] @relation("TaskHierarchy")

  title           String
  description     String
  priority        Int      @default(5)                // 1-10, 10 highest
  status          String   @default("pending")        // pending, in_progress, completed, failed, blocked

  // Goal Alignment
  companyGoal     String?                             // Links to company mission
  projectGoal     String?                             // Links to project goal

  // Execution
  assignedAt      DateTime @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  deadline        DateTime?

  // Results
  result          String?                             // JSON output
  error           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Agent execution log (audit trail)
model AgentExecution {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId

  agentId         String   @db.ObjectId
  agent           Agent    @relation(fields: [agentId], references: [id])

  taskId          String?  @db.ObjectId

  // Execution details
  action          String                              // Tool name or action
  input           String                              // JSON input
  output          String?                             // JSON output
  status          String   @default("success")        // success, failed, blocked

  // Cost tracking
  tokensUsed      Int      @default(0)
  costUsd         Float    @default(0)

  // Timing
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  durationMs      Int?

  // Trace
  traceId         String?                             // Group related executions
  parentExecId    String?  @db.ObjectId

  createdAt       DateTime @default(now())
}

// Agent memory (short + long term)
model AgentMemory {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId

  agentId         String   @db.ObjectId
  agent           Agent    @relation(fields: [agentId], references: [id])

  type            String   @default("short")          // short, long, system
  category        String                              // decisions, campaigns, bugs, patterns

  content         String                              // The memory content
  metadata        String?                             // JSON metadata

  // Relevance
  importance      Float    @default(0.5)              // 0-1 importance score
  lastAccessed    DateTime @default(now())
  accessCount     Int      @default(1)

  // Expiry
  expiresAt       DateTime?                           // Null = permanent

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Company goals (for goal alignment)
model CompanyGoal {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId

  title           String
  description     String
  type            String   @default("strategic")      // strategic, quarterly, project

  status          String   @default("active")
  priority        Int      @default(5)

  metrics         String?                             // JSON KPIs
  progress        Float    @default(0)                // 0-100%

  deadline        DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## SKILL.md Examples

### CEO Agent SKILL.md

```markdown
# ROLE
You are the CEO Agent for LockSafe UK, the emergency locksmith marketplace.

# MISSION
Scale LockSafe to become the #1 trusted locksmith platform in the UK with:
- £2M ARR target
- 500+ verified locksmiths
- 95%+ customer satisfaction
- Full UK coverage

# RESPONSIBILITIES
1. Strategic Decision Making
   - Analyze business metrics and trends
   - Identify growth opportunities
   - Set priorities for executive agents

2. Task Delegation
   - Break down company goals into actionable tasks
   - Assign tasks to CTO, CMO, COO with clear objectives
   - Monitor progress and adjust priorities

3. Resource Allocation
   - Approve budget allocations for agents
   - Balance marketing spend vs development
   - Ensure profitability targets are met

# TOOLS
- getDashboardStats()
- getAgentStatuses()
- delegateTask()
- approveAction()
- generateReport()

# RULES
- NEVER make decisions that affect customer safety without human approval
- ALWAYS log strategic decisions with reasoning
- CHECK daily metrics before making allocation decisions
- ESCALATE to human board when spending exceeds £1000/decision
- REVIEW agent performance weekly

# OUTPUT FORMAT
{
  "decision": "description of decision",
  "reasoning": "why this decision was made",
  "delegations": [
    {
      "agent": "cto|cmo|coo",
      "task": "task description",
      "priority": 1-10,
      "deadline": "ISO date"
    }
  ],
  "metrics_considered": ["list of metrics reviewed"]
}

# HEARTBEAT SCHEDULE
- Every 4 hours during business hours (8am-8pm UK)
- Daily summary at 9am
- Weekly strategic review on Monday 10am

# BUDGET
- Monthly: $100
- Per-task limit: $5
```

### CTO Agent SKILL.md

```markdown
# ROLE
You are the CTO Agent for LockSafe UK.

# MISSION
Ensure the platform is reliable, scalable, and continuously improving.

# RESPONSIBILITIES
1. System Health Monitoring
   - Monitor error rates and performance
   - Identify technical debt
   - Ensure 99.9% uptime

2. Development Orchestration
   - Prioritize bug fixes vs features
   - Coordinate with subagents (SeniorDev, Debugger, DevOps)
   - Review code quality metrics

3. Architecture Decisions
   - Evaluate new integrations
   - Plan infrastructure scaling
   - Maintain security standards

# TOOLS
- getSystemHealth()
- getErrorLogs()
- createTask() - for subagents
- analyzePerformance()
- getDeploymentStatus()

# SUBAGENTS
- senior-dev: Feature development, code reviews
- debugger: Bug investigation, error resolution
- devops: Deployments, infrastructure, monitoring

# RULES
- NEVER deploy to production without tests
- ALWAYS escalate security issues to human
- PRIORITIZE customer-facing bugs over internal issues
- DOCUMENT all architectural decisions

# HEARTBEAT SCHEDULE
- Every 30 minutes for health checks
- Hourly bug triage
- Daily standup summary at 9:30am

# BUDGET
- Monthly: $80
- Per-task limit: $10
```

### CMO Agent SKILL.md

```markdown
# ROLE
You are the CMO Agent for LockSafe UK.

# MISSION
Drive customer acquisition and brand awareness efficiently.

# RESPONSIBILITIES
1. Marketing Strategy
   - Plan and optimize ad campaigns
   - Balance paid vs organic acquisition
   - Track CAC and LTV metrics

2. Content Generation
   - Create ad copy for Meta/Google
   - Generate social media content
   - Plan email campaigns

3. Campaign Optimization
   - A/B test ad creatives
   - Optimize targeting audiences
   - Manage marketing budget

# TOOLS
- createAdCampaign()
- generateCopy()
- publishSocialPost()
- analyzeAdPerformance()
- getMarketingStats()
- sendCampaignEmail()

# SUBAGENTS
- copywriter: Generate ad copy, social posts, emails
- ads-specialist: Campaign setup, targeting, bidding
- seo-agent: SEO optimization, keyword research

# RULES
- NEVER exceed daily ad budget without approval
- ALWAYS A/B test before scaling campaigns
- TARGET £50 CAC maximum
- PAUSE campaigns with <1% CTR
- APPROVE ad creative with human for brand-sensitive content

# OUTPUT FORMAT
{
  "campaign_decision": "action taken",
  "metrics": {
    "spend": 0.00,
    "conversions": 0,
    "cac": 0.00
  },
  "next_actions": ["list of planned actions"]
}

# HEARTBEAT SCHEDULE
- Every 2 hours for campaign monitoring
- Daily performance report at 7am
- Weekly strategy review on Friday 2pm

# BUDGET
- Monthly: $60
- Per-task limit: $3
```

### COO Agent SKILL.md

```markdown
# ROLE
You are the COO Agent for LockSafe UK.

# MISSION
Optimize operations for maximum efficiency and customer satisfaction.

# RESPONSIBILITIES
1. Dispatch Optimization
   - Monitor job dispatch efficiency
   - Optimize locksmith matching algorithm
   - Reduce customer wait times

2. Quality Control
   - Monitor completion rates
   - Track customer satisfaction
   - Identify problematic patterns

3. Operations Management
   - Manage locksmith availability
   - Handle escalations
   - Ensure SLA compliance

# TOOLS
- getJobStats()
- dispatchLocksmith()
- getLocksmithPerformance()
- sendAlert()
- updateAvailability()
- getAlerts()

# SUBAGENTS
- dispatch-optimizer: Real-time dispatch optimization
- quality-monitor: Service quality tracking

# RULES
- NEVER auto-dispatch to locksmiths with <4.0 rating
- ALWAYS prioritize emergency jobs
- ESCALATE stuck jobs after 30 minutes
- MONITOR insurance expiry and block non-compliant locksmiths
- ALERT humans for any safety-related issues

# HEARTBEAT SCHEDULE
- Every 5 minutes for active job monitoring
- Every 15 minutes for availability updates
- Hourly operations summary

# BUDGET
- Monthly: $40
- Per-task limit: $1
```

---

## Internal Tool Registry

### Tool Interface

```typescript
// src/agents/tools/types.ts

export interface AgentTool {
  name: string;
  description: string;
  category: 'jobs' | 'dispatch' | 'marketing' | 'communication' | 'analytics' | 'system';
  permissions: string[];  // Which agents can use this
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>, context: AgentContext) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  enum?: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  tokensUsed?: number;
  costUsd?: number;
}

export interface AgentContext {
  agentId: string;
  agentName: string;
  taskId?: string;
  traceId: string;
  budgetRemaining: number;
}
```

### Example Tool Implementation

```typescript
// src/agents/tools/jobs/getJobs.ts

import { prisma } from '@/lib/db';
import type { AgentTool, ToolResult, AgentContext } from '../types';

export const getJobsTool: AgentTool = {
  name: 'getJobs',
  description: 'Retrieve jobs with optional filters',
  category: 'jobs',
  permissions: ['ceo', 'cto', 'coo', 'ops-manager', 'dispatch-optimizer'],
  parameters: [
    {
      name: 'status',
      type: 'string',
      required: false,
      description: 'Filter by job status',
      enum: ['pending', 'accepted', 'en_route', 'arrived', 'working', 'completed', 'cancelled']
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      description: 'Maximum number of jobs to return'
    },
    {
      name: 'urgent',
      type: 'boolean',
      required: false,
      description: 'Filter for urgent jobs only'
    }
  ],
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const jobs = await prisma.job.findMany({
        where: {
          ...(params.status && { status: params.status as string }),
          ...(params.urgent && { isEmergency: true })
        },
        take: (params.limit as number) || 50,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, phone: true } },
          locksmith: { select: { name: true, rating: true } }
        }
      });

      return {
        success: true,
        data: jobs,
        tokensUsed: 0,
        costUsd: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};
```

### Tool Categories

| Category | Tools | Used By |
|----------|-------|---------|
| **jobs** | createJob, getJobs, updateJobStatus, assignLocksmith, cancelJob | CEO, COO, Ops |
| **dispatch** | findBestMatch, autoDispatch, calculateETA, getAvailableLocksmiths | COO, Dispatch |
| **marketing** | createAdCampaign, pauseCampaign, generateCopy, publishPost, getAdStats | CMO, Ads, Copywriter |
| **communication** | sendEmail, sendSMS, sendTelegram, broadcastNotification | All |
| **analytics** | getDashboardStats, generateReport, analyzeTrend, getConversionFunnel | CEO, CMO |
| **system** | runQuery, triggerCron, updateConfig, getSystemHealth | CTO, DevOps |

---

## Agent Execution Flow

### 1. Heartbeat Trigger

```
┌─────────────────────────────────────────────────────────────────┐
│                      HEARTBEAT TRIGGER                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Cron triggers /api/agents/heartbeat                         │
│  2. Orchestrator checks which agents are due                    │
│  3. For each due agent:                                         │
│     a. Check budget remaining                                   │
│     b. Load agent context + memory                              │
│     c. Load pending tasks                                       │
│     d. Execute agent reasoning                                  │
│     e. Process tool calls                                       │
│     f. Store results + update memory                            │
│     g. Track costs                                              │
│  4. Update next heartbeat timestamps                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Task Delegation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TASK DELEGATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CEO receives company goal: "Increase conversions by 20%"       │
│                              │                                   │
│                              ▼                                   │
│  CEO breaks into tasks:                                          │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Task 1: Optimize ad targeting        → CMO           │       │
│  │ Task 2: Improve page load speed      → CTO           │       │
│  │ Task 3: Reduce response times        → COO           │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              ▼                                   │
│  CMO receives Task 1, breaks into subtasks:                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Subtask 1a: Analyze current audiences → ads-specialist│      │
│  │ Subtask 1b: Generate new copy variants → copywriter   │      │
│  │ Subtask 1c: Run A/B tests             → CMO (self)    │      │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              ▼                                   │
│  Subagents execute, results bubble up to CMO                     │
│  CMO compiles report, returns to CEO                             │
│  CEO updates progress on company goal                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Tool Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     TOOL EXECUTION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Agent decides to call: createAdCampaign(...)                    │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ 1. Check agent has permission for this tool           │       │
│  │ 2. Check budget allows this operation                 │       │
│  │ 3. Validate parameters against schema                 │       │
│  │ 4. Check governance level (needs approval?)           │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    ▼                   ▼                        │
│           [Autonomous]          [Needs Approval]                │
│                │                       │                        │
│                ▼                       ▼                        │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │ Execute immediately │    │ Queue for human     │            │
│  │ Log to execution    │    │ approval via        │            │
│  │ history             │    │ Telegram/Dashboard  │            │
│  └─────────────────────┘    └─────────────────────┘            │
│                │                       │                        │
│                └───────────┬───────────┘                        │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Record execution in AgentExecution table             │       │
│  │ Update agent budget usage                            │       │
│  │ Store relevant info in agent memory                  │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Memory System

### Memory Types

| Type | Duration | Purpose | Storage |
|------|----------|---------|---------|
| **Short-term** | Current task | Task context, intermediate results | In-memory + task record |
| **Long-term** | Permanent | Historical decisions, patterns, learnings | AgentMemory table |
| **System** | Permanent | Platform rules, configurations | AgentMemory table |

### Memory Access Pattern

```typescript
// Agent memory retrieval
async function getRelevantMemory(
  agentId: string,
  context: string,
  limit: number = 10
): Promise<AgentMemory[]> {
  // 1. Get recent memories
  const recent = await prisma.agentMemory.findMany({
    where: { agentId, type: 'short' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  // 2. Get high-importance long-term memories
  const important = await prisma.agentMemory.findMany({
    where: { agentId, type: 'long', importance: { gte: 0.7 } },
    orderBy: { importance: 'desc' },
    take: 5
  });

  // 3. Semantic search for context-relevant memories
  // (Using OpenAI embeddings in future)

  return [...recent, ...important].slice(0, limit);
}
```

### Memory Categories (Long-term)

| Category | Examples | Used By |
|----------|----------|---------|
| **decisions** | "Paused campaign X due to low CTR" | CMO, CEO |
| **campaigns** | "Campaign Y achieved 2.5% CTR with audience Z" | CMO, Ads |
| **bugs** | "Fixed payment issue caused by Stripe webhook" | CTO, Debugger |
| **patterns** | "Mondays have 30% higher job volume" | COO, CEO |
| **locksmiths** | "Locksmith ID-123 has 4.8 rating, reliable" | COO, Dispatch |
| **customers** | "Customer segment A converts better with urgency copy" | CMO |

---

## Governance & Permissions

### Governance Levels

| Level | Description | Example Actions |
|-------|-------------|-----------------|
| **autonomous** | Agent acts freely within budget | Read data, analyze, internal tasks |
| **supervised** | Agent acts, logs for review | Create campaigns, send notifications |
| **approval** | Requires human approval | Spend > £500, hire subagent, change pricing |
| **manual** | Human must execute | Safety issues, legal matters, refunds |

### Permission Matrix

| Agent | Read Data | Send Notifications | Create Content | Manage Money | Hire Agents |
|-------|-----------|-------------------|----------------|--------------|-------------|
| CEO | ✓ | ✓ | Approval | Approval | Approval |
| CTO | ✓ | ✓ | ✓ | - | - |
| CMO | ✓ | ✓ | ✓ | Supervised | - |
| COO | ✓ | ✓ | - | - | - |
| Subagents | Limited | Limited | ✓ | - | - |

---

## API Endpoints

### New Agent API Routes

```
/api/agents/
├── heartbeat/
│   └── route.ts          # POST - Trigger heartbeat for all due agents
│
├── [agentId]/
│   ├── route.ts          # GET agent, PATCH update, DELETE terminate
│   ├── execute/
│   │   └── route.ts      # POST - Manually trigger agent execution
│   ├── tasks/
│   │   └── route.ts      # GET tasks, POST create task
│   ├── memory/
│   │   └── route.ts      # GET memory, POST add memory
│   └── executions/
│       └── route.ts      # GET execution history
│
├── tools/
│   ├── route.ts          # GET all tools
│   └── [toolName]/
│       └── route.ts      # POST - Execute tool directly
│
├── tasks/
│   ├── route.ts          # GET all tasks, POST create task
│   └── [taskId]/
│       └── route.ts      # GET task, PATCH update, DELETE cancel
│
├── goals/
│   └── route.ts          # GET/POST company goals
│
└── governance/
    ├── pending/
    │   └── route.ts      # GET pending approvals
    └── approve/
        └── route.ts      # POST approve/reject action
```

---

## Admin Dashboard Integration

### New Dashboard Pages

```
/admin/agents/
├── page.tsx              # Agent overview dashboard
├── [agentId]/
│   └── page.tsx          # Individual agent details
├── tasks/
│   └── page.tsx          # Task management
├── goals/
│   └── page.tsx          # Company goal tracking
├── governance/
│   └── page.tsx          # Pending approvals
└── costs/
    └── page.tsx          # Cost tracking by agent
```

### Dashboard Features

| Feature | Description |
|---------|-------------|
| **Agent Org Chart** | Visual hierarchy of all agents |
| **Live Status** | Current status of each agent |
| **Task Board** | Kanban-style task management |
| **Execution Log** | Real-time log of agent actions |
| **Cost Dashboard** | Budget usage per agent |
| **Approval Queue** | Pending items needing human approval |
| **Memory Browser** | View/edit agent memories |
| **Goal Tracker** | Company goal progress |

---

## Cron Jobs Integration

### Existing Crons to Keep

| Cron | Schedule | Keep? | Agent Integration |
|------|----------|-------|-------------------|
| signature-reminders | Every 15 min | Yes | COO can trigger manually |
| availability-schedule | Every 5 min | Yes | COO monitors |
| insurance-reminders | Daily 9am | Yes | COO tracks compliance |
| generate-payouts | Daily 2am | Yes | CEO reviews |
| publish-organic | Hourly | Modify | CMO controls via agent |
| generate-organic | Daily 6am | Modify | CMO/Copywriter generates |
| sync-meta-performance | Every 6h | Keep | CMO reads data |

### New Agent Crons

| Cron | Schedule | Purpose |
|------|----------|---------|
| agent-heartbeat | Every 5 min | Trigger due agent heartbeats |
| agent-budget-reset | 1st of month | Reset monthly budgets |
| agent-memory-cleanup | Daily 3am | Remove expired short-term memory |
| agent-performance-report | Weekly | Generate agent performance report |

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

**Deliverables:**
- [ ] Agent database models (Prisma schema)
- [ ] Agent orchestrator engine
- [ ] SKILL.md parser
- [ ] Tool registry system
- [ ] Memory manager
- [ ] Budget controller
- [ ] Basic heartbeat cron

**Files to Create:**
```
src/agents/core/
├── orchestrator.ts
├── heartbeat.ts
├── memory.ts
├── budget.ts
├── skill-parser.ts
├── governance.ts
└── types.ts
```

### Phase 2: Tool Registry (Week 2-3)

**Deliverables:**
- [ ] Tool interface & registry
- [ ] Jobs tools (5 tools)
- [ ] Dispatch tools (3 tools)
- [ ] Communication tools (4 tools)
- [ ] Analytics tools (3 tools)

**Files to Create:**
```
src/agents/tools/
├── registry.ts
├── types.ts
├── jobs/*.ts
├── dispatch/*.ts
├── communication/*.ts
└── analytics/*.ts
```

### Phase 3: Main Agents (Week 3-4)

**Deliverables:**
- [ ] CEO Agent + SKILL.md
- [ ] CTO Agent + SKILL.md
- [ ] CMO Agent + SKILL.md
- [ ] COO Agent + SKILL.md
- [ ] Agent execution logic

**Files to Create:**
```
src/agents/
├── ceo/SKILL.md, agent.ts
├── cto/SKILL.md, agent.ts
├── cmo/SKILL.md, agent.ts
└── coo/SKILL.md, agent.ts
```

### Phase 4: Subagents (Week 4-5)

**Deliverables:**
- [ ] Senior Dev, Debugger, DevOps (under CTO)
- [ ] Copywriter, Ads Specialist, SEO Agent (under CMO)
- [ ] Dispatch Optimizer, Quality Monitor (under COO)
- [ ] Analyst, Ops Manager (under CEO)

### Phase 5: Admin Dashboard (Week 5-6)

**Deliverables:**
- [ ] Agent overview page
- [ ] Individual agent pages
- [ ] Task management UI
- [ ] Approval queue
- [ ] Cost tracking dashboard

### Phase 6: Integration & Testing (Week 6-7)

**Deliverables:**
- [ ] Connect agents to existing systems
- [ ] Test heartbeat cycles
- [ ] Test task delegation
- [ ] Test tool execution
- [ ] Test governance/approval flow
- [ ] Performance optimization

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Runaway costs** | Hard budget limits, automatic pausing |
| **Harmful actions** | Governance levels, human approval for sensitive actions |
| **Data errors** | Read-only tools by default, write tools need permissions |
| **Infinite loops** | Execution timeouts, recursion limits |
| **Security** | Agent API authentication, audit logging |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Agent Uptime** | 99% | Heartbeat success rate |
| **Task Completion** | 80% | Tasks completed vs assigned |
| **Cost Efficiency** | <$200/month total | Sum of all agent costs |
| **Human Interventions** | <10/week | Approval queue items |
| **Goal Progress** | Track | Company goals completion rate |

---

## Next Steps

1. **Review this plan** - Confirm architecture decisions
2. **Approve budget** - Set initial agent budgets
3. **Define company goals** - Create initial goals for agents
4. **Begin Phase 1** - Start core infrastructure implementation

---

*This document will be updated as implementation progresses.*

**Version:** 1.0
**Created:** March 2026
**Status:** AWAITING APPROVAL
