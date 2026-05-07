import { render, screen, fireEvent, waitFor } from "@testing-library/react";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://test";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const TeamChatPage = require("./team-chat-page").default;

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function noContentResponse() {
  return {
    ok: true,
    status: 204,
    headers: {
      get: () => null,
    },
    json: async () => undefined,
    text: async () => "",
  };
}

const TEAM_ID = "team-123";
const USER_ID = "user-123";

describe("TeamChatPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", createFakeJwt({ sub: USER_ID }));

    // scrollIntoView is not implemented in jsdom
    Element.prototype.scrollIntoView = jest.fn();
  });

  function setupFetchForMessages(
    messages: unknown[] = [],
    teams: unknown[] = []
  ) {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (
          url === `http://test/api/teams/${TEAM_ID}/chat/messages` &&
          (!init?.method || init.method === "GET")
        ) {
          return jsonResponse(messages);
        }

        if (
          url === "http://test/api/teams" &&
          (!init?.method || init.method === "GET")
        ) {
          return jsonResponse(teams);
        }

        throw new Error(`Unhandled fetch URL: ${url}`);
      }
    );
  }

  it("loads and displays messages with sender names from the API", async () => {
    setupFetchForMessages(
      [
        {
          messageId: "msg-1",
          senderId: "chat-user-a",
          senderName: "Alice",
          content: "Hello team!",
          sendDate: "2026-04-22T10:00:00Z",
        },
        {
          messageId: "msg-2",
          senderId: "chat-user-b",
          senderName: "Bob",
          content: "How is everyone?",
          sendDate: "2026-04-22T10:05:00Z",
        },
      ],
      [{ habitTeamId: TEAM_ID, creatorId: "other-creator" }]
    );

    render(<TeamChatPage teamId={TEAM_ID} />);

    expect(screen.getByText(/loading messages/i)).toBeInTheDocument();

    expect(await screen.findByText("Hello team!")).toBeInTheDocument();
    expect(await screen.findByText("How is everyone?")).toBeInTheDocument();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(await screen.findByText("Bob")).toBeInTheDocument();
  });

  it("sends a message and appends it to the list", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (
          url === `http://test/api/teams/${TEAM_ID}/chat/messages` &&
          (!init?.method || init.method === "GET")
        ) {
          return jsonResponse([]);
        }

        if (
          url === `http://test/api/teams/${TEAM_ID}/chat/messages` &&
          init?.method === "POST"
        ) {
          return jsonResponse(
            {
              messageId: "msg-new",
              senderId: USER_ID,
              senderName: "TestUser",
              content: "Test message",
              sendDate: "2026-04-23T11:00:00Z",
            },
            201
          );
        }

        if (url === "http://test/api/teams") {
          return jsonResponse([]);
        }

        throw new Error(`Unhandled fetch URL: ${url}`);
      }
    );

    render(<TeamChatPage teamId={TEAM_ID} />);

    await waitFor(() => {
      expect(screen.queryByText(/loading messages/i)).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      /write a message/i
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Test message")).toBeInTheDocument();
    expect(input.value).toBe("");
  });

  it("does not call the backend when no token is present", async () => {
    localStorage.clear();
    sessionStorage.clear();

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<TeamChatPage teamId={TEAM_ID} />);

    await waitFor(() => {
      expect(screen.queryByText(/loading messages/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/you must be logged in/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles a server error on load without crashing", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/chat/messages")) {
        return {
          ok: false,
          status: 500,
          headers: { get: () => null },
          text: async () => "Server error",
          json: async () => ({}),
        };
      }
      if (url === "http://test/api/teams") {
        return jsonResponse([]);
      }
      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<TeamChatPage teamId={TEAM_ID} />);

    await waitFor(() => {
      expect(screen.queryByText(/loading messages/i)).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("heading", { name: /team chat/i })
    ).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("deletes own message when delete button is clicked", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (
          url === `http://test/api/teams/${TEAM_ID}/chat/messages` &&
          (!init?.method || init.method === "GET")
        ) {
          return jsonResponse([
            {
              messageId: "msg-own",
              senderId: USER_ID,
              senderName: "TestUser",
              content: "My message",
              sendDate: "2026-04-22T10:00:00Z",
            },
          ]);
        }

        if (url === "http://test/api/teams") {
          return jsonResponse([
            { habitTeamId: TEAM_ID, creatorId: "other-user" },
          ]);
        }

        if (
          url ===
            `http://test/api/teams/${TEAM_ID}/chat/messages/msg-own` &&
          init?.method === "DELETE"
        ) {
          return noContentResponse();
        }

        throw new Error(`Unhandled fetch URL: ${url}`);
      }
    );

    render(<TeamChatPage teamId={TEAM_ID} />);

    expect(await screen.findByText("My message")).toBeInTheDocument();

    const deleteBtn = screen.getByLabelText(/delete message/i);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.queryByText("My message")).not.toBeInTheDocument();
    });
  });

  it("sends a message with Enter key", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (
          url === `http://test/api/teams/${TEAM_ID}/chat/messages` &&
          (!init?.method || init.method === "GET")
        ) {
          return jsonResponse([]);
        }

        if (
          url === `http://test/api/teams/${TEAM_ID}/chat/messages` &&
          init?.method === "POST"
        ) {
          return jsonResponse(
            {
              messageId: "msg-enter",
              senderId: USER_ID,
              senderName: "TestUser",
              content: "Enter key msg",
              sendDate: "2026-04-23T11:00:00Z",
            },
            201
          );
        }

        if (url === "http://test/api/teams") {
          return jsonResponse([]);
        }

        throw new Error(`Unhandled fetch URL: ${url}`);
      }
    );

    render(<TeamChatPage teamId={TEAM_ID} />);

    await waitFor(() => {
      expect(screen.queryByText(/loading messages/i)).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/write a message/i);
    fireEvent.change(input, { target: { value: "Enter key msg" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(await screen.findByText("Enter key msg")).toBeInTheDocument();
  });
});
