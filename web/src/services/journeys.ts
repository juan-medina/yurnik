// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Journey, PendingJourney, NewJourney, UpdateJourney } from "@/models/journey";
import type { Comment, JourneyPlayer } from "@/models/game";
import { API_BASE, apiFetch } from "@/lib/api";
import { formatDuration, formatLocalDate, parseLocalDate } from "@/lib/time";
import { getCurrentPlayer } from "./auth";

type RawJourneyDetail = {
  id: string;
  igdb_id: number;
  game: string;
  cover_url?: string;
  genres: string[];
  release_year?: number;
  duration_seconds: number;
  log?: string;
  played_at: string;
  player: {
    id: string;
    handle: string;
    name: string;
    avatar_url?: string;
    color: string;
  };
};

type RawPendingJourney = {
  id: string;
  status: string;
  igdb_id?: number;
  game?: string;
  cover_url?: string;
  genres?: string[];
  exe_name?: string;
  window_title?: string;
  started_at: string;
  ended_at?: string;
};

type RawJourney = {
  id: string;
  igdb_id: number;
  game: string;
  cover_url?: string;
  genres: string[];
  release_year?: number;
  played_at: string;
  duration_seconds: number;
  log?: string;
};

export async function getUserJourneys(): Promise<Journey[]> {
  const player = await getCurrentPlayer();
  console.log("[getUserJourneys] player:", player.id, player.handle);
  const url = `${API_BASE}/api/players/me/journeys`;
  const resp = await apiFetch(url, { credentials: "include" });
  console.log("[getUserJourneys] response status:", resp.status);
  if (!resp.ok) throw new Error(`get user journeys: ${resp.status}`);
  const data: { journeys: RawJourney[] } = await resp.json();
  console.log("[getUserJourneys] journeys count:", data.journeys?.length ?? 0);
  return (data.journeys ?? []).map((j): Journey => ({
    id: j.id,
    igdbId: j.igdb_id,
    player,
    game: j.game,
    coverUrl: j.cover_url,
    genres: j.genres,
    releaseYear: j.release_year,
    duration: formatDuration(j.duration_seconds ?? 0),
    playedAt: parseLocalDate(j.played_at),
    log: j.log,
  }));
}

export async function getPendingJourneys(): Promise<PendingJourney[]> {
  const resp = await apiFetch(`${API_BASE}/api/players/me/journeys/pending`, {
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`get pending journeys: ${resp.status}`);
  const data: { journeys: RawPendingJourney[] } = await resp.json();

  return (data.journeys ?? []).map((p): PendingJourney => {
    const startedAt = new Date(p.started_at);
    const endedAt = p.ended_at ? new Date(p.ended_at) : new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
    return {
      id: p.id,
      igdbId: p.igdb_id,
      game: p.game ?? "",
      coverUrl: p.cover_url,
      genres: p.genres ?? [],
      duration: formatDuration(durationSeconds),
      durationSeconds,
      startedAt,
      endedAt,
      exeName: p.exe_name,
      windowTitle: p.window_title,
    };
  });
}

export async function getPendingJourneysCount(): Promise<number> {
  const resp = await apiFetch(`${API_BASE}/api/players/me/journeys/pending/count`, {
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`get pending journeys count: ${resp.status}`);
  const data: { count: number } = await resp.json();
  return data.count ?? 0;
}

export async function addJourney(input: NewJourney): Promise<void> {
  console.log("[addJourney] input:", JSON.stringify(input));
  if (!input.igdbId) throw new Error("addJourney: igdbId is required");
  const body = {
    igdb_id: input.igdbId,
    duration_seconds: input.durationSeconds,
    played_at: formatLocalDate(input.playedAt),
    log: input.log ?? null,
  };
  console.log("[addJourney] posting:", JSON.stringify(body));
  const resp = await apiFetch(`${API_BASE}/api/players/me/journeys`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("[addJourney] response status:", resp.status);
  if (!resp.ok) {
    const text = await resp.text();
    console.log("[addJourney] error body:", text);
    throw new Error(`add journey: ${resp.status}`);
  }
  console.log("[addJourney] success");
}

export async function updateJourney(id: string, input: UpdateJourney): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/players/me/journeys/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      igdb_id: input.igdbId,
      duration_seconds: input.durationSeconds,
      played_at: formatLocalDate(input.playedAt),
      log: input.log ?? null,
    }),
  });
  if (!resp.ok) throw new Error(`update journey: ${resp.status}`);
}

