"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Paperclip } from "lucide-react";

interface ChatMessage {
  id: string;
  jobId: string;
  senderType: "customer" | "locksmith" | "admin" | "system";
  senderName: string;
  body: string;
  attachmentUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

interface JobChatProps {
  jobId: string;
  viewerType: "customer" | "locksmith" | "admin";
  viewerId: string;
  viewerName: string;
}

export function JobChat({ jobId, viewerType, viewerId, viewerName }: JobChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      // ignore — will retry on next poll
    }
  }, [jobId]);

  // Initial load + polling every 5s (simple, works without WebSockets)
  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`/api/jobs/${jobId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderType: viewerType,
          senderId: viewerId,
          senderName: viewerName,
          messageBody: input.trim(),
        }),
      });
      setInput("");
      await fetchMessages();
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col h-full min-h-[400px] max-h-[600px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">Job Chat</h3>
        <p className="text-xs text-gray-500">Messages stay private — visible only to you and the locksmith</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 mt-8">No messages yet. Say hi!</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderType === viewerType;
          const isSystem = msg.senderType === "system" || msg.senderType === "admin";

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center">
                <span className="inline-block text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  {msg.body}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                {!isMine && (
                  <span className="text-xs text-gray-500 px-1">{msg.senderName}</span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm ${
                    isMine
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.body}
                  {msg.attachmentUrl && (
                    <a
                      href={msg.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-1 underline text-xs opacity-80"
                    >
                      View attachment
                    </a>
                  )}
                </div>
                <span className={`text-[10px] text-gray-400 px-1 ${isMine ? "text-right" : "text-left"}`}>
                  {formatTime(msg.createdAt)}
                  {isMine && msg.readAt && " · Read"}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-white">
        <button type="button" className="text-gray-400 hover:text-gray-600 p-1" title="Attach file (coming soon)" disabled>
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 text-sm bg-gray-100 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
          disabled={sending}
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-full p-2 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
