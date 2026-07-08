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
  followers?: number;
  following?: number;
  isFollowing?: boolean;
  isAdmin?: boolean;
  notificationPreferences?: NotificationPreferences;
};

export type NotificationPreferences = {
  updates: boolean;
  notifications: boolean;
};

export type RecentGame = {
  igdbId: number;
  name: string;
  coverUrl?: string;
  releaseYear?: number;
  lastPlayed: Date;
  secondsPlayed: number;
};

export type GenreHours = {
  genre: string;
  seconds: number;
};

export type BacklogEntry = {
  igdbId: number;
  name: string;
  coverUrl?: string;
  genres: string[];
  releaseYear?: number;
  releaseDate?: Date;
};

export type PlayerProfile = {
  player: Player;
  journeyCount: number;
  totalSeconds: number;
  recentGames: RecentGame[];
  genreHours: GenreHours[];
  backlog: BacklogEntry[];
};
