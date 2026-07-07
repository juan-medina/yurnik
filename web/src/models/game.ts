// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type Game = {
  id: string;
  game: string;
  coverUrl?: string;
  genres: string[];
  releaseYear?: number;
  category?: number;
};

export type GameDetail = {
  id: string;
  name: string;
  coverUrl?: string;
  genres: string[];
  releaseYear?: number;
  releaseDate?: Date;
  igdbSlug?: string;
  platforms: string[];
  developer?: string;
  publisher?: string;
  summary?: string;
  screenshots: string[];
  videos?: string[];
  storeLinks: Record<string, string>;
  aggregatedRating?: number;
  rating?: number;
  inHorizon: boolean;
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
  coverUrl?: string;
  genres: string[];
  releaseYear?: number;
  entries: JourneyEntry[];
};

export type CommentMention = {
  userId: string;
  handle: string;
  name: string;
  startOffset: number;
  length: number;
};

export type Comment = {
  id: string;
  player: Player;
  text: string;
  commentedAt: Date;
  mentions: CommentMention[];
};

export type JourneyPlayer = {
  journeyId: string;
  player: Player;
  duration: string;
  playedAt: Date;
  isFollowing: boolean;
  isSelf: boolean;
};