export async function confirmPendingJourney(
  pendingId: string,
  input: { igdbId?: number; game: string; coverUrl?: string; genres: string[]; durationSeconds?: number; playedAt?: Date; log?: string },
): Promise<void> {
  if (!input.igdbId) throw new Error("confirmPendingJourney: igdbId is required");
  const resp = await apiFetch(`${API_BASE}/api/players/me/journeys/pending/${pendingId}/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      igdb_id: input.igdbId,
      duration_seconds: input.durationSeconds,
      played_at: input.playedAt ? formatLocalDate(input.playedAt) : undefined,
      log: input.log ?? null,
    }),
  });
  if (!resp.ok) throw new Error(`confirm pending journey: ${resp.status}`);
}

export async function dismissPendingJourney(pendingId: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/players/me/journeys/pending/${pendingId}/discard`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`dismiss pending journey: ${resp.status}`);
}

export async function excludePendingJourney(pendingId: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/players/me/journeys/pending/${pendingId}/exclude`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`exclude pending journey: ${resp.status}`);
}

type RawComment = {
  id: string;
  player: { id: string; handle: string; name: string; avatar_url?: string; color: string };
  text: string;
  commented_at: string;
};

export async function getJourney(id: string): Promise<Journey | undefined> {
  const resp = await apiFetch(`${API_BASE}/api/journeys/${id}`, { credentials: "include" });
  if (resp.status === 404) return undefined;
  if (!resp.ok) throw new Error(`get journey: ${resp.status}`);
  const j: RawJourneyDetail = await resp.json();
  return {
    id: j.id,
    igdbId: j.igdb_id,
    player: {
      id: j.player.id,
      handle: j.player.handle,
      name: j.player.name,
      avatarUrl: j.player.avatar_url,
      color: j.player.color,
    },
    game: j.game,
    coverUrl: j.cover_url,
    genres: j.genres,
    releaseYear: j.release_year,
    duration: formatDuration(j.duration_seconds),
    playedAt: parseLocalDate(j.played_at),
    log: j.log,
  };
}

function toComment(c: RawComment): Comment {
  return {
    id: c.id,
    player: {
      id: c.player.id,
      handle: c.player.handle,
      name: c.player.name,
      avatarUrl: c.player.avatar_url,
      color: c.player.color,
    },
    text: c.text,
    commentedAt: new Date(c.commented_at),
  };
}

export async function getComments(journeyId: string): Promise<Comment[]> {
  const resp = await apiFetch(`${API_BASE}/api/journeys/${journeyId}/comments`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get comments: ${resp.status}`);
  const data: { comments: RawComment[] } = await resp.json();
  return (data.comments ?? []).map(toComment);
}

export async function getJourneyPlayers(journeyId: string): Promise<{
  following: JourneyPlayer[];
  others: JourneyPlayer[];
}> {
  const resp = await apiFetch(`${API_BASE}/api/journeys/${journeyId}/players`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get journey players: ${resp.status}`);
  const data: {
    players: {
      journey_id: string;
      player: { id: string; handle: string; name: string; avatar_url?: string; color: string; is_following: boolean };
      duration_seconds: number;
      played_at: string;
    }[];
  } = await resp.json();

  const all: JourneyPlayer[] = (data.players ?? []).map((p) => ({
    player: {
      id: p.player.id,
      handle: p.player.handle,
      name: p.player.name,
      avatarUrl: p.player.avatar_url,
      color: p.player.color,
    },
    duration: formatDuration(p.duration_seconds),
    playedAt: parseLocalDate(p.played_at),
    isFollowing: p.player.is_following,
    isSelf: false,
    journeyId: p.journey_id,
  }));

  const following = all.filter((p) => p.isFollowing);
  const others = all.filter((p) => !p.isFollowing);
  return { following, others };
}

export async function postComment(journeyId: string, text: string): Promise<Comment> {
  const resp = await apiFetch(`${API_BASE}/api/journeys/${journeyId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) throw new Error(`post comment: ${resp.status}`);
  const data: RawComment = await resp.json();
  return toComment(data);
}

export async function deleteJourney(journeyId: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/players/me/journeys/${journeyId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`delete journey: ${resp.status}`);
}

export async function deleteComment(journeyId: string, commentId: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/journeys/${journeyId}/comments/${commentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`delete comment: ${resp.status}`);
}

