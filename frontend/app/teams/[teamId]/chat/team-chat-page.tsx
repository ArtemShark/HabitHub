"use client";

import { useEffect, useState } from "react";

type MessageDto = {
  messageId: string;
  senderId: string;
  content: string;
  sendDate: string;
};

type MemberBasicDto = {
  memberId: string;
  name: string;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export default function TeamChatPage({ teamId }: { teamId: string }) {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  const token = getToken();

  const fetchUserNames = async (messagesData: MessageDto[]) => {
    const uniqueSenderIds = [...new Set(messagesData.map((m) => m.senderId))];

    if (uniqueSenderIds.length === 0) {
      return;
    }

    const missingIds = uniqueSenderIds.filter((id) => !userMap[id]);
    if (missingIds.length === 0) {
      return;
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/members/info?ids=${missingIds.join(",")}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to load member names");
    }

    const users: MemberBasicDto[] = await res.json();

    setUserMap((prev) => {
      const updated = { ...prev };
      for (const user of users) {
        updated[user.memberId] = user.name;
      }
      return updated;
    });
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/teams/${teamId}/chat/messages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load messages: ${res.status} ${text}`);
      }

      const data: MessageDto[] = await res.json();
      setMessages(data);
      await fetchUserNames(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [teamId]);

  const sendMessage = async () => {
    if (!content.trim()) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/teams/${teamId}/chat/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const created: MessageDto = await res.json();

      setMessages((prev) => [...prev, created]);
      await fetchUserNames([created]);
      setContent("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Team Chat</h1>

        <div className="h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          {loading ? (
            <p className="text-zinc-400">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-zinc-400">No messages yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <div
                  key={msg.messageId}
                  className="rounded-xl bg-white/10 px-4 py-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {userMap[msg.senderId] ?? "Unknown User"}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(msg.sendDate).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-100">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a message..."
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
          />
          <button
            onClick={sendMessage}
            className="rounded-xl bg-indigo-500 px-5 py-3 font-medium hover:bg-indigo-400"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}