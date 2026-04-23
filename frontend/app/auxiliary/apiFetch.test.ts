import { apiFetch, getToken, API_BASE_URL } from "./apiFetch";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) =>
        key === "content-type" ? "application/json" : null,
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
        key === "content-type" ? "text/plain" : null,
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
    Object.defineProperty(window, "localStorage", {
      value: { getItem: jest.fn(() => "ls-token-123") },
      writable: true,
    });

    Object.defineProperty(window, "sessionStorage", {
      value: { getItem: jest.fn(() => null) },
      writable: true,
    });

    expect(getToken()).toBe("ls-token-123");
  });

  it("falls back to sessionStorage when localStorage is empty", () => {
    Object.defineProperty(window, "localStorage", {
      value: { getItem: jest.fn(() => null) },
      writable: true,
    });

    Object.defineProperty(window, "sessionStorage", {
      value: { getItem: jest.fn(() => "ss-token-456") },
      writable: true,
    });

    expect(getToken()).toBe("ss-token-456");
  });

  it("returns null when no token is stored", () => {
    Object.defineProperty(window, "localStorage", {
      value: { getItem: jest.fn(() => null) },
      writable: true,
    });

    Object.defineProperty(window, "sessionStorage", {
      value: { getItem: jest.fn(() => null) },
      writable: true,
    });

    expect(getToken()).toBeNull();
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(window, "localStorage", {
      value: { getItem: jest.fn(() => null) },
      writable: true,
    });

    Object.defineProperty(window, "sessionStorage", {
      value: { getItem: jest.fn(() => null) },
      writable: true,
    });
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
      Object.defineProperty(window, "localStorage", {
        value: { getItem: jest.fn(() => "my-jwt-token") },
        writable: true,
      });

      Object.defineProperty(window, "sessionStorage", {
        value: { getItem: jest.fn(() => null) },
        writable: true,
      });

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
    it("throws on 401 with unauthorized message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: { get: () => "text/plain" },
        text: async () => "",
      });

      await expect(apiFetch("/api/habits")).rejects.toThrow(
        "Unauthorized. Please log in again."
      );
    });

    it("throws with JSON error message from server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
        json: async () => ({ message: "Name is required" }),
      });

      await expect(apiFetch("/api/habits", { method: "POST", body: "{}" })).rejects.toThrow(
        "Name is required"
      );
    });

    it("throws with JSON title field when message is absent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
        json: async () => ({ title: "Validation failed" }),
      });

      await expect(apiFetch("/api/habits", { method: "POST", body: "{}" })).rejects.toThrow(
        "Validation failed"
      );
    });

    it("throws with plain text error from server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => "text/plain" },
        text: async () => "Habit not found",
      });

      await expect(apiFetch("/api/habits/xyz")).rejects.toThrow("Habit not found");
    });

    it("throws with status code when response body parsing fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
        json: async () => {
          throw new Error("parse error");
        },
      });

      await expect(apiFetch("/api/habits")).rejects.toThrow(
        "API request failed with status 500"
      );
    });

    it("throws with generic message when error text is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => "text/plain" },
        text: async () => "",
      });

      await expect(apiFetch("/api/habits")).rejects.toThrow(
        "API request failed with status 403"
      );
    });
  });
});