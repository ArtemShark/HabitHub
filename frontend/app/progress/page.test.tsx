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

const ProgressPage = require("./page").default;

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

describe("ProgressPage integration-style tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", createFakeJwt({ sub: "user-123" }));
  });

  it("loads habits, entries, and member names through the real helper chain", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-water",
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
            habitId: "habit-read",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Read Book",
            goal: null,
            habitState: "archived",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-water/entries") {
        return jsonResponse([
          {
            habitEntryId: "entry-1",
            habitId: "habit-water",
            memberId: "member-alpha",
            value: 7,
            status: "Logged",
            notes: "Almost reached goal",
            date: "2026-04-22T09:00:00Z",
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-read/entries") {
        return jsonResponse([
          {
            habitEntryId: "entry-2",
            habitId: "habit-read",
            memberId: "member-beta",
            status: "Skipped",
            notes: "Busy day",
            date: "2026-04-21T18:00:00Z",
          },
        ]);
      }

      if (url === "http://test/api/members/info?ids=member-alpha,member-beta") {
        return jsonResponse([
          { memberId: "member-alpha", name: "Alice" },
          { memberId: "member-beta", name: "Bob" },
        ]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<ProgressPage />);

    expect(screen.getByText(/loading progress/i)).toBeInTheDocument();

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();
    expect(await screen.findByText("Read Book")).toBeInTheDocument();

    expect(screen.getByText("quantitative")).toBeInTheDocument();
    expect(screen.getByText("binary")).toBeInTheDocument();
    expect(screen.getByText("Goal: 8 cups")).toBeInTheDocument();
    expect(screen.getByText("Drink Water Logs")).toBeInTheDocument();
    expect(screen.getByText(/member: alice/i)).toBeInTheDocument();
    expect(screen.getByText("Almost reached goal")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  it("filters habits using the real search and status controls", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-water-2",
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
            habitId: "habit-read-2",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Read Book",
            goal: null,
            habitState: "archived",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-water-2/entries") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits/habit-read-2/entries") {
        return jsonResponse([]);
      }

      if (url.startsWith("http://test/api/members/info?ids=")) {
        return jsonResponse([]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<ProgressPage />);

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();
    expect(screen.getByText("Read Book")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search habits/i), {
      target: { value: "Read" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Drink Water")).not.toBeInTheDocument();
      expect(screen.getByText("Read Book")).toBeInTheDocument();
    });

    const select = document.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "archived" } });

    await waitFor(() => {
      expect(screen.getByText("Read Book")).toBeInTheDocument();
    });
  });

  it("falls back to memberId when the real member-name helper receives no names", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-gym",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Gym",
            goal: null,
            habitState: "active",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-gym/entries") {
        return jsonResponse([
          {
            habitEntryId: "entry-3",
            habitId: "habit-gym",
            memberId: "member-missing",
            status: "Logged",
            notes: "",
            date: "2026-04-20T12:00:00Z",
          },
        ]);
      }

      if (url === "http://test/api/members/info?ids=member-missing") {
        return jsonResponse([]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<ProgressPage />);

    expect(await screen.findByText("Gym")).toBeInTheDocument();
    expect(await screen.findByText(/member: member-missing/i)).toBeInTheDocument();
  });

  it("shows the real apiFetch error message when progress loading fails", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Progress load failed", 500));

    render(<ProgressPage />);

    expect(await screen.findByText("Progress load failed")).toBeInTheDocument();
  });

  it("shows Undo only for today's own entry on an active habit and removes it immediately after DELETE", async () => {
    const today = new Date().toISOString();

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-today",
            habitTeamId: "team-1",
            creatorId: "creator-1",
            name: "Today Habit",
            goal: null,
            habitState: "active",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-today/entries") {
        return jsonResponse([
          {
            habitEntryId: "entry-today-own",
            habitId: "habit-today",
            memberId: "user-123",
            status: "Logged",
            notes: "My today log",
            date: today,
          },
        ]);
      }

      if (url === "http://test/api/members/info?ids=user-123") {
        return jsonResponse([{ memberId: "user-123", name: "Current User" }]);
      }

      if (url === "http://test/api/habits/habit-today/entries/entry-today-own") {
        expect(init?.method).toBe("DELETE");
        return textResponse("", 204);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<ProgressPage />);

    expect(await screen.findByText("Today Habit")).toBeInTheDocument();
    expect(await screen.findByText("My today log")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test/api/habits/habit-today/entries/entry-today-own",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("My today log")).not.toBeInTheDocument();
      expect(screen.getByText("No logs yet for this habit.")).toBeInTheDocument();
      expect(screen.getByText("Log undone successfully.")).toBeInTheDocument();
    });
  });

  it("does not show Undo for a past own entry", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-past",
            habitTeamId: "team-1",
            creatorId: "creator-1",
            name: "Past Habit",
            goal: null,
            habitState: "active",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-past/entries") {
        return jsonResponse([
          {
            habitEntryId: "entry-past-own",
            habitId: "habit-past",
            memberId: "user-123",
            status: "Logged",
            notes: "Past own log",
            date: yesterday,
          },
        ]);
      }

      if (url.startsWith("http://test/api/members/info?ids=")) {
        return jsonResponse([{ memberId: "user-123", name: "Current User" }]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<ProgressPage />);

    expect(await screen.findByText("Past Habit")).toBeInTheDocument();
    expect(await screen.findByText("Past own log")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^undo$/i })).not.toBeInTheDocument();
  });

  it("does not show Undo for another member's today entry", async () => {
    const today = new Date().toISOString();

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-other-user",
            habitTeamId: "team-1",
            creatorId: "creator-1",
            name: "Shared Habit",
            goal: null,
            habitState: "active",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-other-user/entries") {
        return jsonResponse([
          {
            habitEntryId: "entry-today-other",
            habitId: "habit-other-user",
            memberId: "member-other",
            status: "Logged",
            notes: "Other member log",
            date: today,
          },
        ]);
      }

      if (url.startsWith("http://test/api/members/info?ids=")) {
        return jsonResponse([{ memberId: "member-other", name: "Other Member" }]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<ProgressPage />);

    expect(await screen.findByText("Shared Habit")).toBeInTheDocument();
    expect(await screen.findByText("Other member log")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^undo$/i })).not.toBeInTheDocument();
  });

  it("does not show Undo for today's own entry when the habit is archived", async () => {
    const today = new Date().toISOString();

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-archived-own",
            habitTeamId: "team-1",
            creatorId: "creator-1",
            name: "Archived Habit",
            goal: null,
            habitState: "archived",
            expiryDate: null,
            habitType: "binary",
            unit: null,
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-archived-own/entries") {
        return jsonResponse([
          {
            habitEntryId: "entry-archived-own",
            habitId: "habit-archived-own",
            memberId: "user-123",
            status: "Logged",
            notes: "Archived today log",
            date: today,
          },
        ]);
      }

      if (url.startsWith("http://test/api/members/info?ids=")) {
        return jsonResponse([{ memberId: "user-123", name: "Current User" }]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<ProgressPage />);

    expect(await screen.findByText("Archived Habit")).toBeInTheDocument();
    expect(await screen.findByText("Archived today log")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^undo$/i })).not.toBeInTheDocument();
  });

});