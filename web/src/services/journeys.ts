// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Journey, PendingJourney, NewJourney } from "@/models/journey";
import type { Comment, JourneyPlayer } from "@/models/game";
import type { Player } from "@/models/player";
import {
  MOCK_COMMENTS,
  MOCK_LIKERS,
  MOCK_FRIENDS_ON_JOURNEY,
  MOCK_OTHERS_ON_JOURNEY,
} from "@/lib/mock";
import { API_BASE } from "@/lib/api";
import { formatDuration } from "@/lib/time";
import { isFollowingHandle } from "./players";
import { getCurrentPlayer } from "./auth";

export const likedIds = new Set<string>();

type RawPendingJourney = {
  id: string;
  status: string;
  igdb_id?: number;
  game_title?: string;
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
  game_title: string;
  cover_url?: string;
  genres: string[];
  played_at: string;
  duration_seconds: number;
};

export async function getUserJourneys(): Promise<Journey[]> {
  const player = await getCurrentPlayer();
  const resp = await fetch(
    `${API_BASE}/api/players/${encodeURIComponent(player.handle)}/journeys`,
    { credentials: "include" },
  );
  if (!resp.ok) throw new Error(`get user journeys: ${resp.status}`);
  const data: { journeys: RawJourney[] } = await resp.json();

  return (data.journeys ?? []).map((j): Journey => ({
    id: j.id,
    player,
    game: j.game_title,
    coverUrl: j.cover_url,
    genres: j.genres,
    duration: formatDuration(j.duration_seconds ?? 0),
    playedAt: new Date(j.played_at),
    likes: 0,
    liked: likedIds.has(j.id),
  }));
}

export async function getPendingJourneys(): Promise<PendingJourney[]> {
  const resp = await fetch(`${API_BASE}/api/pending-journeys`, {
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`get pending journeys: ${resp.status}`);
  const data: { pending_journeys: RawPendingJourney[] } = await resp.json();

  return (data.pending_journeys ?? []).map((p): PendingJourney => {
    const startedAt = new Date(p.started_at);
    const endedAt = p.ended_at ? new Date(p.ended_at) : new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
    return {
      id: p.id,
      igdbId: p.igdb_id,
      game: p.game_title ?? "",
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
  if (!input.igdbId) throw new Error("addJourney: igdbId is required");
  const resp = await fetch(`${API_BASE}/api/journeys`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      igdb_id: input.igdbId,
      duration_seconds: input.durationSeconds,
      played_at: input.playedAt.toISOString(),
      log: input.log ?? null,
    }),
  });
  if (!resp.ok) throw new Error(`add journey: ${resp.status}`);
}

export async function confirmPendingJourney(
  pendingId: string,
  input: { igdbId?: number; game: string; coverUrl?: string; genres: string[]; log?: string },
): Promise<void> {
  if (!input.igdbId) throw new Error("confirmPendingJourney: igdbId is required");
  const resp = await fetch(`${API_BASE}/api/pending-journeys/${pendingId}/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      igdb_id: input.igdbId,
      log: input.log ?? null,
    }),
  });
  if (!resp.ok) throw new Error(`confirm journey: ${resp.status}`);
}

export async function dismissPendingJourney(pendingId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/pending-journeys/${pendingId}/discard`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`discard journey: ${resp.status}`);
}

export async function excludePendingJourney(pendingId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/pending-journeys/${pendingId}/exclude`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`exclude journey: ${resp.status}`);
}

let _comments: Comment[] = [...MOCK_COMMENTS];
const _likers: Player[] = [...MOCK_LIKERS];
const _friendsOnJourney = [...MOCK_FRIENDS_ON_JOURNEY];
const _othersOnJourney = [...MOCK_OTHERS_ON_JOURNEY];
const extraComments = new Map<string, Comment[]>();

export async function getJourney(id: string): Promise<Journey | undefined> {
  const journey = [..._friendsOnJourney, ..._othersOnJourney].find((jp) => jp.player.id === id);
  void journey;
  // TODO: wire to real API in journey detail phase
  return undefined;
}

export async function getComments(journeyId: string): Promise<Comment[]> {
  const base = journeyId === "s1" ? _comments : [];
  return [...base, ...(extraComments.get(journeyId) ?? [])];
}

export async function getLikers(_journeyId: string): Promise<Player[]> {
  return [..._likers];
}

export async function getJourneyPlayers(_journeyId: string): Promise<{
  friends: JourneyPlayer[];
  others: JourneyPlayer[];
}> {
  return {
    friends: _friendsOnJourney.map((jp) => ({
      ...jp,
      isFollowing: isFollowingHandle(jp.player.handle),
    })),
    others: _othersOnJourney.map((jp) => ({
      ...jp,
      isFollowing: isFollowingHandle(jp.player.handle),
    })),
  };
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
  const resp = await fetch(`${API_BASE}/api/journeys/${journeyId}`, {
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
}
