// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type Game = {
  id: string;
  game: string;
  coverColor: string;
  coverAccent: string;
  coverUrl?: string;
  genres: string[];
};

export type JourneyEntry = {
  sessionId: string;
  player: Player;
  duration: string;
  playedAt: Date;
  log?: string;
};

export type GameActivity = {
  id: string;
  game: string;
  coverColor: string;
  coverAccent: string;
  coverUrl?: string;
  genres: string[];
  entries: JourneyEntry[];
};

export type Comment = {
  id: string;
  player: Player;
  text: string;
  commentedAt: Date;
};

export type JourneyPlayer = {
  player: Player;
  duration: string;
  playedAt: Date;
  isFollowing: boolean;
};
