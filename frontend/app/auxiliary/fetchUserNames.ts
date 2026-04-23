import { getToken } from "./apiFetch";

type MemberBasicDto = {
  memberId: string;
  name: string;
};

const userCache: Record<string, string> = {};

export async function fetchUserNamesByIds(
  userIds: string[]
): Promise<Record<string, string>> {
  const token = getToken();

  const uniqueIds = [...new Set(userIds)];

  if (uniqueIds.length === 0) return {};

  const missingIds = uniqueIds.filter((id) => !userCache[id]);

  if (missingIds.length > 0) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/members/info?ids=${missingIds.join(",")}`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to load member names");
    }

    const users: MemberBasicDto[] = await res.json();

    for (const user of users) {
      userCache[user.memberId] = user.name;
    }
  }

  const result: Record<string, string> = {};
  for (const id of uniqueIds) {
    result[id] = userCache[id] ?? id; 
  }

  return result;
}
