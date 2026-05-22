import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

const RemindersPage = require("./page").default;

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

function createFakeJwt(userId: string): string {
  const payload = {
    sub: userId,
    nameid: userId,
    memberId: userId,
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": userId,
  };

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

function textResponse(text: string, status = 500) {
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

function setupAuth(userId = "creator-1") {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("token", createFakeJwt(userId));
  localStorage.setItem("sessionId", "session-1");
}

const enabledReminder = {
  reminderId: "reminder-1",
  memberId: "member-1",
  habitId: "habit-water",
  habitName: "Drink Water",
  enabled: true,
  lastSentAt: null,
  reminderTime: "2026-05-21T13:20:00.000Z",
};

const disabledReminder = {
  reminderId: "reminder-2",
  memberId: "member-1",
  habitId: "habit-reading",
  habitName: "Read Book",
  enabled: false,
  lastSentAt: "2026-05-21T10:00:00.000Z",
  reminderTime: "2026-05-21T18:00:00.000Z",
};

const creatorTeam = {
  habitTeamId: "team-creator",
  name: "Creator Team",
  creatorId: "creator-1",
};

const memberTeam = {
  habitTeamId: "team-member",
  name: "Member Team",
  creatorId: "other-user",
};

const activeHabit = {
  habitId: "habit-water",
  habitTeamId: "team-creator",
  creatorId: "creator-1",
  name: "Drink Water",
  habitState: "Active",
  reminderTime: null,
};

const secondActiveHabit = {
  habitId: "habit-steps",
  habitTeamId: "team-creator",
  creatorId: "creator-1",
  name: "Walk Steps",
  habitState: "Active",
  reminderTime: null,
};

describe("RemindersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();

    window.scrollTo = jest.fn();

    setupAuth("creator-1");
  });

  it("loads real reminder data and renders reminders with current states", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/reminders/my") {
        return jsonResponse([enabledReminder, disabledReminder]);
      }

      if (url === "http://test/api/teams") {
        return jsonResponse([]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<RemindersPage />);

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();
    expect(screen.getByText("Read Book")).toBeInTheDocument();

    expect(screen.getByText("On")).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test/api/reminders/my",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      })
    );
  });

  it("shows Set Reminder for creator-owned active habits even when no reminders exist yet", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/reminders/my") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/teams") {
        return jsonResponse([creatorTeam]);
      }

      if (url === "http://test/api/teams/team-creator/habits?state=Active") {
        return jsonResponse([activeHabit, secondActiveHabit]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<RemindersPage />);

    expect(await screen.findByText("No reminders yet")).toBeInTheDocument();

    const setReminderButton = await screen.findByRole("button", {
      name: /set reminder/i,
    });

    expect(setReminderButton).toBeInTheDocument();

    fireEvent.click(setReminderButton);

    expect(await screen.findByRole("heading", { name: /set reminder/i })).toBeInTheDocument();
    expect(screen.getByText("Drink Water")).toBeInTheDocument();
    expect(screen.getByText("Walk Steps")).toBeInTheDocument();
  });

  it("allows creator to submit reminder time and reloads reminders from backend", async () => {
    let reminderWasSet = false;

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://test/api/reminders/my" && method === "GET") {
        return jsonResponse(reminderWasSet ? [enabledReminder] : []);
      }

      if (url === "http://test/api/teams" && method === "GET") {
        return jsonResponse([creatorTeam]);
      }

      if (url === "http://test/api/teams/team-creator/habits?state=Active" && method === "GET") {
        return jsonResponse([activeHabit]);
      }

      if (url === "http://test/api/habits/habit-water/reminder" && method === "PATCH") {
        reminderWasSet = true;
        return jsonResponse({
          message: "Reminder time set successfully.",
          reminderTime: "2026-05-21T13:20:00.000Z",
        });
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    const { container } = render(<RemindersPage />);

    const setReminderButton = await screen.findByRole("button", {
      name: /set reminder/i,
    });

    fireEvent.click(setReminderButton);

    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement;
    expect(timeInput).not.toBeNull();

    fireEvent.change(timeInput, { target: { value: "13:20" } });

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test/api/habits/habit-water/reminder",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("reminderTime"),
        })
      );
    });

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument();

    const reminderReloadCalls = mockFetch.mock.calls.filter(
      ([input]) => String(input) === "http://test/api/reminders/my"
    );

    expect(reminderReloadCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not show Set Reminder button for non-creator users", async () => {
    setupAuth("member-1");

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/reminders/my") {
        return jsonResponse([enabledReminder]);
      }

      if (url === "http://test/api/teams") {
        return jsonResponse([memberTeam]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<RemindersPage />);

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /set reminder/i })
    ).not.toBeInTheDocument();

    expect(mockFetch).not.toHaveBeenCalledWith(
      "http://test/api/teams/team-member/habits?state=Active",
      expect.anything()
    );
  });

  it("allows member to disable and re-enable their own reminder", async () => {
    setupAuth("member-1");

    const reminderState = { enabled: true };

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://test/api/reminders/my" && method === "GET") {
        return jsonResponse([{ ...enabledReminder, enabled: reminderState.enabled }]);
      }

      if (url === "http://test/api/teams" && method === "GET") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits/habit-water/my-reminder" && method === "PATCH") {
        const body = JSON.parse(String(init?.body));
        reminderState.enabled = body.enabled;

        return jsonResponse({
          message: "Reminder preference updated.",
          enabled: reminderState.enabled,
        });
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<RemindersPage />);

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument();

    const firstToggle = screen.getByText("On").parentElement!.querySelector("button")!;
    fireEvent.click(firstToggle);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test/api/habits/habit-water/my-reminder",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ enabled: false }),
        })
      );
    });

    expect(await screen.findByText("Off")).toBeInTheDocument();

    const secondToggle = screen.getByText("Off").parentElement!.querySelector("button")!;
    fireEvent.click(secondToggle);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test/api/habits/habit-water/my-reminder",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ enabled: true }),
        })
      );
    });

    expect(await screen.findByText("On")).toBeInTheDocument();
  });

  it("reverts reminder toggle when backend update fails", async () => {
    setupAuth("member-1");

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://test/api/reminders/my" && method === "GET") {
        return jsonResponse([enabledReminder]);
      }

      if (url === "http://test/api/teams" && method === "GET") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/habits/habit-water/my-reminder" && method === "PATCH") {
        return textResponse("forbidden", 403);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<RemindersPage />);

    expect(await screen.findByText("Drink Water")).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument();

    const toggle = screen.getByText("On").parentElement!.querySelector("button")!;
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test/api/habits/habit-water/my-reminder",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ enabled: false }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("On")).toBeInTheDocument();
    });
  });

  it("shows loading error when reminders cannot be loaded", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/reminders/my") {
        return textResponse("Failed to load reminder data.", 500);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<RemindersPage />);

    expect(await screen.findByText("Failed to load reminder data.")).toBeInTheDocument();
  });

  it("shows set reminder submit error when backend rejects creator request", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://test/api/reminders/my" && method === "GET") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/teams" && method === "GET") {
        return jsonResponse([creatorTeam]);
      }

      if (url === "http://test/api/teams/team-creator/habits?state=Active" && method === "GET") {
        return jsonResponse([activeHabit]);
      }

      if (url === "http://test/api/habits/habit-water/reminder" && method === "PATCH") {
        return textResponse("forbidden", 403);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<RemindersPage />);

    fireEvent.click(await screen.findByRole("button", { name: /set reminder/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("forbidden")).toBeInTheDocument();
  });
});