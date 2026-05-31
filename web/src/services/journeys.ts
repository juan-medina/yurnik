// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Journey, PendingJourney, NewJourney } from "@/models/journey";
import type { Comment, JourneyPlayer } from "@/models/game";
import type { Player } from "@/models/player";
import {
  MOCK_COMMENTS,
  MOCK_LIKERS,
  MOCK_PENDING_JOURNEYS,
} from "@/lib/mock";
import { API_BASE } from "@/lib/api";
import { formatDuration } from "@/lib/time";
import { getCurrentPlayer } from "./auth";

export const likedIds = new Set<string>();

let _discardedIds = new Set<string>();
let _confirmedJourneyIds = new Set<string>();
let _pendingJourneys: PendingJourney[] = [...MOCK_PENDING_JOURNEYS];

type RawJourneyDetail = {
  id: string;
  igdb_id: number;
  game: string;
  cover_url?: string;
  genres: string[];
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
  uri: string;
  igdb_id: number;
  game: string;
  cover_url?: string;
  genres: string[];
  played_at: string;
  duration_seconds: number;
  log?: string;
};

export async function getUserJourneys(): Promise<Journey[]> {
  const player = await getCurrentPlayer();
  console.log("[getUserJourneys] player:", player.id, player.handle);
  const url = `${API_BASE}/api/players/me/journeys`;
  const resp = await fetch(url, { credentials: "include" });
  console.log("[getUserJourneys] response status:", resp.status);
  if (!resp.ok) throw new Error(`get user journeys: ${resp.status}`);
  const data: { journeys: RawJourney[] } = await resp.json();
  console.log("[getUserJourneys] journeys count:", data.journeys?.length ?? 0);
  return (data.journeys ?? []).map((j): Journey => ({
    id: j.id,
    player,
    game: j.game,
    coverUrl: j.cover_url,
    genres: j.genres,
    duration: formatDuration(j.duration_seconds ?? 0),
    playedAt: new Date(j.played_at),
    log: j.log,
    likes: 0,
    liked: likedIds.has(j.id),
  }));
}

export async function getPendingJourneys(): Promise<PendingJourney[]> {
  const resp = await fetch(`${API_BASE}/api/players/me/journeys/pending`, {
    credentials: "include",
  });
  if (!resp.ok) {
    return _pendingJourneys.filter((p) => !_discardedIds.has(p.id));
  }
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
      endedAt,
      exeName: p.exe_name,
      windowTitle: p.window_title,
    };
  });
}

export async function toggleLike(journeyId: string): Promise<void> {
  if (likedIds.has(journeyId)) likedIds.delete(journeyId);
  else likedIds.add(journeyId);
}

export async function addJourney(input: NewJourney): Promise<void> {
  console.log("[addJourney] input:", JSON.stringify(input));
  if (!input.igdbId) throw new Error("addJourney: igdbId is required");
  const body = {
    igdb_id: input.igdbId,
    duration_seconds: input.durationSeconds,
    played_at: input.playedAt.toISOString(),
    log: input.log ?? null,
  };
  console.log("[addJourney] posting:", JSON.stringify(body));
  const resp = await fetch(`${API_BASE}/api/players/me/journeys`, {
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

export async function confirmPendingJourney(
  pendingId: string,
  input: { igdbId?: number; game: string; coverUrl?: string; genres: string[]; log?: string },
): Promise<void> {
  if (!input.igdbId) throw new Error("confirmPendingJourney: igdbId is required");
  const resp = await fetch(`${API_BASE}/api/players/me/journeys/pending/${pendingId}/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      igdb_id: input.igdbId,
      log: input.log ?? null,
    }),
  });
  if (!resp.ok) {
    _discardedIds.add(pendingId);
    _confirmedJourneyIds.add(pendingId);
    return;
  }
}

export async function dismissPendingJourney(pendingId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/players/me/journeys/pending/${pendingId}/discard`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) {
    _discardedIds.add(pendingId);
    return;
  }
}

export async function excludePendingJourney(pendingId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/players/me/journeys/pending/${pendingId}/exclude`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) {
    _discardedIds.add(pendingId);
    return;
  }
}

let _comments: Comment[] = [...MOCK_COMMENTS];
const _likers: Player[] = [...MOCK_LIKERS];
const extraComments = new Map<string, Comment[]>();

export async function getJourney(id: string): Promise<Journey | undefined> {
  const resp = await fetch(`${API_BASE}/api/journeys/${id}`, { credentials: "include" });
  if (resp.status === 404) return undefined;
  if (!resp.ok) throw new Error(`get journey: ${resp.status}`);
  const j: RawJourneyDetail = await resp.json();
  return {
    id: j.id,
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
    duration: formatDuration(j.duration_seconds),
    playedAt: new Date(j.played_at),
    log: j.log,
    likes: 0,
    liked: likedIds.has(j.id),
  };
}

export async function getComments(journeyId: string): Promise<Comment[]> {
  const base = journeyId === "s1" ? _comments : [];
  return [...base, ...(extraComments.get(journeyId) ?? [])];
}

export async function getLikers(_journeyId: string): Promise<Player[]> {
  return [..._likers];
}

export async function getJourneyPlayers(journeyId: string): Promise<{
  friends: JourneyPlayer[];
  others: JourneyPlayer[];
}> {
  const resp = await fetch(`${API_BASE}/api/journeys/${journeyId}/players`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get journey players: ${resp.status}`);
  const data: {
    players: {
      journey_id: string;
      player: { id: string; handle: string; name: string; avatar_url?: string; color: string; is_following: boolean };
      duration_seconds: number;
      played_at: string;
    }[];
  } = await resp.json();

  const others: JourneyPlayer[] = (data.players ?? []).map((p) => ({
    player: {
      id: p.player.id,
      handle: p.player.handle,
      name: p.player.name,
      avatarUrl: p.player.avatar_url,
      color: p.player.color,
    },
    duration: formatDuration(p.duration_seconds),
    playedAt: new Date(p.played_at),
    isFollowing: p.player.is_following,
  }));

  return { friends: [], others };
}

export async function postComment(journeyId: string, text: string): Promise<void> {
  const player = await getCurrentPlayer();
  const comment: Comment = {
    id: `new-${Date.now()}`,
    player,
    text,
    commentedAt: new Date(),
  };
  extraComments.set(journeyId, [...(extraComments.get(journeyId) ?? []), comment]);
}

export async function deleteJourney(journeyId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/players/me/journeys/${journeyId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`delete journey: ${resp.status}`);
}

export async function deleteComment(journeyId: string, commentId: string): Promise<void> {
  const extra = extraComments.get(journeyId);
  if (extra?.some((c) => c.id === commentId)) {
    extraComments.set(journeyId, extra.filter((c) => c.id !== commentId));
    return;
  }
  _comments = _comments.filter((c) => c.id !== commentId);
}

export function _reset(): void {
  likedIds.clear();
  extraComments.clear();
  _comments = [...MOCK_COMMENTS];
  _discardedIds.clear();
  _confirmedJourneyIds.clear();
  _pendingJourneys = [...MOCK_PENDING_JOURNEYS];
}
