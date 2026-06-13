// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type Journey = {
  id: string;
  igdbId: number;
  player: Player;
  game: string;
  coverUrl?: string;
  genres: string[];
  releaseYear?: number;
  duration: string;
  playedAt: Date;
  log?: string;
};

export type UpdateJourney = {
  igdbId: number;
  durationSeconds: number;
  playedAt: Date;
  log?: string;
};

export type PendingJourney = {
  id: string;
  igdbId?: number;
  game: string;
  coverUrl?: string;
  genres: string[];
  releaseYear?: number;
  duration: string;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
  exeName?: string;
  windowTitle?: string;
};

export type NewJourney = {
  igdbId?: number;
  durationSeconds: number;
  game: string;
  coverUrl?: string;
  genres: string[];
  playedAt: Date;
  log?: string;
};
