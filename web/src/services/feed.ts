// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Journey } from "@/models/journey";
import { API_BASE } from "@/lib/api";
import { formatDuration } from "@/lib/time";

type RawFeedEntry = {
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
  like_count: number;
  is_liked: boolean;
};

export async function getFeedJourneys(): Promise<Journey[]> {
  const resp = await fetch(`${API_BASE}/api/feed`, { credentials: "include" });
  if (!resp.ok) return [];
  const data: { journeys: RawFeedEntry[] } = await resp.json();
  return (data.journeys ?? []).map((j): Journey => ({
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
    duration: formatDuration(j.duration_seconds),
    playedAt: new Date(j.played_at),
    log: j.log,
    likes: j.like_count,
    liked: j.is_liked,
  }));
}
