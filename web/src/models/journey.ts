// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type Journey = {
  id: string;
  player: Player;
  game: string;
  coverUrl?: string;
  genres: string[];
  duration: string;
  playedAt: Date;
  log?: string;
  likes: number;
  liked: boolean;
};

export type PendingJourney = {
  id: string;
  igdbId?: number;
  game: string;
  coverUrl?: string;
  genres: string[];
  duration: string;
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
  duration: string;
  playedAt: Date;
  log?: string;
};
