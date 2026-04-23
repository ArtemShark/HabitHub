import { getCurrentUserId } from "./getCurrentUserId";
import { getToken } from "./apiFetch";

jest.mock("./apiFetch", () => ({
  getToken: jest.fn(),
}));

const mockedGetToken = getToken as jest.Mock;

function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe("getCurrentUserId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when no token is available", () => {
    mockedGetToken.mockReturnValue(null);

    expect(getCurrentUserId()).toBeNull();
  });

  it("returns null for an invalid token format", () => {
    mockedGetToken.mockReturnValue("not-a-jwt");

    expect(getCurrentUserId()).toBeNull();
  });

  it("returns null for a token with invalid base64", () => {
    mockedGetToken.mockReturnValue("header.!!!invalid!!!.signature");

    expect(getCurrentUserId()).toBeNull();
  });

  it("returns null when payload is not valid JSON", () => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const invalidJsonPayload = btoa("not-json");
    const token = `${header}.${invalidJsonPayload}.fake-signature`;

    mockedGetToken.mockReturnValue(token);

    expect(getCurrentUserId()).toBeNull();
  });

  it("extracts userId from 'nameid' claim", () => {
    const token = createFakeJwt({ nameid: "user-abc-123" });
    mockedGetToken.mockReturnValue(token);

    expect(getCurrentUserId()).toBe("user-abc-123");
  });

  it("extracts userId from 'sub' claim", () => {
    const token = createFakeJwt({ sub: "user-sub-456" });
    mockedGetToken.mockReturnValue(token);

    expect(getCurrentUserId()).toBe("user-sub-456");
  });

  it("extracts userId from 'userId' claim", () => {
    const token = createFakeJwt({ userId: "user-id-789" });
    mockedGetToken.mockReturnValue(token);

    expect(getCurrentUserId()).toBe("user-id-789");
  });

  it("extracts userId from long-form nameidentifier claim", () => {
    const token = createFakeJwt({
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier":
        "user-long-claim",
    });
    mockedGetToken.mockReturnValue(token);

    expect(getCurrentUserId()).toBe("user-long-claim");
  });

  it("prioritizes 'nameid' over 'sub'", () => {
    const token = createFakeJwt({ nameid: "from-nameid", sub: "from-sub" });
    mockedGetToken.mockReturnValue(token);

    expect(getCurrentUserId()).toBe("from-nameid");
  });

  it("returns null when payload has no recognized user id claim", () => {
    const token = createFakeJwt({ email: "test@example.com", role: "admin" });
    mockedGetToken.mockReturnValue(token);

    expect(getCurrentUserId()).toBeNull();
  });

  it("returns null when claim value is empty string", () => {
    const token = createFakeJwt({ nameid: "   " });
    mockedGetToken.mockReturnValue(token);

    expect(getCurrentUserId()).toBeNull();
  });

  it("returns null for a token with only one part", () => {
    mockedGetToken.mockReturnValue("single-segment-token");

    expect(getCurrentUserId()).toBeNull();
  });
});