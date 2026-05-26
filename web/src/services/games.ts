// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Game, GameActivity } from "@/models/game";
import { GAME_LIBRARY, MOCK_GAME_ACTIVITY } from "@/lib/mock";
import { API_BASE } from "@/lib/api";

export async function getGameLibrary(): Promise<Game[]> {
  return GAME_LIBRARY;
}

export async function searchGames(query: string): Promise<Game[]> {
  if (query.length < 2) return [];
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
}

export async function getGameActivity(): Promise<GameActivity[]> {
  return MOCK_GAME_ACTIVITY;
}
