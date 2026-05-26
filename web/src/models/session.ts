// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type Session = {
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

export type PendingSession = {
  id: string;
  game: string;
  coverUrl?: string;
  genres: string[];
  duration: string;
  endedAt: Date;
  exeName?: string;
  windowTitle?: string;
};

export type NewSession = {
  game: string;
  coverUrl?: string;
  genres: string[];
  duration: string;
  playedAt: Date;
  log?: string;
};
