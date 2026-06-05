// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

export type Player = {
  id: string;
  name: string;
  handle: string;
  color: string;
  avatarUrl?: string;
  hasCustomAvatar?: boolean;
  hasCustomName?: boolean;
  bio?: string;
  isAdmin?: boolean;
  followers?: number;
  following?: number;
  isFollowing?: boolean;
};

export type RecentGame = {
  igdbId: number;
  name: string;
  coverUrl?: string;
  lastPlayed: Date;
};

export type GenreHours = {
  genre: string;
  seconds: number;
};

export type PlayerProfile = {
  player: Player;
  journeyCount: number;
  totalSeconds: number;
  recentGames: RecentGame[];
  genreHours: GenreHours[];
};
