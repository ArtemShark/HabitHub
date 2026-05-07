"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "../../../auxiliary/apiFetch";
import { getCurrentUserId } from "../../../auxiliary/getCurrentUserId";

type MessageDto = {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  sendDate: string;
};

type TeamInfo = {
  creatorId: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function TeamChatPage({ teamId }: { teamId: string }) {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamCreatorId, setTeamCreatorId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const currentUserId = getCurrentUserId();

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API}/api/teams/${teamId}/chat/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data: MessageDto[] = await res.json();
      setMessages(data);
    } catch {
      // Silently fail on poll errors
    }
  }, [teamId]);

  // Fetch team info to determine if current user is creator
  useEffect(() => {
    async function fetchTeamInfo() {
      const token = getToken();
      if (!token) return;

      try {
        const res = await fetch(`${API}/api/teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const teams = await res.json();
        const team = teams.find(
          (t: { habitTeamId: string }) => t.habitTeamId === teamId
        );
        if (team) {
          setTeamCreatorId(team.creatorId);
        }
      } catch {
        // Non-critical, moderation features just won't show
      }
    }

    void fetchTeamInfo();
  }, [teamId]);

  // Initial load
  useEffect(() => {
    async function loadMessages() {
      const token = getToken();
      if (!token) {
        setError("You must be logged in to view the chat.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API}/api/teams/${teamId}/chat/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 403) {
          setError("You don't have access to this team's chat.");
          return;
        }

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to load messages: ${res.status} ${text}`);
        }

        const data: MessageDto[] = await res.json();
        setMessages(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load messages. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadMessages();
  }, [teamId]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const sendMessage = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    const token = getToken();
    if (!token) return;

    setSending(true);
    try {
      const res = await fetch(`${API}/api/teams/${teamId}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const created: MessageDto = await res.json();
      setMessages((prev) => [...prev, created]);
      setContent("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    const token = getToken();
    if (!token) return;

    setDeletingId(messageId);
    try {
      const res = await fetch(
        `${API}/api/teams/${teamId}/chat/messages/${messageId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.status === 204 || res.ok) {
        setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
      } else {
        const data = await res.json().catch(() => null);
        const errorCode = data?.error;
        if (errorCode === "message-not-own") {
          alert("You can only delete your own messages.");
        } else if (errorCode === "message-not-found") {
          // Message was already deleted; remove from local state
          setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
        } else {
          alert("Failed to delete message.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete message.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const isCreator = currentUserId != null && currentUserId === teamCreatorId;

  const canDeleteMessage = (msg: MessageDto) => {
    if (!currentUserId) return false;
    // Creator can delete any message; members can delete their own
    if (isCreator) return true;
    return msg.senderId === currentUserId;
  };

  const isOwnMessage = (msg: MessageDto) => {
    return currentUserId != null && msg.senderId === currentUserId;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex h-screen max-w-3xl flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/teams")}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M12.5 15L7.5 10L12.5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold">Team Chat</h1>
              <p className="text-xs text-zinc-500">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
                {isCreator && (
                  <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                    Admin
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-400" />
                <p className="text-sm text-zinc-500">Loading messages...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="mb-1 text-lg text-zinc-500">No messages yet</p>
                <p className="text-sm text-zinc-600">
                  Be the first to say something!
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {messages.map((msg, index) => {
                const own = isOwnMessage(msg);
                const showName =
                  index === 0 ||
                  messages[index - 1].senderId !== msg.senderId;
                const isLastInGroup =
                  index === messages.length - 1 ||
                  messages[index + 1]?.senderId !== msg.senderId;

                return (
                  <div
                    key={msg.messageId}
                    className={`group flex ${own ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`relative max-w-[75%] ${showName ? "mt-3" : "mt-0.5"}`}
                    >
                      {/* Sender name */}
                      {showName && !own && (
                        <p className="mb-1 ml-1 text-xs font-semibold text-indigo-400">
                          {msg.senderName || "Unknown User"}
                        </p>
                      )}
                      {showName && own && (
                        <p className="mb-1 mr-1 text-right text-xs font-semibold text-emerald-400">
                          You
                        </p>
                      )}

                      <div className="flex items-end gap-1.5">
                        {/* Delete button – shown on hover, before the bubble for own messages */}
                        {own && canDeleteMessage(msg) && (
                          <button
                            onClick={() => deleteMessage(msg.messageId)}
                            disabled={deletingId === msg.messageId}
                            className="mb-1 flex-shrink-0 rounded p-1 text-zinc-600 opacity-0 transition hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                            title="Delete message"
                            aria-label="Delete message"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        )}

                        {/* Message bubble */}
                        <div
                          className={`px-3.5 py-2 ${
                            own
                              ? "rounded-2xl rounded-br-md bg-indigo-600 text-white"
                              : "rounded-2xl rounded-bl-md bg-zinc-800 text-zinc-100"
                          } ${isLastInGroup ? "" : ""}`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {msg.content}
                          </p>
                          <p
                            className={`mt-1 text-[10px] ${
                              own ? "text-indigo-200/60" : "text-zinc-500"
                            }`}
                          >
                            {formatTime(msg.sendDate)}
                          </p>
                        </div>

                        {/* Delete button for others' messages (creator moderation) */}
                        {!own && canDeleteMessage(msg) && (
                          <button
                            onClick={() => deleteMessage(msg.messageId)}
                            disabled={deletingId === msg.messageId}
                            className="mb-1 flex-shrink-0 rounded p-1 text-zinc-600 opacity-0 transition hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                            title="Delete message (Admin)"
                            aria-label="Delete message"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message..."
              maxLength={2000}
              disabled={!!error}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!content.trim() || sending || !!error}
              className="flex h-[46px] items-center gap-2 rounded-xl bg-indigo-600 px-5 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
              Send
            </button>
          </div>
          {content.length > 1800 && (
            <p className="mt-1 text-right text-xs text-zinc-500">
              {content.length}/2000
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
