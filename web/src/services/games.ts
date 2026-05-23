// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Game, GameActivity } from "@/models/game";
import { GAME_LIBRARY, MOCK_GAME_ACTIVITY } from "@/lib/mock";

export async function getGameLibrary(): Promise<Game[]> {
  return GAME_LIBRARY;
}

export async function searchGames(query: string): Promise<Game[]> {
  const q = query.toLowerCase();
  return GAME_LIBRARY.filter((g) => g.game.toLowerCase().includes(q)).slice(0, 6);
}

export async function getGameActivity(): Promise<GameActivity[]> {
  return MOCK_GAME_ACTIVITY;
}
