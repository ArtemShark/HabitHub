import { render, screen, fireEvent, waitFor } from "@testing-library/react";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://test";

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock("framer-motion", () => {
  const React = require("react");
  const cleanProps = (props: Record<string, unknown>) => {
    const {
      whileHover,
      whileTap,
      layout,
      initial,
      animate,
      exit,
      transition,
      variants,
      ...rest
    } = props;
    return rest;
  };

  const MockMotionComponent = React.forwardRef(
    (
      { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.Ref<HTMLElement>
    ) => React.createElement("div", { ...cleanProps(props), ref }, children)
  );

  return {
    motion: new Proxy({}, { get: () => MockMotionComponent }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock("../notifications/NotificationDropdown", () => {
  return function MockNotificationDropdown() {
    return <div data-testid="notification-dropdown">Notifications</div>;
  };
});

const HomePage = require("./page").default;

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

function textResponse(text: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type" ? "text/plain" : null,
    },
    json: async () => {
      throw new Error("not json");
    },
    text: async () => text,
  };
}

describe("DashboardPage integration-style tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();

    window.scrollTo = jest.fn();

    localStorage.clear();
    sessionStorage.clear();

    localStorage.setItem("token", createFakeJwt({ sub: "user-123" }));
    localStorage.setItem("sessionId", "session-1");
  });

  it("loads habits through the real helper chain and renders mapped goal data", async () => {
    const today = new Date().toISOString().split("T")[0];

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/sessions") {
        return jsonResponse([
          {
            sessionId: "session-1",
            memberId: "user-123",
            device: "Chrome on Windows",
            ipAddress: "127.0.0.1",
            state: "Active",
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        ]);
      }

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-value",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Drink Water",
            goal: "8",
            habitState: "active",
            expiryDate: null,
            habitType: "quantitative",
            unit: "cups",
          },
          {
            habitId: "habit-binary",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Read Book",
            goal: null,
            habitState: "active",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      // important: not logged today yet, so UI shows target text
      if (url === `http://test/api/habits/habit-value/entries?date=${today}`) {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits/habit-value/entries") {
        return jsonResponse([
          {
            habitEntryId: "av1",
            habitId: "habit-value",
            memberId: "user-123",
            value: 8,
            status: "Logged",
            notes: "done",
            date: `${today}T08:00:00Z`,
          },
        ]);
      }

      if (url === `http://test/api/habits/habit-binary/entries?date=${today}`) {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits/habit-binary/entries") {
        return jsonResponse([
          {
            habitEntryId: "ab1",
            habitId: "habit-binary",
            memberId: "user-123",
            status: "Skipped",
            notes: "missed",
            date: `${today}T10:00:00Z`,
          },
        ]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HomePage />);

    expect(screen.getByText(/loading habits/i)).toBeInTheDocument();

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();
    expect(await screen.findByText("Read Book")).toBeInTheDocument();

    expect(screen.getByText((content) => content.includes("Target: 8 cups"))).toBeInTheDocument();
    expect(screen.getByText("Still in progress")).toBeInTheDocument();

    expect(screen.getByText("Today's Progress")).toBeInTheDocument();
    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
    expect(screen.getByText("Habit Coverage")).toBeInTheDocument();

    expect(await screen.findByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText(/current session/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /terminate session/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    const habitsCall = mockFetch.mock.calls.find(
      ([url]) => String(url) === "http://test/api/habits?memberId=user-123"
    );

    expect(habitsCall).toBeDefined();

    const [, habitsOptions] = habitsCall!;
    expect((habitsOptions as RequestInit).cache).toBe("no-store");
    expect((habitsOptions as RequestInit).method).toBe("GET");
    expect(((habitsOptions as RequestInit).headers as Headers).get("Authorization")).toContain("Bearer");
  });

  it("submits a quantitative habit log through the real apiFetch flow", async () => {
    const today = new Date().toISOString().split("T")[0];

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/sessions") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-value",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Drink Water",
            goal: "8",
            habitState: "active",
            expiryDate: null,
            habitType: "quantitative",
            unit: "cups",
          },
        ]);
      }

      if (url === `http://test/api/habits/habit-value/entries?date=${today}`) {
        return jsonResponse([]);
      }

      if (
        url === "http://test/api/habits/habit-value/entries" &&
        (!init?.method || init.method === "GET")
      ) {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits/habit-value/entries" && init?.method === "POST") {
        return jsonResponse({
          habitEntryId: "created-1",
          habitId: "habit-value",
          memberId: "user-123",
          value: 6,
          status: "Logged",
          notes: "Felt good",
          date: `${today}T12:00:00Z`,
        });
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HomePage />);

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Drink Water"));
    expect(await screen.findByText(/log habit/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/enter value/i), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByPlaceholderText(/optional note/i), {
      target: { value: "Felt good" },
    });

    fireEvent.click(screen.getByText(/save log/i));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    const postCall = mockFetch.mock.calls.find(
      ([url, options]) =>
        String(url) === "http://test/api/habits/habit-value/entries" &&
        (options as RequestInit)?.method === "POST"
    );

    expect(postCall).toBeDefined();

    const [postUrl, postOptions] = postCall!;
    expect(String(postUrl)).toBe("http://test/api/habits/habit-value/entries");
    expect((postOptions as RequestInit).method).toBe("POST");
    expect((postOptions as RequestInit).body).toBe(
      JSON.stringify({
        status: "Logged",
        value: 6,
        notes: "Felt good",
      })
    );

    await waitFor(() => {
      expect(screen.queryByText(/log habit/i)).not.toBeInTheDocument();
    });
  });


  it("allows undoing today's own habit log from Today's Goals", async () => {
    const today = new Date().toISOString().split("T")[0];

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/sessions") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-binary",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Read Book",
            goal: null,
            habitState: "active",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === `http://test/api/habits/habit-binary/entries?date=${today}`) {
        return jsonResponse([
          {
            habitEntryId: "today-entry-1",
            habitId: "habit-binary",
            memberId: "user-123",
            status: "Logged",
            notes: "done today",
            date: `${today}T09:00:00Z`,
          },
        ]);
      }

      if (
        url === "http://test/api/habits/habit-binary/entries" &&
        (!init?.method || init.method === "GET")
      ) {
        return jsonResponse([
          {
            habitEntryId: "today-entry-1",
            habitId: "habit-binary",
            memberId: "user-123",
            status: "Logged",
            notes: "done today",
            date: `${today}T09:00:00Z`,
          },
        ]);
      }

      if (
        url === "http://test/api/habits/habit-binary/entries/today-entry-1" &&
        init?.method === "DELETE"
      ) {
        return {
          ok: true,
          status: 204,
          headers: { get: () => null },
          text: async () => "",
        };
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HomePage />);

    expect(await screen.findByText("Read Book")).toBeInTheDocument();
    expect(await screen.findByText("Completed today")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /undo/i }));

    await waitFor(() => {
      expect(screen.queryByText("Completed today")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Still in progress")).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test/api/habits/habit-binary/entries/today-entry-1",
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("does not treat another member's today's log as my completed dashboard goal", async () => {
    const today = new Date().toISOString().split("T")[0];

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/sessions") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-binary",
            habitTeamId: "team-1",
            creatorId: "creator-1",
            name: "Read Book",
            goal: null,
            habitState: "active",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === `http://test/api/habits/habit-binary/entries?date=${today}`) {
        return jsonResponse([
          {
            habitEntryId: "other-entry-1",
            habitId: "habit-binary",
            memberId: "other-user",
            status: "Logged",
            notes: "someone else",
            date: `${today}T09:00:00Z`,
          },
        ]);
      }

      if (
        url === "http://test/api/habits/habit-binary/entries" &&
        (!init?.method || init.method === "GET")
      ) {
        return jsonResponse([
          {
            habitEntryId: "other-entry-1",
            habitId: "habit-binary",
            memberId: "other-user",
            status: "Logged",
            notes: "someone else",
            date: `${today}T09:00:00Z`,
          },
        ]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HomePage />);

    expect(await screen.findByText("Read Book")).toBeInTheDocument();
    expect(screen.getByText("Still in progress")).toBeInTheDocument();
    expect(screen.queryByText("Completed today")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
  });

  it("terminates a session and removes it from the dashboard", async () => {
    const today = new Date().toISOString().split("T")[0];

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/sessions" && (!init?.method || init.method === "GET")) {
        return jsonResponse([
          {
            sessionId: "session-2",
            memberId: "user-123",
            device: "Firefox on Linux",
            ipAddress: "127.0.0.2",
            state: "Active",
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        ]);
      }

      if (url === "http://test/api/sessions/session-2" && init?.method === "DELETE") {
        return {
          ok: true,
          status: 204,
          headers: { get: () => null },
          text: async () => "",
        };
      }

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HomePage />);

    expect(await screen.findByText("Firefox on Linux")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /terminate session/i }));

    await waitFor(() => {
      expect(screen.queryByText("Firefox on Linux")).not.toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test/api/sessions/session-2",
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("shows the real apiFetch error message when the habits request fails", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Server exploded", 500));

    render(<HomePage />);

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
  });

  it("shows user-id error when no token is available for the real getCurrentUserId flow", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return textResponse("Server exploded", 500);
      }

      if (url === "http://test/api/sessions") {
        return jsonResponse([]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    localStorage.clear();
    sessionStorage.clear();

    render(<HomePage />);

    expect(await screen.findByText(/could not determine current user/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});