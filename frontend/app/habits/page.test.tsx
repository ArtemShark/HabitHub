import { render, screen, fireEvent, waitFor } from "@testing-library/react";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://test";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

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

const HabitsPage = require("./page").default;

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

describe("HabitsPage integration-style tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", createFakeJwt({ sub: "user-123" }));
  });

  it("loads habits through the real helper chain and shows active habits by default", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-1",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Hydrate",
            goal: "8",
            habitState: "active",
            expiryDate: "2026-12-31T00:00:00Z",
            habitType: "quantitative",
            unit: "cups",
          },
          {
            habitId: "habit-2",
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

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HabitsPage />);

    expect(screen.getByText(/loading habits/i)).toBeInTheDocument();

    expect(await screen.findByText("Hydrate")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Goal: 8"))).toBeInTheDocument();

    expect(screen.queryByText("Read Book")).not.toBeInTheDocument();

    const [url, options] = mockFetch.mock.calls[0];
    expect(String(url)).toBe("http://test/api/habits?memberId=user-123");
    expect((options as RequestInit).method).toBe("GET");
  });

  it("switches to archived habits using real mapped data", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-1",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Hydrate",
            goal: "8",
            habitState: "active",
            expiryDate: "2026-12-31T00:00:00Z",
            habitType: "quantitative",
            unit: "cups",
          },
          {
            habitId: "habit-2",
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

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HabitsPage />);

    expect(await screen.findByText("Hydrate")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /archived habits/i }));

    expect(await screen.findByText("Read Book")).toBeInTheDocument();
    expect(screen.queryByText("Hydrate")).not.toBeInTheDocument();
  });

  it("updates a habit through the real apiFetch flow", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-1",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Hydrate",
            goal: "8",
            habitState: "active",
            expiryDate: "2026-12-31T00:00:00Z",
            habitType: "quantitative",
            unit: "cups",
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-1" && init?.method === "PATCH") {
        return jsonResponse({
          habitId: "habit-1",
          habitTeamId: "team-1",
          creatorId: "user-123",
          name: "Hydrate Better",
          goal: "10",
          habitState: "active",
          expiryDate: "2026-12-31T00:00:00Z",
          habitType: "quantitative",
          unit: "cups",
        });
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HabitsPage />);

    expect(await screen.findByText("Hydrate")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    expect(await screen.findByText(/edit habit/i)).toBeInTheDocument();

    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Hydrate Better" } });
    fireEvent.change(inputs[2], { target: { value: "10" } });

    fireEvent.click(screen.getByText(/save changes/i));

    expect(await screen.findByText(/habit updated successfully/i)).toBeInTheDocument();
    expect(await screen.findByText("Hydrate Better")).toBeInTheDocument();

    const patchCall = mockFetch.mock.calls.find(
      ([url, init]) =>
        String(url) === "http://test/api/habits/habit-1" &&
        (init as RequestInit)?.method === "PATCH"
    );

    expect(patchCall).toBeTruthy();

    const parsedBody = JSON.parse((patchCall?.[1] as RequestInit).body as string);
    expect(parsedBody.name).toBe("Hydrate Better");
    expect(parsedBody.habitType).toBe("quantitative");
    expect(parsedBody.goal).toBe("10");
    expect(parsedBody.unit).toBe("cups");
  });

  it("archives a habit through the real apiFetch flow and moves it to archived tab", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-1",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Hydrate",
            goal: "8",
            habitState: "active",
            expiryDate: "2026-12-31T00:00:00Z",
            habitType: "quantitative",
            unit: "cups",
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-1/archive" && init?.method === "POST") {
        return jsonResponse({
          habitId: "habit-1",
          habitTeamId: "team-1",
          creatorId: "user-123",
          name: "Hydrate",
          goal: "8",
          habitState: "archived",
          expiryDate: "2026-12-31T00:00:00Z",
          habitType: "quantitative",
          unit: "cups",
        });
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HabitsPage />);

    expect(await screen.findByText("Hydrate")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));

    expect(await screen.findByText(/habit archived successfully/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /archived habits/i }));

    expect(await screen.findByText("Hydrate")).toBeInTheDocument();
  });

  it("deletes a habit through the real apiFetch flow and removes it from the list", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return jsonResponse([
          {
            habitId: "habit-1",
            habitTeamId: "team-1",
            creatorId: "user-123",
            name: "Hydrate",
            goal: "8",
            habitState: "active",
            expiryDate: "2026-12-31T00:00:00Z",
            habitType: "quantitative",
            unit: "cups",
          },
        ]);
      }

      if (url === "http://test/api/habits/habit-1" && init?.method === "DELETE") {
        return {
          ok: true,
          status: 204,
          headers: { get: () => null },
        };
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HabitsPage />);

    expect(await screen.findByText("Hydrate")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText(/habit deleted successfully/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Hydrate")).not.toBeInTheDocument();
    });

    expect(screen.getByText(/no active habits yet/i)).toBeInTheDocument();
  });

  it("shows the real apiFetch error when loading habits fails", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://test/api/habits?memberId=user-123") {
        return textResponse("Failed from server", 500);
      }

      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<HabitsPage />);

    expect(await screen.findByText("Failed from server")).toBeInTheDocument();
  });

  it("shows user-id error when no token is available for the real getCurrentUserId flow", async () => {
    localStorage.clear();
    sessionStorage.clear();

    render(<HabitsPage />);

    expect(await screen.findByText(/could not determine current user/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});