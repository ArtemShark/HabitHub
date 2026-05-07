"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  UserPlus,
  RefreshCw,
  Crown,
  Copy,
  LogOut,
  Trash2,
  UserMinus,
  Target,
  MessageCircle,
} from "lucide-react";
import {
  Habit,
  HabitResponseDto,
  UpdateHabitRequestDto,
  HabitType,
} from "../dto/Habit";
import { mapHabit } from "../auxiliary/mapHabit";
import { apiFetch } from "../auxiliary/apiFetch";
import { getCurrentUserId } from "../auxiliary/getCurrentUserId";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import StatPill from "../components/StatPill";
import { itemVariants } from "../auxiliary/variants/itemVariant";
import { containerVariants } from "../auxiliary/variants/containerVariants";

type TeamMember = {
  memberId?: string;
  id?: string;
  displayName?: string;
  username?: string;
  name?: string;
  email?: string;
};

type TeamResponse = {
  habitTeamId: string;
  name: string;
  creatorId: string;
  members: TeamMember[];
};

type InviteCodeResponse = {
  code: string;
  expiryDate: string;
  habitTeamId: string;
};


function getMemberId(member: TeamMember): string {
  return member.memberId ?? member.id ?? "";
}

function getMemberName(member: TeamMember): string {
  return (
    member.displayName ??
    member.username ??
    member.name ??
    member.email ??
    "Unknown member"
  );
}

async function fetchTeams(): Promise<TeamResponse[]> {
  return apiFetch<TeamResponse[]>("/api/teams", { method: "GET" });
}

async function fetchTeam(teamId: string): Promise<TeamResponse> {
  return apiFetch<TeamResponse>(`/api/teams/${teamId}`, { method: "GET" });
}

async function fetchTeamHabits(teamId: string): Promise<Habit[]> {
  const dtos = await apiFetch<HabitResponseDto[]>(`/api/teams/${teamId}/habits`, {
    method: "GET",
  });

  return dtos.map(mapHabit);
}

