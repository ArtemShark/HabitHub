const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

jest.mock("./apiFetch", () => ({
  getToken: jest.fn(() => "test-token"),
}));

function mockMembersResponse(members: { memberId: string; name: string }[]) {
  return {
    ok: true,
    json: async () => members,
  };
}

let testCounter = 0;
function uniqueId() {
  testCounter++;
  return `user-${testCounter}`;
}

async function loadFetchUserNamesByIds() {
  const mod = await import("./fetchUserNames");
  return mod.fetchUserNamesByIds;
}

describe("fetchUserNamesByIds", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    testCounter = 0;
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://test";
    global.fetch = mockFetch as typeof fetch;
  });

  it("returns empty object for empty array", async () => {
    const fetchUserNamesByIds = await loadFetchUserNamesByIds();

    const result = await fetchUserNamesByIds([]);

    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches member names from API", async () => {
    const fetchUserNamesByIds = await loadFetchUserNamesByIds();
    const id1 = uniqueId();
    const id2 = uniqueId();

    mockFetch.mockResolvedValueOnce(
      mockMembersResponse([
        { memberId: id1, name: "Alice" },
        { memberId: id2, name: "Bob" },
      ])
    );

    const result = await fetchUserNamesByIds([id1, id2]);

    expect(result[id1]).toBe("Alice");
    expect(result[id2]).toBe("Bob");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("calls API with correct URL containing member ids", async () => {
    const fetchUserNamesByIds = await loadFetchUserNamesByIds();
    const id = uniqueId();

    mockFetch.mockResolvedValueOnce(
      mockMembersResponse([{ memberId: id, name: "Alice" }])
    );

    await fetchUserNamesByIds([id]);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/members/info?ids=");
    expect(url).toContain(id);
  });

  it("sets Authorization header from token", async () => {
    const fetchUserNamesByIds = await loadFetchUserNamesByIds();
    const id = uniqueId();

    mockFetch.mockResolvedValueOnce(
      mockMembersResponse([{ memberId: id, name: "Alice" }])
    );

    await fetchUserNamesByIds([id]);

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect((options.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token"
    );
  });

  it("deduplicates input ids", async () => {
    const fetchUserNamesByIds = await loadFetchUserNamesByIds();
    const id = uniqueId();

    mockFetch.mockResolvedValueOnce(
      mockMembersResponse([{ memberId: id, name: "Alice" }])
    );

    await fetchUserNamesByIds([id, id, id]);

    const url = mockFetch.mock.calls[0][0] as string;
    const idsParam = url.split("ids=")[1];
    expect(idsParam.split(",").filter((s: string) => s === id)).toHaveLength(1);
  });

  it("returns memberId as fallback when name not found", async () => {
    const fetchUserNamesByIds = await loadFetchUserNamesByIds();
    const id = uniqueId();

    mockFetch.mockResolvedValueOnce(mockMembersResponse([]));

    const result = await fetchUserNamesByIds([id]);

    expect(result[id]).toBe(id);
  });

  it("throws when API returns error", async () => {
    const fetchUserNamesByIds = await loadFetchUserNamesByIds();
    const id = uniqueId();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchUserNamesByIds([id])).rejects.toThrow(
      "Failed to load member names"
    );
  });
});