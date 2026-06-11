export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  "bad-request": "The request could not be processed. Please check the entered data and try again.",
  "validation-error": "Please check the entered data and try again.",
  "invalid-credentials": "Invalid email or password.",
  "email-already-used": "An account with this email already exists.",
  "habit-not-found": "Habit was not found.",
  "habit-archived": "This habit is archived and cannot be changed or logged.",
  "habit-closed": "This habit is closed and cannot be logged.",
  "log-already-exists": "This habit has already been logged today.",
  "entry-not-found": "This habit entry was not found.",
  "entry-not-from-today": "Only today's habit entry can be changed.",
  "team-not-found": "Team was not found.",
  "team-access-denied": "You do not have access to this team.",
  "creator-cannot-leave": "The team creator cannot leave the team. Delete the team or transfer ownership first.",
  "only-creator-can-perform-action": "Only the team creator can perform this action.",
  "invite-code-not-found": "Invite code was not found.",
  "invite-code-expired": "This invite code has expired.",
  "invite-code-invalid": "This invite code is invalid.",
  "already-team-member": "You are already a member of this team.",
  "session-inactive": "Your session is no longer active. Please log in again.",
  "unauthorized": "Your session has expired. Please log in again.",
  "forbidden": "You do not have permission to perform this action.",
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export function clearAuthStorage(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("sessionId");

  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("sessionId");
}

function redirectToLoginAfterUnauthorized(): void {
  if (typeof window === "undefined") return;

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (currentPath.startsWith("/login") || currentPath.startsWith("/register")) {
    return;
  }

  const redirectTarget = currentPath && currentPath !== "/"
    ? `/login?next=${encodeURIComponent(currentPath)}`
    : "/login";

  if (process.env.NODE_ENV === "test") {
    window.dispatchEvent(
      new CustomEvent("auth:unauthorized", { detail: { redirectTo: redirectTarget } })
    );
    return;
  }

  window.location.assign(redirectTarget);
}

function normalizeErrorCode(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned) return null;

  return cleaned.toLowerCase();
}

function mapErrorCode(value: unknown): string | null {
  const code = normalizeErrorCode(value);
  if (!code) return null;

  return FRIENDLY_ERROR_MESSAGES[code] ?? null;
}

function isSlugLike(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(value.trim().toLowerCase());
}

function getStatusFallback(status: number): string {
  if (status === 400) return "The request could not be processed. Please check the entered data and try again.";
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested item was not found.";
  if (status >= 500) return "Server error. Please try again later.";

  return `API request failed with status ${status}`;
}

function extractJsonErrorMessage(errorData: unknown, status: number): string {
  if (!errorData || typeof errorData !== "object") {
    return getStatusFallback(status);
  }

  const data = errorData as Record<string, unknown>;

  const mapped =
    mapErrorCode(data.error) ??
    mapErrorCode(data.code) ??
    mapErrorCode(data.message) ??
    mapErrorCode(data.title);

  if (mapped) {
    return mapped;
  }

  if (data.errors && typeof data.errors === "object") {
    return "Please check the entered data and try again.";
  }

  for (const key of ["message", "title", "detail"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      return isSlugLike(trimmed) ? getStatusFallback(status) : trimmed;
    }
  }

  return getStatusFallback(status);
}

async function extractErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers?.get?.("content-type") || "";

  try {
    if (contentType.includes("json")) {
      const errorData = await response.json();
      return extractJsonErrorMessage(errorData, response.status);
    }

    const text = (await response.text()).trim();
    if (!text) return getStatusFallback(response.status);

    return mapErrorCode(text) ?? (isSlugLike(text) ? getStatusFallback(response.status) : text);
  } catch {
    return getStatusFallback(response.status);
  }
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
    if (response.status === 401) {
      clearAuthStorage();
      redirectToLoginAfterUnauthorized();
    }

    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
