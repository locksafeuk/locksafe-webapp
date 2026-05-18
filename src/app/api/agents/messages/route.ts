/**
 * Agent Messages API
 *
 * GET  - View inter-agent communication
 * POST - Send messages between agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromCookies } from '@/lib/agent-api-auth';
import { logAgentApiMutation } from '@/lib/agent-api-audit';
import {
  getAllMessages,
  getMessages,
  getSentMessages,
  sendMessage,
  shareInsight,
  broadcastMessage,
  acknowledgeMessage,
  getMessageBusStats,
  getConversationThread,
  type MessageType,
  type MessagePriority,
} from '@/agents/core/message-bus';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminFromCookies();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'all';
    const agentId = searchParams.get('agentId');
    const type = searchParams.get('type') as MessageType | null;
    const priority = searchParams.get('priority') as MessagePriority | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const correlationId = searchParams.get('correlationId');

    switch (action) {
      case 'all': {
        const messages = await getAllMessages({
          agentId: agentId || undefined,
          type: type || undefined,
          priority: priority || undefined,
          limit,
        });
        return NextResponse.json({
          success: true,
          data: { messages, count: messages.length },
          timestamp: new Date().toISOString(),
        });
      }

      case 'inbox': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId required for inbox' },
            { status: 400 }
          );
        }
        const inbox = await getMessages(agentId, {
          type: type || undefined,
          priority: priority || undefined,
          limit,
        });
        return NextResponse.json({
          success: true,
          data: { messages: inbox, count: inbox.length, agentId },
          timestamp: new Date().toISOString(),
        });
      }

      case 'outbox': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId required for outbox' },
            { status: 400 }
          );
        }
        const outbox = await getSentMessages(agentId, limit);
        return NextResponse.json({
          success: true,
          data: { messages: outbox, count: outbox.length, agentId },
          timestamp: new Date().toISOString(),
        });
      }

      case 'thread': {
        if (!correlationId) {
          return NextResponse.json(
            { success: false, error: 'correlationId required for thread' },
            { status: 400 }
          );
        }
        const thread = await getConversationThread(correlationId);
        return NextResponse.json({
          success: true,
          data: { messages: thread, count: thread.length, correlationId },
          timestamp: new Date().toISOString(),
        });
      }

      case 'stats': {
        const stats = await getMessageBusStats();
        return NextResponse.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid: all, inbox, outbox, thread, stats` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Messages GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminFromCookies();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'send': {
        const { fromAgent, toAgent, type, subject, body: msgBody, priority, metadata } = body;
        if (!fromAgent || !toAgent || !type || !subject) {
          return NextResponse.json(
            { success: false, error: 'fromAgent, toAgent, type, and subject are required' },
            { status: 400 }
          );
        }
        const message = await sendMessage(fromAgent, toAgent, type, subject, msgBody || '', {
          priority,
          metadata,
        });
        await logAgentApiMutation({
          admin,
          actionName: 'messages_send',
          targetAgentName: fromAgent,
          input: { fromAgent, toAgent, type, subject },
          output: { messageId: message.id, status: message.status },
        });
        return NextResponse.json({
          success: true,
          data: message,
          timestamp: new Date().toISOString(),
        });
      }

      case 'insight': {
        const { fromAgent: insFrom, toAgent: insTo, insight, category, data: insData } = body;
        if (!insFrom || !insTo || !insight) {
          return NextResponse.json(
            { success: false, error: 'fromAgent, toAgent, and insight are required' },
            { status: 400 }
          );
        }
        const msg = await shareInsight(insFrom, insTo, insight, category || 'general', insData);
        await logAgentApiMutation({
          admin,
          actionName: 'messages_insight',
          targetAgentName: insFrom,
          input: { fromAgent: insFrom, toAgent: insTo, category: category || 'general' },
          output: { messageId: msg.id, status: msg.status },
        });
        return NextResponse.json({
          success: true,
          data: msg,
          timestamp: new Date().toISOString(),
        });
      }

      case 'broadcast': {
        const { fromAgent: bFrom, type: bType, subject: bSubject, body: bBody, targets, priority: bPriority } = body;
        if (!bFrom || !bType || !bSubject) {
          return NextResponse.json(
            { success: false, error: 'fromAgent, type, and subject are required' },
            { status: 400 }
          );
        }
        const messages = await broadcastMessage(bFrom, bType, bSubject, bBody || '', targets, {
          priority: bPriority,
        });
        await logAgentApiMutation({
          admin,
          actionName: 'messages_broadcast',
          targetAgentName: bFrom,
          input: { fromAgent: bFrom, type: bType, subject: bSubject, targetCount: targets?.length },
          output: { count: messages.length },
        });
        return NextResponse.json({
          success: true,
          data: { messages, count: messages.length },
          timestamp: new Date().toISOString(),
        });
      }

      case 'acknowledge': {
        const { messageId } = body;
        if (!messageId) {
          return NextResponse.json(
            { success: false, error: 'messageId required' },
            { status: 400 }
          );
        }
        const acked = await acknowledgeMessage(messageId);
        await logAgentApiMutation({
          admin,
          actionName: 'messages_acknowledge',
          targetAgentName: 'ceo',
          input: { messageId },
          output: { acknowledged: acked },
        });
        return NextResponse.json({
          success: acked,
          data: { messageId, acknowledged: acked },
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid: send, insight, broadcast, acknowledge` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Messages POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
