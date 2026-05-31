// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Game, GameActivity } from "@/models/game";
import { GAME_LIBRARY } from "@/lib/mock";
import { API_BASE } from "@/lib/api";
import { formatDuration } from "@/lib/time";

const _library: Game[] = [...GAME_LIBRARY];

export async function getGameLibrary(): Promise<Game[]> {
  return [..._library];
}

export async function searchGames(query: string): Promise<Game[]> {
  if (query.length < 2) return [];
  try {
    const resp = await fetch(`${API_BASE}/api/games/search?q=${encodeURIComponent(query)}`, {
      credentials: "include",
    });
    if (!resp.ok) throw new Error(`game search failed: ${resp.status}`);
    const raw: { id: string; name: string; cover_url?: string; genres: string[] }[] = await resp.json();
    return raw.map((g) => ({
      id: g.id,
      game: g.name,
      coverUrl: g.cover_url,
      genres: g.genres ?? [],
    }));
  } catch {
    return _library.filter((g) => g.game.toLowerCase().includes(query.toLowerCase()));
  }
}

export async function getGameActivity(): Promise<GameActivity[]> {
  const resp = await fetch(`${API_BASE}/api/activity`, { credentials: "include" });
  if (!resp.ok) throw new Error(`activity failed: ${resp.status}`);
  const raw: {
    games: {
      id: string;
      game: string;
      cover_url?: string;
      genres: string[];
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
