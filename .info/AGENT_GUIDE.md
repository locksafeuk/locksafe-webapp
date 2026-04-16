# LockSafe AI Agent Operating System - User Guide

## Overview

The LockSafe AI Agent System is inspired by autonomous AI architectures. It features:
- **6 AI Agents** with specialized roles
- **21 Tools** for executing tasks
- **Heartbeat System** for scheduled autonomous execution
- **Task Delegation** for human-to-agent and agent-to-agent communication

## Agent Hierarchy

```
CEO Agent (Strategic Coordination)
├── CMO Agent (Marketing)
│   ├── Copywriter Agent (Content creation)
│   └── Ads Specialist Agent (Campaign management)
├── COO Agent (Operations)
│   └── (Future: Dispatch Optimizer, Quality Monitor)
└── CTO Agent (Technical/Platform)
```

## How Agents Work

### 1. Heartbeat System
Each agent has a scheduled "heartbeat" - a periodic execution cycle where the agent:
1. Reviews pending tasks
2. Analyzes current metrics
3. Makes decisions using AI (GPT-4)
4. Executes tools to take actions
5. Stores memories for future reference

**Heartbeat Schedules:**
- CEO: Every 4 hours
- CMO: Every 2 hours
- COO: Every 30 minutes (operations monitoring)
- CTO: Every 4 hours
- Copywriter: Every 2 hours
- Ads Specialist: Every 2 hours

### 2. Task System
Tasks are the primary way to give agents work:

**Task Properties:**
- `title`: What needs to be done
- `description`: Detailed instructions
- `priority`: 1-10 (10 = highest)
- `deadline`: Optional due date
- `companyGoalId`: Links task to company OKRs

**Task Flow:**
```
pending → in_progress → completed/failed
```

### 3. Tool Execution
Agents can only use tools they have permission for:

**CEO Tools:** Dashboard stats, summaries, alerts, communication
**CMO Tools:** Marketing stats, content generation, campaigns
**COO Tools:** Job stats, dispatch, locksmith management
**CTO Tools:** Technical monitoring, system health

## Using the System

### Method 1: Manual Heartbeat (Admin Dashboard)

1. Go to `/admin/agents`
2. Click "Force Run All" to run all agents immediately
3. View results in the Heartbeat Results card

### Method 2: Create Tasks (Admin Dashboard)

1. Go to `/admin/agents/tasks`
2. Click "Create Task"
3. Select an agent and provide:
   - Title: Clear action item
   - Description: Detailed context
   - Priority: 1-10

### Method 3: API Calls

**Create a Task:**
```bash
POST /api/agents/tasks
{
  "agentId": "<agent-id>",
  "title": "Generate weekly social content",
  "description": "Create 5 social posts about locksmith tips and anti-fraud awareness",
  "priority": 7
}
```

**Run Heartbeat:**
```bash
POST /api/agents/heartbeat
{
  "force": true  // Run all agents regardless of schedule
}
```

## Example Tasks by Agent

### CEO Agent Tasks
- "Analyze weekly performance and provide strategic recommendations"
- "Review marketing ROI and reallocate budget if needed"
- "Generate executive summary for stakeholders"

### CMO Agent Tasks
- "Generate 5 social media posts about locksmith safety"
- "Analyze campaign performance and pause underperformers"
- "Create ad copy variations for emergency locksmith service"

### COO Agent Tasks
- "Monitor job dispatch efficiency and identify bottlenecks"
- "Check locksmith availability across service areas"
- "Review customer complaints and identify patterns"

### CTO Agent Tasks
- "Check platform performance metrics"
- "Review error logs and identify issues"
- "Monitor API response times"

## Governance Levels

1. **Autonomous**: Agent acts independently within budget
2. **Supervised**: Actions are logged for review
3. **Approval Required**: Human must approve before execution

## Budget System

Each agent has:
- **Monthly Budget**: Max spend on AI tokens per month
- **Per-Task Limit**: Max spend per single task

Agents automatically pause when budget is exhausted.

## Best Practices

1. **Be Specific**: Give clear, actionable task descriptions
2. **Set Priorities**: Use priority 8-10 for urgent tasks
3. **Monitor Results**: Check execution logs for outcomes
4. **Use Deadlines**: Set realistic deadlines for time-sensitive tasks
5. **Link to Goals**: Connect tasks to company goals for tracking

## Troubleshooting

**Agents not running?**
- Check agent status is "active"
- Verify budget has remaining balance
- Run "Force Run All" to trigger immediately

**Tasks stuck in pending?**
- Agent heartbeat may not have run yet
- Force a heartbeat from the dashboard

**Errors in execution?**
- Check the Execution Log tab
- Review error messages in heartbeat results
- Verify required data exists (jobs, locksmiths, etc.)