async function createTeam(name: string): Promise<TeamResponse> {
  return apiFetch<TeamResponse>("/api/teams", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

async function createInviteCode(teamId: string): Promise<InviteCodeResponse> {
  return apiFetch<InviteCodeResponse>(`/api/teams/${teamId}/invite-codes`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function joinTeam(code: string): Promise<void> {
  await apiFetch<void>("/api/teams/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

async function kickMember(teamId: string, memberId: string): Promise<void> {
  await apiFetch<void>(`/api/teams/${teamId}/members/${memberId}/kick`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function leaveTeam(teamId: string): Promise<void> {
  await apiFetch<void>(`/api/teams/${teamId}/leave`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function deleteTeam(teamId: string): Promise<void> {
  await apiFetch<void>(`/api/teams/${teamId}`, {
    method: "DELETE",
  });
}

async function createHabit(
  teamId: string,
  payload: {
    name: string;
    goal: string;
    habitType: number;
    expiryDate: string;
    unit?: string | null;
  }
): Promise<Habit> {
  const dto = await apiFetch<HabitResponseDto>(`/api/teams/${teamId}/habits`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return mapHabit(dto);
}

async function updateHabit(habitId: string, payload: UpdateHabitRequestDto): Promise<Habit> {
  const dto = await apiFetch<HabitResponseDto>(`/api/habits/${habitId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapHabit(dto);
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamResponse | null>(null);

  const [teamHabits, setTeamHabits] = useState<Habit[]>([]);
  const [loadingHabits, setLoadingHabits] = useState(false);

  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingSelectedTeam, setLoadingSelectedTeam] = useState(false);

  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [habitName, setHabitName] = useState("");
  const [habitType, setHabitType] = useState<HabitType>("binary");
  const [habitGoal, setHabitGoal] = useState("");
  const [habitUnit, setHabitUnit] = useState("");
  const [habitEndDate, setHabitEndDate] = useState("");

  const [creatingTeam, setCreatingTeam] = useState(false);
  const [joiningTeam, setJoiningTeam] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);

  const [inviteResult, setInviteResult] = useState<InviteCodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const isCreator = useMemo(() => {
    if (!selectedTeam || !currentUserId) return false;
    return selectedTeam.creatorId === currentUserId;
  }, [selectedTeam, currentUserId]);

  const totalTeams = teams.length;
  const ownedTeams = useMemo(
    () => teams.filter((team) => team.creatorId === currentUserId).length,
    [teams, currentUserId]
  );
  const totalMembers = selectedTeam?.members.length ?? 0;

  function flashSuccess(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function loadTeams(preferredId?: string | null) {
    setLoadingTeams(true);
    setError(null);

    try {
      const data = await fetchTeams();
      setTeams(data);

      const nextSelected = preferredId ?? selectedTeamId ?? data[0]?.habitTeamId ?? null;
      setSelectedTeamId(nextSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams.");
    } finally {
      setLoadingTeams(false);
    }
  }

  async function loadSelectedTeam(teamId: string) {
    setLoadingSelectedTeam(true);
    setError(null);
    setInviteResult(null);

    try {
      const data = await fetchTeam(teamId);
      setSelectedTeam(data);
    } catch (err) {
      setSelectedTeam(null);
      setError(err instanceof Error ? err.message : "Failed to load team details.");
    } finally {
      setLoadingSelectedTeam(false);
    }
  }

  async function loadTeamHabits(teamId: string) {
    setLoadingHabits(true);

    try {
      const habits = await fetchTeamHabits(teamId);
      setTeamHabits(habits);
    } catch (err) {
      setTeamHabits([]);
      setError(err instanceof Error ? err.message : "Failed to load team habits.");
    } finally {
      setLoadingHabits(false);
    }
  }

  useEffect(() => {
    void loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setSelectedTeam(null);
      setTeamHabits([]);
      return;
    }

    void loadSelectedTeam(selectedTeamId);
    void loadTeamHabits(selectedTeamId);
  }, [selectedTeamId]);

  async function handleCreateTeam() {
    if (!createName.trim()) {
      setError("Team name is required.");
      return;
    }

    setCreatingTeam(true);
    setError(null);

    try {
      const created = await createTeam(createName.trim());
      setCreateName("");
      await loadTeams(created.habitTeamId);
      flashSuccess("Team created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team.");
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleJoinTeam() {
    if (!joinCode.trim()) {
      setError("Invite code is required.");
      return;
    }

    setJoiningTeam(true);
    setError(null);

    try {
      await joinTeam(joinCode.trim());
      setJoinCode("");
      await loadTeams();
      flashSuccess("Joined team successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join team.");
    } finally {
      setJoiningTeam(false);
    }
  }

  async function handleCreateInviteCode() {
    if (!selectedTeam) return;

    setCreatingInvite(true);
    setError(null);

    try {
      const result = await createInviteCode(selectedTeam.habitTeamId);
      setInviteResult(result);
      flashSuccess("Invite code generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invite code.");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleCreateHabit() {
    if (!selectedTeam) return;

    if (!habitName.trim()) {
        setError("Habit name is required.");
        return;
    }

    if (!habitGoal.trim()) {
        setError("Goal is required.");
        return;
    }

    if (!habitEndDate) {
        setError("End date is required.");
        return;
    }

    setCreatingHabit(true);
    setError(null);

    try {
        const payload = {
        name: habitName.trim(),
        goal: habitGoal.trim(), // must be string
        habitType: habitType === "binary" ? 0 : 1,
        expiryDate: new Date(habitEndDate).toISOString(), // required
        unit: habitUnit.trim() || null,
        };

        await createHabit(selectedTeam.habitTeamId, payload);

        setHabitName("");
        setHabitType("binary");
        setHabitGoal("");
        setHabitUnit("");
        setHabitEndDate("");

        await loadTeamHabits(selectedTeam.habitTeamId);
        flashSuccess("Habit created successfully.");
    } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create habit.");
    } finally {
        setCreatingHabit(false);
    }
    }

  async function handleCopyCode() {
    if (!inviteResult?.code) return;

    try {
      await navigator.clipboard.writeText(inviteResult.code);
      flashSuccess("Invite code copied.");
    } catch {
      setError("Could not copy invite code.");
    }
  }

  async function handleKick(memberId: string) {
    if (!selectedTeam) return;

    setKickingId(memberId);
    setError(null);

    try {
      await kickMember(selectedTeam.habitTeamId, memberId);
      await loadSelectedTeam(selectedTeam.habitTeamId);
      await loadTeams(selectedTeam.habitTeamId);
      flashSuccess("Member removed from team.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setKickingId(null);
    }
  }

  async function handleLeave() {
    if (!selectedTeam) return;

    setLeaving(true);
    setError(null);

    try {
      await leaveTeam(selectedTeam.habitTeamId);
      await loadTeams();
      flashSuccess("You left the team.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave team.");
    } finally {
      setLeaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedTeam) return;

    setDeleting(true);
    setError(null);

    try {
      const id = selectedTeam.habitTeamId;
      await deleteTeam(id);

      const updated = teams.filter((t) => t.habitTeamId !== id);
      setTeams(updated);
      setSelectedTeam(updated[0] ?? null);
      setSelectedTeamId(updated[0]?.habitTeamId ?? null);
      setTeamHabits([]);

      flashSuccess("Team deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team.");
    } finally {
      setDeleting(false);
    }
  }

  const openChat = (teamId: string) => {
    window.open(`/teams/${teamId}/chat`, "_blank");
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090F] px-4 py-6 text-white sm:px-6 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.10),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative mx-auto max-w-7xl rounded-[36px] border border-white/10 bg-black/35 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5 md:rounded-[42px] md:p-7"
      >
        <PageHeader
          title="Teams"
          subtitle="Create teams, invite members, manage collaboration, and add team habits."
          activePage="teams"
        />

        {(error || success) && (
          <div className="mt-6 space-y-3">
            {error && (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                {success}
              </div>
            )}
          </div>
        )}

        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_2fr]"
        >
          <motion.div variants={itemVariants} className="space-y-5">
            <Card>
              <SectionTitle
                icon={<Users className="h-5 w-5" />}
                title="Team Overview"
                subtitle="Quick insight into your teams and collaboration"
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <StatPill label="Teams" value={totalTeams} />
                <StatPill label="Owned" value={ownedTeams} />
                <StatPill label="Members" value={totalMembers}/>
              </div>

              <button
                onClick={() => void loadTeams(selectedTeamId)}
                disabled={loadingTeams}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {loadingTeams ? "Refreshing..." : "Refresh Teams"}
              </button>
            </Card>

            <Card>
              <SectionTitle
                icon={<Plus className="h-5 w-5" />}
                title="Create Team"
                subtitle="Start a new team for shared habits"
              />

              <div className="space-y-4">
                <div>
                  <label htmlFor="team-name" className="mb-2 block text-sm text-white/65">
                    Team Name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={createName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCreateName(e.target.value)
                    }
                    placeholder="e.g. Morning Momentum"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                  />
                </div>

                <button
                  onClick={() => void handleCreateTeam()}
                  disabled={creatingTeam}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {creatingTeam ? "Creating..." : "Create Team"}
                </button>
              </div>
            </Card>

            <Card>
              <SectionTitle
                icon={<UserPlus className="h-5 w-5" />}
                title="Join Team"
                subtitle="Use an invite code to join an existing team"
              />

              <div className="space-y-4">
                <div>
                  <label htmlFor="join-code" className="mb-2 block text-sm text-white/65">
                    Invite Code
                  </label>
                  <input
                    id="join-code"
                    type="text"
                    value={joinCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setJoinCode(e.target.value)
                    }
                    placeholder="Paste invite code here"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                  />
                </div>

                <button
                  onClick={() => void handleJoinTeam()}
                  disabled={joiningTeam}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {joiningTeam ? "Joining..." : "Join Team"}
                </button>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <SectionTitle
                icon={<Users className="h-5 w-5" />}
                title="Team Management"
                subtitle="Browse your teams, inspect members, manage access, and create habits"
              />

              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div>
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">Your Teams</h3>
                    <p className="mt-1 text-sm text-white/50">
                      Select a team to view details.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {loadingTeams ? (
                      <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-center">
                        <p className="text-sm text-white/50">Loading teams...</p>
                      </div>
                    ) : teams.length > 0 ? (
                      teams.map((team) => {
                        const active = selectedTeamId === team.habitTeamId;

                        return (
                          <motion.button
                            key={team.habitTeamId}
                            whileHover={{ y: -2 }}
                            type="button"
                            onClick={() => setSelectedTeamId(team.habitTeamId)}
                            className={`w-full rounded-[24px] border p-4 text-left transition ${
                              active
                                ? "border-emerald-400/30 bg-emerald-400/10"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-white">
                                  {team.name}
                                </p>
                                <p className="mt-1 text-xs text-white/50">
                                  {team.members.length} member
                                  {team.members.length === 1 ? "" : "s"}
                                </p>
                              </div>

                              {team.creatorId === currentUserId && (
                                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/20">
                                  Creator
                                </span>
                              )}
                            </div>
                          </motion.button>
                        );
                      })
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-center">
                        <p className="text-lg font-medium text-white/80">No teams yet</p>
                        <p className="mt-2 text-sm text-white/45">
                          Create a team or join one with an invite code.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {!selectedTeamId ? (
                    <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-center">
                      <p className="text-lg font-medium text-white/80">No team selected</p>
                      <p className="mt-2 text-sm text-white/45">
                        Choose a team from the left panel.
                      </p>
                    </div>
                  ) : loadingSelectedTeam ? (
                    <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-center">
                      <p className="text-sm text-white/50">Loading team details...</p>
                    </div>
                  ) : !selectedTeam ? (
                    <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-center">
                      <p className="text-sm text-white/50">Could not load this team.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{selectedTeam.name}</h3>
                            <p className="mt-1 text-sm text-white/50">
                              Manage members, access, and team habits.
                            </p>
                          </div>

                          {isCreator && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
                              <Crown className="h-3.5 w-3.5" />
                              You are the creator
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-white">Team Habits</h3>
                            <p className="mt-1 text-sm text-white/50">
                              Create and review habits shared inside this team.
                            </p>
                          </div>

                          <span className="rounded-full px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10">
                            {teamHabits.length}
                          </span>
                        </div>

                        <div className="mb-5 grid gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm text-white/65">
                              Habit Name
                            </label>
                            <input
                              type="text"
                              value={habitName}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setHabitName(e.target.value)
                              }
                              placeholder="e.g. Read 10 pages"
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/65">
                              Habit Type
                            </label>
                            <select
                              value={habitType}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                setHabitType(e.target.value as HabitType)
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                            >
                              <option value="binary" className="bg-[#0b1220]">
                                Binary
                              </option>
                              <option value="value" className="bg-[#0b1220]">
                                Value
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/65">
                              Goal
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={habitGoal}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setHabitGoal(e.target.value)
                              }
                              placeholder="e.g. 10"
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/65">
                              Unit
                            </label>
                            <input
                              type="text"
                              value={habitUnit}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setHabitUnit(e.target.value)
                              }
                              placeholder="e.g. pages, km"
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/65">
                              End Date
                            </label>
                            <input
                              type="date"
                              value={habitEndDate}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setHabitEndDate(e.target.value)
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <button
                              onClick={() => void handleCreateHabit()}
                              disabled={creatingHabit}
                              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Plus className="h-4 w-4" />
                              {creatingHabit ? "Creating..." : "Create Habit for Team"}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {loadingHabits ? (
                            <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-8 text-center">
                              <p className="text-sm text-white/50">Loading habits...</p>
                            </div>
                          ) : teamHabits.length > 0 ? (
                            <AnimatePresence mode="popLayout">
                              {teamHabits.map((habit) => (
                                <motion.div
                                  key={habit.id}
                                  layout
                                  initial={{ opacity: 0, y: 16 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -12 }}
                                  whileHover={{ y: -2 }}
                                  className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                                >
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-base font-semibold text-white">
                                          {habit.name}
                                        </h4>

                                        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300 ring-1 ring-cyan-400/20">
                                          {habit.type}
                                        </span>

                                        <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10">
                                          {habit.status}
                                        </span>
                                      </div>

                                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/55">
                                        {habit.goal !== undefined && (
                                          <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                                            Goal: {habit.goal}
                                            {habit.unit ? ` ${habit.unit}` : ""}
                                          </span>
                                        )}

                                        {habit.endDate && (
                                          <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                                            Ends: {new Date(habit.endDate).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-white/70">
                                      <Target className="h-5 w-5" />
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          ) : (
                            <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-8 text-center">
                              <p className="text-sm text-white/50">
                                No habits created for this team yet.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-white">Members</h3>
                            <p className="mt-1 text-sm text-white/50">
                              Team participants and permissions.
                            </p>
                          </div>

                          <span className="rounded-full px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10">
                            {selectedTeam.members.length}
                          </span>
                        </div>

                        <div className="space-y-4">
                          <AnimatePresence mode="popLayout">
                            {selectedTeam.members.map((member) => {
                              const memberId = getMemberId(member);
                              const isMe = !!currentUserId && memberId === currentUserId;
                              const isTeamCreator =
                                !!memberId && memberId === selectedTeam.creatorId;
                              const canKick =
                                isCreator && !isMe && !isTeamCreator && !!memberId;

                              return (
                                <motion.div
                                  key={memberId || getMemberName(member)}
                                  layout
                                  initial={{ opacity: 0, y: 16 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -12 }}
                                  whileHover={{ y: -2 }}
                                  className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                                >
                                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-base font-semibold text-white">
                                          {getMemberName(member)}
                                        </h4>

                                        {isMe && (
                                          <span className="rounded-full px-3 py-1 text-xs font-medium text-cyan-300 ring-1 ring-cyan-400/20 bg-cyan-400/10">
                                            You
                                          </span>
                                        )}

                                        {isTeamCreator && (
                                          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20 bg-amber-400/10">
                                            <Crown className="h-3 w-3" />
                                            Creator
                                          </span>
                                        )}
                                      </div>

                                      <p className="mt-2 text-sm text-white/55">
                                        {member.email || "No email available."}
                                      </p>
                                    </div>

                                    {canKick && (
                                      <button
                                        onClick={() => void handleKick(memberId)}
                                        disabled={kickingId === memberId}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <UserMinus className="h-4 w-4" />
                                        {kickingId === memberId ? "Removing..." : "Kick"}
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>


                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <button
                        onClick={() => openChat(selectedTeam.habitTeamId)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
                      >
                        <MessageCircle size={16} />
                        Chat
                      </button>
                    </div>


                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-white">Team Actions</h3>
                          <p className="mt-1 text-sm text-white/50">
                            Invite new members or manage this team.
                          </p>
                        </div>

                        <div className="flex flex-col gap-3">
                          {isCreator && (
                            <>
                              <button
                                onClick={() => void handleCreateInviteCode()}
                                disabled={creatingInvite}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <UserPlus className="h-4 w-4" />
                                {creatingInvite ? "Generating..." : "Generate Invite Code"}
                              </button>

                              {inviteResult && (
                                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                                    Invite Code
                                  </p>
                                  <p className="mt-2 break-all text-base font-semibold text-white">
                                    {inviteResult.code}
                                  </p>
                                  <p className="mt-2 text-xs text-white/50">
                                    Expires: {new Date(inviteResult.expiryDate).toLocaleString()}
                                  </p>

                                  <button
                                    onClick={() => void handleCopyCode()}
                                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                                  >
                                    <Copy className="h-4 w-4" />
                                    Copy Code
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          <button
                            onClick={() => void handleLeave()}
                            disabled={leaving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <LogOut className="h-4 w-4" />
                            {leaving ? "Leaving..." : "Leave Team"}
                          </button>

                          {isCreator && (
                            <button
                              onClick={() => void handleDelete()}
                              disabled={deleting}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-3 text-sm font-medium text-rose-300 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              {deleting ? "Deleting..." : "Delete Team"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.section>
      </motion.div>
    </main>
  );
}