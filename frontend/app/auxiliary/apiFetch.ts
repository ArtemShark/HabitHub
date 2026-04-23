export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;

    if (response.status === 401) {
      message = "Unauthorized. Please log in again.";
    }

    const contentType = response.headers?.get?.("content-type") || "";

    try {
      if (contentType.includes("application/json")) {
        const errorData = await response.json();
        message = errorData?.message || errorData?.title || message;
      } else {
        const text = await response.text();
        if (text) message = text;
      }
    } catch {
      message = `API request failed with status ${response.status}`;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}