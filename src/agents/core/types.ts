// Agent Core Types

export type AgentStatus = 'active' | 'paused' | 'inactive';
export type GovernanceLevel = 'autonomous' | 'supervised';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type ExecutionStatus = 'success' | 'failure' | 'partial';
export type MemoryType = 'decision' | 'pattern' | 'context' | 'task';
export type MemoryCategory = 'decision' | 'pattern' | 'context' | 'task';
export type ToolCategory = 'communication' | 'analytics' | 'marketing' | 'dispatch' | 'content';

export interface AgentConfig {
  name: string;
  displayName: string;
  role: string;
  skillsPath: string;
  monthlyBudgetUsd: number;
  heartbeatCronExpr: string;
  permissions: string[];
  governanceLevel: GovernanceLevel;
}

export interface Skill {
  name: string;
  description: string;
  priority: number;
}

export interface ParsedSkills {
  name: string;
  description: string;
  skills: Skill[];
  systemPrompt: string;
}

export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enum?: string[];
  default?: unknown;
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
  permissions: string[];
  budgetRemaining: number;
  /** Optional traceability: the AgentExecution.id this tool call belongs to. */
  executionId?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  category: ToolCategory;
  permissions: string[];
  requiresApproval?: boolean;
  parameters: ToolParameter[];
  execute(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult>;
}

export interface HeartbeatResult {
  success: boolean;
  agentName: string;
  actionsExecuted: number;
  costUsd: number;
  errors: string[];
  nextHeartbeat: Date;
}

export interface TaskDelegation {
  fromAgentId: string;
  toAgent: string;
  title: string;
  description: string;
  priority: number;
  deadline?: Date;
}

export interface AgentDecision {
  agentId: string;
  decision: string;
  reasoning: string;
  status: TaskStatus;
  timestamp: Date;
}

export interface ExecutionLog {
  agentId: string;
  timestamp: Date;
  action: string;
  result: ExecutionStatus;
  cost: number;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface RelevantMemory extends MemoryEntry {
  relevanceScore: number;
}

export interface OrchestratorConfig {
  maxConcurrentHeartbeats: number;
  heartbeatTimeout: number;
}

export interface AgentRuntimeState {
  agentId: string;
  status: AgentStatus;
  lastHeartbeat: Date | null;
  nextHeartbeat: Date;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  toolName: string;
  params: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ApprovalResolution {
  requestId: string;
  approved: boolean;
  reason?: string;
}

export interface AgentTelegramCommand {
  command: string;
  args: string[];
}

export interface AgentStatusMessage {
  name: string;
  agentName: string;
  displayName: string;
  status: AgentStatus;
  lastHeartbeat: Date | null;
  pendingTasks: number;
  budgetUsed: number;
  budgetTotal: number;
}

export interface AgentListResponse {
  agents: AgentStatusMessage[];
  total: number;
}

export interface AgentDetailResponse {
  agent: AgentStatusMessage;
  metrics: Record<string, unknown>;
}

export interface TaskCreateRequest {
  title: string;
  description: string;
  priority: number;
  deadline?: Date;
}

export interface BudgetStatus {
  agentName: string;
  budgetUsed: number;
  monthlyBudget: number;
  percentageUsed: number;
  isPaused: boolean;
  isWarning: boolean;
  resetsAt: Date;
}
