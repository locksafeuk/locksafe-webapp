"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";

type QueueView = "all" | "unread" | "urgent" | "mine" | "unassigned";
type SendMode = "text" | "template";

interface Conversation {
  id: string;
  phone: string;
  waId: string | null;
  contactName: string | null;
  assignedAdminId: string | null;
  assignedAdminEmail: string | null;
  assignedAdminName: string | null;
  assignedAt: string | null;
  isUrgent: boolean;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  _count: { messages: number };
}

interface InboxAssignee {
  id: string;
  name: string;
  email: string;
}

interface ConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  messageType: string;
  content: string | null;
  providerMessageId: string | null;
  status: string | null;
  createdAt: string;
}

interface ConversationPayload {
  conversation: Omit<Conversation, "_count" | "createdAt"> & { unreadCount: number };
  messages: ConversationMessage[];
}

export default function AdminWhatsAppInboxPage() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [assignees, setAssignees] = useState<InboxAssignee[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [queueView, setQueueView] = useState<QueueView>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationMeta, setConversationMeta] = useState<ConversationPayload["conversation"] | null>(null);
  const [sendMode, setSendMode] = useState<SendMode>("text");
  const [messageText, setMessageText] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en_GB");
  const [templateParametersInput, setTemplateParametersInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [savingUrgency, setSavingUrgency] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const fetchConversations = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    params.set("view", queueView);
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }

    const res = await fetch(`/api/admin/whatsapp/conversations?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to load conversations");
    }

    const nextConversations = (data.conversations || []) as Conversation[];
    setConversations(nextConversations);
    setAssignees((data.assignees || []) as InboxAssignee[]);
    setCurrentAdminId(typeof data.currentAdminId === "string" ? data.currentAdminId : null);

    if (nextConversations.length === 0) {
      setSelectedId(null);
      setMessages([]);
      setConversationMeta(null);
      return;
    }

    if (!selectedId || !nextConversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(nextConversations[0].id);
    }
  }, [queueView, searchQuery, selectedId]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/admin/whatsapp/conversations/${conversationId}/messages`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to load messages");
    }
    setMessages(data.messages || []);
    setConversationMeta(data.conversation || null);
    await fetch(`/api/admin/whatsapp/conversations/${conversationId}/mark-read`, {
      method: "POST",
    }).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    );
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load WhatsApp inbox");
    } finally {
      setLoading(false);
    }
  }, [fetchConversations]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setConversationMeta(null);
      return;
    }
    fetchMessages(selectedId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    });
  }, [selectedId, fetchMessages]);

  const handleSend = async () => {
    if (!selectedId || sending) return;

    if (sendMode === "text" && !messageText.trim()) {
      return;
    }

    if (sendMode === "template" && !templateName.trim()) {
      setError("Template name is required");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const templateParameters = templateParametersInput
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const res = await fetch(`/api/admin/whatsapp/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sendMode === "text"
            ? { sendMode: "text", text: messageText.trim() }
            : {
                sendMode: "template",
                templateName: templateName.trim(),
                templateLanguage: templateLanguage.trim() || "en_GB",
                templateParameters,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message");
      }

      if (sendMode === "text") {
        setMessageText("");
      }

      await Promise.all([fetchConversations(), fetchMessages(selectedId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleAssignConversation = async (assigneeId: string) => {
    if (!selectedId || savingAssignee) return;

    setSavingAssignee(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: assigneeId === "unassigned" ? null : assigneeId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to assign conversation");
      }

      await Promise.all([fetchConversations(), fetchMessages(selectedId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign conversation");
    } finally {
      setSavingAssignee(false);
    }
  };

  const handleToggleUrgent = async () => {
    if (!selectedId || !conversationMeta || savingUrgency) return;

    setSavingUrgency(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isUrgent: !conversationMeta.isUrgent }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update urgency");
      }

      await Promise.all([fetchConversations(), fetchMessages(selectedId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update urgency");
    } finally {
      setSavingUrgency(false);
    }
  };

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <AdminSidebar>
      <div className="p-4 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">WhatsApp Inbox</h1>
            <p className="text-sm text-slate-600">Integrated admin messaging powered by WhatsApp Business API.</p>
          </div>
          <Button variant="outline" onClick={refreshAll} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
          <Select value={queueView} onValueChange={(value) => setQueueView(value as QueueView)}>
            <SelectTrigger>
              <SelectValue placeholder="Queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conversations</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="mine">Assigned To Me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by contact name, phone, or WA ID"
          />

          <div className="self-center text-right text-xs text-slate-500">
            {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Conversations ({conversations.length})
            </div>
            <div className="max-h-[68vh] overflow-y-auto">
              {conversations.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-slate-500">No conversations yet.</div>
              )}
              {conversations.map((conversation) => {
                const active = conversation.id === selectedId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedId(conversation.id)}
                    className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors ${
                      active ? "bg-orange-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {conversation.contactName || conversation.phone}
                        </div>
                        <div className="truncate text-xs text-slate-500">{conversation.phone}</div>
                        <div className="mt-1 flex items-center gap-1">
                          {conversation.isUrgent && (
                            <Badge className="border-red-200 bg-red-100 text-red-700">Urgent</Badge>
                          )}
                          {conversation.assignedAdminName && (
                            <Badge variant="outline" className="text-[10px]">
                              {conversation.assignedAdminName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] text-slate-500">{formatDateTime(conversation.lastMessageAt)}</span>
                        {conversation.unreadCount > 0 && (
                          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-600">
                      {conversation.lastMessagePreview || "No preview"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {!selectedId || !conversationMeta ? (
              <div className="flex h-[68vh] flex-col items-center justify-center text-slate-500">
                <MessageCircle className="mb-3 h-8 w-8" />
                <p className="text-sm">Select a conversation to view messages.</p>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {selectedConversation?.contactName || conversationMeta.phone}
                      </div>
                      <div className="text-xs text-slate-500">{conversationMeta.phone}</div>
                      <div className="mt-1 flex items-center gap-1">
                        {conversationMeta.isUrgent && (
                          <Badge className="border-red-200 bg-red-100 text-red-700">Urgent</Badge>
                        )}
                        {conversationMeta.assignedAdminName ? (
                          <Badge variant="outline" className="text-[10px]">
                            Assigned: {conversationMeta.assignedAdminName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-slate-500">
                            Unassigned
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_auto]">
                      <Select
                        value={conversationMeta.assignedAdminId || "unassigned"}
                        onValueChange={handleAssignConversation}
                        disabled={savingAssignee}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Assign owner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {assignees.map((assignee) => (
                            <SelectItem key={assignee.id} value={assignee.id}>
                              {assignee.name}
                              {assignee.id === currentAdminId ? " (Me)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant={conversationMeta.isUrgent ? "destructive" : "outline"}
                        onClick={handleToggleUrgent}
                        disabled={savingUrgency}
                        className="gap-2"
                      >
                        {savingUrgency ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                        {conversationMeta.isUrgent ? "Urgent" : "Mark Urgent"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="h-[54vh] overflow-y-auto bg-slate-50 p-4">
                  {messages.length === 0 && (
                    <div className="py-10 text-center text-sm text-slate-500">No messages in this thread yet.</div>
                  )}
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          message.direction === "outbound"
                            ? "ml-auto bg-orange-500 text-white"
                            : "bg-white text-slate-800"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {message.content || `[${message.messageType}]`}
                        </div>
                        <div
                          className={`mt-1 text-[10px] ${
                            message.direction === "outbound" ? "text-orange-100" : "text-slate-400"
                          }`}
                        >
                          {formatDateTime(message.createdAt)}
                          {message.direction === "outbound" && message.status ? ` · ${message.status}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 p-3">
                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[170px_170px_minmax(0,1fr)]">
                    <Select value={sendMode} onValueChange={(value) => setSendMode(value as SendMode)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Send mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Free Text</SelectItem>
                        <SelectItem value="template">Template</SelectItem>
                      </SelectContent>
                    </Select>

                    {sendMode === "template" && (
                      <Input
                        value={templateLanguage}
                        onChange={(e) => setTemplateLanguage(e.target.value)}
                        placeholder="Language code"
                      />
                    )}
                  </div>

                  {sendMode === "template" && (
                    <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Approved template name"
                      />
                      <textarea
                        value={templateParametersInput}
                        onChange={(e) => setTemplateParametersInput(e.target.value)}
                        placeholder="Template body parameters (one per line)"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={sendMode === "text" ? "Type a WhatsApp reply..." : "Optional note for your own context"}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={
                        sending ||
                        (sendMode === "text" && !messageText.trim()) ||
                        (sendMode === "template" && !templateName.trim())
                      }
                      className="gap-2 self-end"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sendMode === "template" ? "Send Template" : "Send"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
