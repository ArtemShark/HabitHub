import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://test";

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

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

const TeamsPage = require("./page").default;

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

function textResponse(text: string, status = 500) {
  return {
    ok: false,
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

describe("TeamsPage integration-style tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();

    window.scrollTo = jest.fn();

    localStorage.clear();
    sessionStorage.clear();

    localStorage.setItem("token", createFakeJwt({ sub: "creator-1" }));
    localStorage.setItem("sessionId", "session-1");

    Object.defineProperty(window, "navigator", {
      value: {
        clipboard: {
          writeText: jest.fn(),
        },
      },
      writable: true,
    });

    Object.defineProperty(window, "open", {
      value: jest.fn(),
      writable: true,
    });
  });

  it("loads teams, selected team details, and team habits through the real helper chain", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/teams") {
        return jsonResponse([
          {
            habitTeamId: "team-1",
            name: "Alpha Team",
            creatorId: "creator-1",
            members: [
              { memberId: "creator-1", name: "Alice", email: "alice@example.com" },
              { memberId: "member-2", name: "Bob", email: "bob@example.com" },
            ],
          },
          {
            habitTeamId: "team-2",
            name: "Bravo Team",
            creatorId: "member-2",
            members: [{ memberId: "member-2", name: "Bob", email: "bob@example.com" }],
          },
        ]);
      }

      if (url === "http://test/api/teams/team-1") {
        return jsonResponse({
          habitTeamId: "team-1",
          name: "Alpha Team",
          creatorId: "creator-1",
          members: [
            { memberId: "creator-1", name: "Alice", email: "alice@example.com" },
            { memberId: "member-2", name: "Bob", email: "bob@example.com" },
          ],
        });
      }

      if (url === "http://test/api/teams/team-1/habits") {
        return jsonResponse([
          {
            habitId: "habit-1",
            habitTeamId: "team-1",
            creatorId: "creator-1",
            name: "Hydrate",
            goal: "8",
            habitState: "active",
            expiryDate: "2026-12-31T00:00:00Z",
            habitType: "quantitative",
            unit: "cups",
          },
        ]);
      }

      if (url === "http://test/api/teams/team-2") {
        return jsonResponse({
          habitTeamId: "team-2",
          name: "Bravo Team",
          creatorId: "member-2",
          members: [{ memberId: "member-2", name: "Bob", email: "bob@example.com" }],
        });
      }

      if (url === "http://test/api/teams/team-2/habits") {
        return jsonResponse([]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<TeamsPage />);

    expect(await screen.findByText("Alpha Team")).toBeInTheDocument();
    expect(screen.getByText("Bravo Team")).toBeInTheDocument();

    expect(await screen.findByText("Hydrate")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Goal: 8"))).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Bravo Team"));

    expect(await screen.findByText(/no habits created for this team yet/i)).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalled();
  });

  it("creates a team through the real apiFetch flow and reloads the page state", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/teams" && (!init?.method || init.method === "GET")) {
        if (
          mockFetch.mock.calls.filter((call) => String(call[0]) === "http://test/api/teams")
            .length === 1
        ) {
          return jsonResponse([]);
        }
        return jsonResponse([
          {
            habitTeamId: "team-new",
            name: "Morning Momentum",
            creatorId: "creator-1",
            members: [{ memberId: "creator-1", name: "Alice", email: "alice@example.com" }],
          },
        ]);
      }

      if (url === "http://test/api/teams" && init?.method === "POST") {
        return jsonResponse({
          habitTeamId: "team-new",
          name: "Morning Momentum",
          creatorId: "creator-1",
          members: [{ memberId: "creator-1", name: "Alice", email: "alice@example.com" }],
        });
      }

      if (url === "http://test/api/teams/team-new") {
        return jsonResponse({
          habitTeamId: "team-new",
          name: "Morning Momentum",
          creatorId: "creator-1",
          members: [{ memberId: "creator-1", name: "Alice", email: "alice@example.com" }],
        });
      }

      if (url === "http://test/api/teams/team-new/habits") {
        return jsonResponse([]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<TeamsPage />);

    expect(await screen.findByText(/no teams yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/team name/i), {
      target: { value: "Morning Momentum" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^create team$/i }));

    expect(await screen.findByText(/team created successfully/i)).toBeInTheDocument();
    expect(await screen.findByText("Morning Momentum")).toBeInTheDocument();

    const postCall = mockFetch.mock.calls.find(
      ([url, init]) =>
        String(url) === "http://test/api/teams" && (init as RequestInit)?.method === "POST"
    );

    expect(postCall).toBeTruthy();
    expect((postCall?.[1] as RequestInit).body).toBe(
      JSON.stringify({ name: "Morning Momentum" })
    );
  });

  it("joins a team through the real apiFetch flow and reloads teams", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/teams" && (!init?.method || init.method === "GET")) {
        if (
          mockFetch.mock.calls.filter((call) => String(call[0]) === "http://test/api/teams")
            .length === 1
        ) {
          return jsonResponse([]);
        }
        return jsonResponse([
          {
            habitTeamId: "team-join",
            name: "Joined Team",
            creatorId: "member-9",
            members: [
              { memberId: "member-9", name: "Owner", email: "owner@example.com" },
              { memberId: "creator-1", name: "Alice", email: "alice@example.com" },
            ],
          },
        ]);
      }

      if (url === "http://test/api/teams/join" && init?.method === "POST") {
        return {
          ok: true,
          status: 204,
          headers: { get: () => null },
        };
      }

      if (url === "http://test/api/teams/team-join") {
        return jsonResponse({
          habitTeamId: "team-join",
          name: "Joined Team",
          creatorId: "member-9",
          members: [
            { memberId: "member-9", name: "Owner", email: "owner@example.com" },
            { memberId: "creator-1", name: "Alice", email: "alice@example.com" },
          ],
        });
      }

      if (url === "http://test/api/teams/team-join/habits") {
        return jsonResponse([]);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<TeamsPage />);

    expect(await screen.findByText(/no teams yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/invite code/i), {
      target: { value: "INVITE-ABC-123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^join team$/i }));

    expect(await screen.findByText(/joined team successfully/i)).toBeInTheDocument();
    expect(await screen.findByText("Joined Team")).toBeInTheDocument();

    const joinCall = mockFetch.mock.calls.find(
      ([url, init]) =>
        String(url) === "http://test/api/teams/join" &&
        (init as RequestInit)?.method === "POST"
    );

    expect(joinCall).toBeTruthy();
    expect((joinCall?.[1] as RequestInit).body).toBe(
      JSON.stringify({ code: "INVITE-ABC-123" })
    );
  });

  it("generates and copies an invite code for the selected team", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/teams") {
        return jsonResponse([
          {
            habitTeamId: "team-1",
            name: "Alpha Team",
            creatorId: "creator-1",
            members: [{ memberId: "creator-1", name: "Alice", email: "alice@example.com" }],
          },
        ]);
      }

      if (url === "http://test/api/teams/team-1") {
        return jsonResponse({
          habitTeamId: "team-1",
          name: "Alpha Team",
          creatorId: "creator-1",
          members: [{ memberId: "creator-1", name: "Alice", email: "alice@example.com" }],
        });
      }

      if (url === "http://test/api/teams/team-1/habits") {
        return jsonResponse([]);
      }

      if (url === "http://test/api/teams/team-1/invite-codes" && init?.method === "POST") {
        return jsonResponse({
          code: "CODE-12345",
          expiryDate: "2026-12-31T10:00:00Z",
          habitTeamId: "team-1",
        });
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<TeamsPage />);

    expect(await screen.findByText("Alpha Team")).toBeInTheDocument();

    const generateInviteButton = await screen.findByText(/generate invite code/i);
    fireEvent.click(generateInviteButton);

    expect(await screen.findByText("CODE-12345")).toBeInTheDocument();

    const copyCodeButton = await screen.findByText(/copy code/i);

    await act(async () => {
        fireEvent.click(copyCodeButton);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("CODE-12345");
    expect(await screen.findByText(/invite code copied/i)).toBeInTheDocument();
    });

  it("creates a team habit through the real apiFetch flow and refreshes the habit list", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/teams") {
        return jsonResponse([
          {
            habitTeamId: "team-1",
            name: "Alpha Team",
            creatorId: "creator-1",
            members: [{ memberId: "creator-1", name: "Alice", email: "alice@example.com" }],
          },
        ]);
      }

      if (url === "http://test/api/teams/team-1") {
        return jsonResponse({
          habitTeamId: "team-1",
          name: "Alpha Team",
          creatorId: "creator-1",
          members: [{ memberId: "creator-1", name: "Alice", email: "alice@example.com" }],
        });
      }

      if (
        url === "http://test/api/teams/team-1/habits" &&
        (!init?.method || init.method === "GET")
      ) {
        const getCount = mockFetch.mock.calls.filter(
          ([u, i]) =>
            String(u) === "http://test/api/teams/team-1/habits" &&
            (!i || !(i as RequestInit).method || (i as RequestInit).method === "GET")
        ).length;

        if (getCount === 1) {
          return jsonResponse([]);
        }

        return jsonResponse([
          {
            habitId: "team-habit-1",
            habitTeamId: "team-1",
            creatorId: "creator-1",
            name: "Read Pages",
            goal: "10",
            habitState: "active",
            expiryDate: "2026-12-31T00:00:00Z",
            habitType: "quantitative",
            unit: "pages",
          },
        ]);
      }

      if (url === "http://test/api/teams/team-1/habits" && init?.method === "POST") {
        return jsonResponse({
          habitId: "team-habit-1",
          habitTeamId: "team-1",
          creatorId: "creator-1",
          name: "Read Pages",
          goal: "10",
          habitState: "active",
          expiryDate: "2026-12-31T00:00:00Z",
          habitType: "quantitative",
          unit: "pages",
        });
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<TeamsPage />);

    expect(await screen.findByText("Alpha Team")).toBeInTheDocument();
    expect(await screen.findByText(/no habits created for this team yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/read 10 pages/i), {
      target: { value: "Read Pages" },
    });

    fireEvent.change(screen.getByDisplayValue("Binary"), {
      target: { value: "value" },
    });

    fireEvent.change(screen.getByPlaceholderText(/e.g. 10/i), {
      target: { value: "10" },
    });

    fireEvent.change(screen.getByPlaceholderText(/pages, km/i), {
      target: { value: "pages" },
    });

    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
        target: { value: "2026-12-31" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create habit for team/i }));

    expect(await screen.findByText(/habit created successfully/i)).toBeInTheDocument();
    expect(await screen.findByText("Read Pages")).toBeInTheDocument();

    const postCall = mockFetch.mock.calls.find(
      ([url, init]) =>
        String(url) === "http://test/api/teams/team-1/habits" &&
        (init as RequestInit)?.method === "POST"
    );

    expect(postCall).toBeTruthy();
    expect((postCall?.[1] as RequestInit).body).toBe(
      JSON.stringify({
        name: "Read Pages",
        goal: "10",
        habitType: 1,
        expiryDate: new Date("2026-12-31").toISOString(),
        unit: "pages",
      })
    );
  });

  it("shows the backend message when loading teams fails", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Teams load failed", 500));

    render(<TeamsPage />);

    expect(await screen.findByText("Teams load failed")).toBeInTheDocument();
  });
});