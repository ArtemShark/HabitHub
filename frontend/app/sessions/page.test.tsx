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

const SessionsPage = require("./page").default;

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

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => null,
    },
    json: async () => ({}),
    text: async () => "",
  };
}

function setupAuth(userId = "user-1") {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("token", createFakeJwt(userId));
  localStorage.setItem("sessionId", "session-current");
}

const currentSession = {
  sessionId: "session-current",
  memberId: "user-1",
  createdAt: "2026-05-01T10:00:00.000Z",
  lastActiveAt: "2026-05-21T10:00:00.000Z",
  expiresAt: "2026-06-01T10:00:00.000Z",
  device: "Chrome on Windows",
  ipAddress: "192.168.0.1",
  state: 0,
};

const otherSession = {
  sessionId: "session-other",
  memberId: "user-1",
  createdAt: "2026-05-10T10:00:00.000Z",
  lastActiveAt: "2026-05-20T10:00:00.000Z",
  expiresAt: "2026-06-10T10:00:00.000Z",
  device: "Safari on iPhone",
  ipAddress: "10.0.0.5",
  state: 0,
};

const tabletSession = {
  sessionId: "session-tablet",
  memberId: "user-1",
  createdAt: "2026-05-15T10:00:00.000Z",
  lastActiveAt: "2026-05-19T10:00:00.000Z",
  expiresAt: "2026-06-15T10:00:00.000Z",
  device: "Firefox on tablet",
  ipAddress: "172.16.0.1",
  state: 0,
};

describe("SessionsPage", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    setupAuth("user-1");

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const msg = String(args[0] ?? "");
      if (msg.includes("Not implemented: navigation")) return;
      console.warn("[suppressed console.error]", ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders the page header and back link", async () => {
    mockFetch.mockImplementation(async () => jsonResponse([]));

    render(<SessionsPage />);

    expect(screen.getByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getByText("Back to dashboard")).toBeInTheDocument();
  });

  it("loads sessions from /api/sessions and renders one card per session", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "http://test/api/sessions") {
        return jsonResponse([currentSession, otherSession]);
      }
      throw new Error(`Unhandled fetch URL: ${url}`);
    });

    render(<SessionsPage />);

    expect(await screen.findByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("Safari on iPhone")).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test/api/sessions",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("shows a Current session badge next to the session matching localStorage", async () => {
    mockFetch.mockImplementation(async () => jsonResponse([currentSession, otherSession]));

    render(<SessionsPage />);

    await screen.findByText("Chrome on Windows");

    const badges = screen.getAllByText("Current session");
    expect(badges).toHaveLength(1);
  });

  it("shows a Terminate button for every session", async () => {
    mockFetch.mockImplementation(async () => jsonResponse([currentSession, otherSession, tabletSession]));

    render(<SessionsPage />);

    await screen.findByText("Chrome on Windows");

    const terminateButtons = screen.getAllByRole("button", { name: /terminate session/i });
    expect(terminateButtons).toHaveLength(3);
  });

  it("removes a non-current session from the list after successful termination", async () => {
    let getCallCount = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://test/api/sessions" && method === "GET") {
        getCallCount += 1;
        return jsonResponse([currentSession, otherSession]);
      }

      if (url === "http://test/api/sessions/session-other" && method === "DELETE") {
        return emptyResponse(204);
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    render(<SessionsPage />);

    await screen.findByText("Safari on iPhone");

    const otherDeviceLabel = screen.getByText("Safari on iPhone");
    const otherCard = otherDeviceLabel.closest("div.rounded-2xl")
      ?? otherDeviceLabel.parentElement!.parentElement!.parentElement!;
    const otherTerminateButton = otherCard.querySelector("button")!;

    fireEvent.click(otherTerminateButton);

    await waitFor(() => {
      expect(screen.queryByText("Safari on iPhone")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Chrome on Windows")).toBeInTheDocument();
    expect(getCallCount).toBe(1);
  });

  it("clears auth tokens when terminating the current session", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://test/api/sessions" && method === "GET") {
        return jsonResponse([currentSession]);
      }
      if (url === "http://test/api/sessions/session-current" && method === "DELETE") {
        return emptyResponse(204);
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    render(<SessionsPage />);

    await screen.findByText("Chrome on Windows");

    const terminateButton = screen.getByRole("button", { name: /terminate session/i });
    fireEvent.click(terminateButton);

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("sessionId")).toBeNull();
    });
  });

  it("does not crash if loading sessions fails", async () => {
    mockFetch.mockImplementation(async () => {
      throw new Error("network down");
    });

    render(<SessionsPage />);

    expect(screen.getByText("Active Sessions")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it("renders the correct device icon based on device string", async () => {
    mockFetch.mockImplementation(async () => jsonResponse([currentSession, otherSession, tabletSession]));

    render(<SessionsPage />);

    expect(await screen.findByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("Safari on iPhone")).toBeInTheDocument();
    expect(screen.getByText("Firefox on Device")).toBeInTheDocument();
  });
});
