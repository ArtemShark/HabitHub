import { apiFetch, getToken, API_BASE_URL, clearAuthStorage } from "./apiFetch";

const mockFetch = jest.fn();
global.fetch = mockFetch;

type StorageData = Record<string, string>;

function createStorageMock(initial: StorageData = {}) {
  let store = { ...initial };

  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
}

function setStorage(local: StorageData = {}, session: StorageData = {}) {
  const localStorageMock = createStorageMock(local);
  const sessionStorageMock = createStorageMock(session);

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  });

  Object.defineProperty(window, "sessionStorage", {
    value: sessionStorageMock,
    writable: true,
  });

  return { localStorageMock, sessionStorageMock };
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

describe("getToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns token from localStorage", () => {
    setStorage({ token: "ls-token-123" });

    expect(getToken()).toBe("ls-token-123");
  });

  it("falls back to sessionStorage when localStorage is empty", () => {
    setStorage({}, { token: "ss-token-456" });

    expect(getToken()).toBe("ss-token-456");
  });

  it("returns null when no token is stored", () => {
    setStorage();

    expect(getToken()).toBeNull();
  });
});

describe("clearAuthStorage", () => {
  it("removes auth data from localStorage and sessionStorage", () => {
    const { localStorageMock, sessionStorageMock } = setStorage(
      { token: "local-token", user: "{}", sessionId: "session-1" },
      { token: "session-token", user: "{}", sessionId: "session-2" }
    );

    clearAuthStorage();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("token");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("user");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("sessionId");
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("token");
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("user");
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("sessionId");
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setStorage();
    window.history.pushState({}, "", "/dashboard");
  });

  describe("request construction", () => {
    it("calls fetch with the correct URL", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));

      await apiFetch("/api/habits");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(`${API_BASE_URL}/api/habits`);
    });

    it("sets Content-Type to application/json when body is present", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

      await apiFetch("/api/habits", {
        method: "POST",
        body: JSON.stringify({ name: "Test" }),
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = options.headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("does not override Content-Type if already set", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

      await apiFetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "raw text",
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = options.headers as Headers;
      expect(headers.get("Content-Type")).toBe("text/plain");
    });

    it("does not set Content-Type when no body is provided", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await apiFetch("/api/habits", { method: "GET" });

      const [, options] = mockFetch.mock.calls[0];
      const headers = options.headers as Headers;
      expect(headers.has("Content-Type")).toBe(false);
    });

    it("does not set Content-Type when body is FormData", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

      const formData = new FormData();
      formData.append("file", new Blob(["x"]), "test.txt");

      await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = options.headers as Headers;
      expect(headers.has("Content-Type")).toBe(false);
    });

    it("sets Authorization header when token exists", async () => {
      setStorage({ token: "my-jwt-token" });
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await apiFetch("/api/habits");

      const [, options] = mockFetch.mock.calls[0];
      const headers = options.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer my-jwt-token");
    });

    it("does not set Authorization header when no token", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await apiFetch("/api/habits");

      const [, options] = mockFetch.mock.calls[0];
      const headers = options.headers as Headers;
      expect(headers.has("Authorization")).toBe(false);
    });

    it("sets cache to no-store", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await apiFetch("/api/habits");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.cache).toBe("no-store");
    });

    it("passes through method and body options", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "new" }));

      const body = JSON.stringify({ name: "Run" });
      await apiFetch("/api/habits", { method: "POST", body });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("POST");
      expect(options.body).toBe(body);
    });
  });

  describe("successful responses", () => {
    it("parses JSON response body", async () => {
      const data = { habitId: "abc", name: "Walk" };
      mockFetch.mockResolvedValueOnce(jsonResponse(data));

      const result = await apiFetch("/api/habits/abc");

      expect(result).toEqual(data);
    });

    it("returns undefined for 204 No Content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
      });

      const result = await apiFetch("/api/habits/abc", { method: "DELETE" });

      expect(result).toBeUndefined();
    });

    it("returns undefined when response is not JSON", async () => {
      mockFetch.mockResolvedValueOnce(textResponse("OK"));

      const result = await apiFetch("/api/health");

      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("clears auth data and dispatches login redirect event on 401", async () => {
      const { localStorageMock, sessionStorageMock } = setStorage(
        { token: "expired-token", user: "{}", sessionId: "session-1" },
        { token: "session-token", user: "{}", sessionId: "session-2" }
      );

      const redirectListener = jest.fn();
      window.addEventListener("auth:unauthorized", redirectListener);

      mockFetch.mockResolvedValueOnce(jsonResponse({ error: "session-inactive" }, 401));

      await expect(apiFetch("/api/habits")).rejects.toThrow(
        "Your session is no longer active. Please log in again."
      );

      expect(localStorageMock.removeItem).toHaveBeenCalledWith("token");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("user");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("sessionId");
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("token");
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("user");
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("sessionId");
      expect(redirectListener).toHaveBeenCalledTimes(1);
      expect(redirectListener.mock.calls[0][0].detail.redirectTo).toBe(
        "/login?next=%2Fdashboard"
      );

      window.removeEventListener("auth:unauthorized", redirectListener);
    });

    it("maps JSON slug error to a user-friendly message", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "log-already-exists" }, 409)
      );

      await expect(apiFetch("/api/habits", { method: "POST", body: "{}" })).rejects.toThrow(
        "This habit has already been logged today."
      );
    });

    it("maps plain text slug error to a user-friendly message", async () => {
      mockFetch.mockResolvedValueOnce(textResponse("creator-cannot-leave", 400));

      await expect(apiFetch("/api/teams/abc/leave", { method: "POST" })).rejects.toThrow(
        "The team creator cannot leave the team. Delete the team or transfer ownership first."
      );
    });

    it("keeps readable JSON error message from server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "application/json" : null) },
        json: async () => ({ message: "Name is required" }),
      });

      await expect(apiFetch("/api/habits", { method: "POST", body: "{}" })).rejects.toThrow(
        "Name is required"
      );
    });

    it("keeps readable JSON title field when message is absent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "application/json" : null) },
        json: async () => ({ title: "Validation failed" }),
      });

      await expect(apiFetch("/api/habits", { method: "POST", body: "{}" })).rejects.toThrow(
        "Validation failed"
      );
    });

    it("throws with plain text error from server when it is readable", async () => {
      mockFetch.mockResolvedValueOnce(textResponse("Habit not found", 404));

      await expect(apiFetch("/api/habits/xyz")).rejects.toThrow("Habit not found");
    });

    it("throws with status code when response body parsing fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "application/json" : null) },
        json: async () => {
          throw new Error("parse error");
        },
      });

      await expect(apiFetch("/api/habits")).rejects.toThrow(
        "Server error. Please try again later."
      );
    });

    it("throws with generic message when error text is empty", async () => {
      mockFetch.mockResolvedValueOnce(textResponse("", 403));

      await expect(apiFetch("/api/habits")).rejects.toThrow(
        "You do not have permission to perform this action."
      );
    });
  });
});
