// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Exclusion, GameHint } from "@/models/settings";
import { MOCK_EXCLUSIONS, MOCK_GAME_HINTS } from "@/lib/mock";

let _exclusions: Exclusion[] = [...MOCK_EXCLUSIONS];
let _hints: GameHint[] = [...MOCK_GAME_HINTS];

export async function getExclusions(): Promise<Exclusion[]> {
  return [..._exclusions];
}

export async function addExclusion(exeName: string): Promise<void> {
  if (!_exclusions.find((e) => e.exeName === exeName)) {
    _exclusions = [..._exclusions, { exeName }];
  }
}

export async function removeExclusion(exeName: string): Promise<void> {
  _exclusions = _exclusions.filter((e) => e.exeName !== exeName);
}

export async function getGameHints(): Promise<GameHint[]> {
  return [..._hints];
}

export async function addGameHint(exeName: string, game: string): Promise<void> {
  if (!_hints.find((h) => h.exeName === exeName)) {
    _hints = [..._hints, { exeName, game }];
  }
}

export async function removeGameHint(exeName: string): Promise<void> {
  _hints = _hints.filter((h) => h.exeName !== exeName);
}

export async function updateGameHint(exeName: string, game: string): Promise<void> {
  _hints = _hints.map((h) => (h.exeName === exeName ? { ...h, game } : h));
}

export function _reset(): void {
  _exclusions = [...MOCK_EXCLUSIONS];
  _hints = [...MOCK_GAME_HINTS];
}
