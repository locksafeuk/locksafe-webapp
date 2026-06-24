/**
 * Collaboration context for the heartbeat reasoning loop.
 *
 * Pulls the two cross-run/cross-agent signals that the agent loop historically
 * wrote but never read back — relevant memories and the unread inbox — and
 * renders them as prompt context so each heartbeat is actually informed by
 * prior runs and by messages from sibling agents.
 */
import { getRelevantMemories } from './memory';
import { getMessages } from './message-bus';

const MAX_MEMORIES = 5;
const MAX_MESSAGES = 5;

export async function buildCollaborationContext(
  agentName: string,
  query: string,
): Promise<string[]> {
  const parts: string[] = [];

  try {
    const memories = await getRelevantMemories(agentName, query, MAX_MEMORIES);
    if (memories.length > 0) {
      parts.push(
        `Relevant memory from prior runs:\n` +
          memories.map((m) => `- ${m.content}`).join('\n'),
      );
    }
  } catch {
    // Non-critical — proceed without memory context.
  }

  try {
    const inbox = await getMessages(agentName, { limit: MAX_MESSAGES });
    const unread = inbox.filter((m) => m.status !== 'acknowledged');
    if (unread.length > 0) {
      parts.push(
        `Unread messages from other agents (act on or acknowledge):\n` +
          unread
            .map(
              (m) =>
                `- [${m.priority}] from ${m.fromAgentId} (${m.type}): ${m.subject} — ${m.body.slice(0, 200)}`,
            )
            .join('\n'),
      );
    }
  } catch {
    // Non-critical — proceed without inbox context.
  }

  return parts;
}
