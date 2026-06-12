// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { FeedItem } from "@/models/feed";
import { API_BASE, apiFetch } from "@/lib/api";
import { formatDuration, parseLocalDate } from "@/lib/time";

type RawPlayer = {
  id: string;
  handle: string;
  name: string;
  avatar_url?: string;
  color: string;
};

type RawJourneyEntry = {
  id: string;
  igdb_id: number;
  game: string;
  cover_url?: string;
  genres: string[];
  release_year?: number;
  duration_seconds: number;
  log?: string;
  played_at: string;
  player: RawPlayer;
};

type RawActivityEntry = {
  type: "follow" | "comment" | "horizon_add";
  created_at: string;
  actor: RawPlayer;
  recipient: RawPlayer;
  subject_id?: string;
  subject_title?: string;
  subject_igdb_id?: number;
};

type RawFeedItem =
  | { kind: "journey"; journey: RawJourneyEntry }
  | { kind: "activity"; activity: RawActivityEntry };

function toPlayer(p: RawPlayer) {
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    avatarUrl: p.avatar_url,
    color: p.color,
  };
}

function toFeedItem(item: RawFeedItem): FeedItem {
  if (item.kind === "activity") {
    const a = item.activity;
    return {
      kind: "activity",
      activity: {
        type: a.type,
        createdAt: new Date(a.created_at),
        actor: toPlayer(a.actor),
        recipient: toPlayer(a.recipient),
        subjectId: a.subject_id,
        subjectTitle: a.subject_title,
        subjectIgdbId: a.subject_igdb_id,
      },
    };
  }
  const j = item.journey;
  return {
    kind: "journey",
    journey: {
      id: j.id,
      igdbId: j.igdb_id,
      player: toPlayer(j.player),
      game: j.game,
      coverUrl: j.cover_url,
      genres: j.genres,
      releaseYear: j.release_year,
      duration: formatDuration(j.duration_seconds),
      playedAt: parseLocalDate(j.played_at),
      log: j.log,
    },
  };
}

export async function getFeedItems(): Promise<FeedItem[]> {
  const resp = await apiFetch(`${API_BASE}/api/feed`, { credentials: "include" });
  if (!resp.ok) return [];
  const data: { items: RawFeedItem[] } = await resp.json();
  return (data.items ?? []).map(toFeedItem);
}

export async function getPlayerActivity(handle: string): Promise<FeedItem[]> {
  const resp = await apiFetch(`${API_BASE}/api/players/${handle}/activity`, { credentials: "include" });
  if (!resp.ok) return [];
  const data: { items: RawFeedItem[] } = await resp.json();
  return (data.items ?? []).map(toFeedItem);
}
