// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Game, GameActivity, GameDetail, JourneyPlayer } from "@/models/game";
import { API_BASE, apiFetch } from "@/lib/api";
import { formatDuration } from "@/lib/time";

type RawJourneyPlayer = {
  journey_id: string;
  player: {
    id: string;
    handle: string;
    name: string;
    avatar_url?: string;
    color: string;
    is_following: boolean;
    is_self: boolean;
  };
  duration_seconds: number;
  played_at: string;
};

export async function getGameDetail(igdbId: string): Promise<GameDetail | undefined> {
  const resp = await apiFetch(`${API_BASE}/api/games/${igdbId}`, { credentials: "include" });
  if (resp.status === 404) return undefined;
  if (!resp.ok) throw new Error(`get game detail: ${resp.status}`);
  const g: {
    id: string; name: string; cover_url?: string; genres: string[]; release_year?: number;
    platforms: string[]; developer?: string; publisher?: string; summary?: string;
    screenshots: string[]; trailer_id?: string; store_links?: Record<string, string>;
    aggregated_rating?: number; rating?: number;
  } = await resp.json();
  return {
    id: g.id,
    name: g.name,
    coverUrl: g.cover_url,
    genres: g.genres,
    releaseYear: g.release_year,
    platforms: g.platforms ?? [],
    developer: g.developer,
    publisher: g.publisher,
    summary: g.summary,
    screenshots: g.screenshots ?? [],
    trailerId: g.trailer_id,
    storeLinks: g.store_links ?? {},
    aggregatedRating: g.aggregated_rating,
    rating: g.rating,
  };
}

export async function getGameJourneys(igdbId: string): Promise<{
  self?: JourneyPlayer;
  following: JourneyPlayer[];
  others: JourneyPlayer[];
}> {
  const resp = await apiFetch(`${API_BASE}/api/games/${igdbId}/journeys`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get game journeys: ${resp.status}`);
  const data: { players: RawJourneyPlayer[] } = await resp.json();

  let self: JourneyPlayer | undefined;
  const following: JourneyPlayer[] = [];
  const others: JourneyPlayer[] = [];
  for (const p of data.players ?? []) {
    const entry: JourneyPlayer = {
      player: { id: p.player.id, handle: p.player.handle, name: p.player.name, avatarUrl: p.player.avatar_url, color: p.player.color },
      duration: formatDuration(p.duration_seconds),
      playedAt: new Date(p.played_at),
      isFollowing: p.player.is_following,
      isSelf: p.player.is_self,
    };
    if (p.player.is_self) {
      self = entry;
    } else if (p.player.is_following) {
      following.push(entry);
    } else {
      others.push(entry);
    }
  }
  return { self, following, others };
}

export async function searchGames(query: string, offset = 0): Promise<Game[]> {
  if (query.length < 2) return [];
  const resp = await apiFetch(`${API_BASE}/api/games/search?q=${encodeURIComponent(query)}&offset=${offset}`, {
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`game search failed: ${resp.status}`);
  const raw: { id: string; name: string; cover_url?: string; genres: string[]; release_year?: number; category?: number }[] = await resp.json();
  return raw.map((g) => ({
    id: g.id,
    game: g.name,
    coverUrl: g.cover_url,
    genres: g.genres ?? [],
    releaseYear: g.release_year,
    category: g.category,
  }));
}

export async function getGameActivity(): Promise<GameActivity[]> {
  const resp = await apiFetch(`${API_BASE}/api/activity`, { credentials: "include" });
  if (!resp.ok) throw new Error(`activity failed: ${resp.status}`);
  const raw: {
    games: {
      id: string;
      game: string;
      cover_url?: string;
      genres: string[];
      release_year?: number;
      entries: {
        session_id: string;
        player: { id: string; handle: string; name: string; avatar_url?: string; color: string };
        duration_seconds: number;
        played_at: string;
        log?: string;
      }[];
    }[];
  } = await resp.json();
  return raw.games.map((g) => ({
    id: g.id,
    game: g.game,
    coverUrl: g.cover_url,
    genres: g.genres,
    releaseYear: g.release_year,
    entries: g.entries.map((e) => ({
      sessionId: e.session_id,
      player: {
        id: e.player.id,
        handle: e.player.handle,
        name: e.player.name,
        avatarUrl: e.player.avatar_url,
        color: e.player.color,
      },
      duration: formatDuration(e.duration_seconds),
      playedAt: new Date(e.played_at),
      log: e.log,
    })),
  }));
}
