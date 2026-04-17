import TeamChatPage from "./team-chat-page";

export default async function Page({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  return <TeamChatPage teamId={teamId} />;
}