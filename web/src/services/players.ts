// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player, PlayerProfile } from "@/models/player";
import { API_BASE, apiFetch } from "@/lib/api";

type RawPlayer = {
  id: string;
  handle: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  color: string;
  followers?: number;
  following?: number;
  is_following?: boolean;
  is_admin?: boolean;
};

function rawToPlayer(p: RawPlayer): Player {
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    avatarUrl: p.avatar_url,
    bio: p.bio,
    color: p.color,
    followers: p.followers,
    following: p.following,
    isFollowing: p.is_following,
    isAdmin: p.is_admin,
  };
}

type RawProfileSummary = {
  id: string;
  handle: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  color: string;
  followers: number;
  following: number;
  is_following: boolean;
  is_admin?: boolean;
  journey_count: number;
  total_seconds: number;
  recent_games: {
    igdb_id: number;
    name: string;
    cover_url?: string;
    release_year?: number;
    last_played: string;
    seconds_played: number;
  }[];
  genre_hours: { genre: string; seconds: number }[];
  backlog: { igdb_id: number; name: string; cover_url?: string; genres: string[]; release_year?: number }[];
};

function rawToPlayerProfile(r: RawProfileSummary): PlayerProfile {
  return {
    player: {
      id: r.id,
      handle: r.handle,
      name: r.name,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      color: r.color,
      followers: r.followers,
      following: r.following,
      isFollowing: r.is_following,
      isAdmin: r.is_admin,
    },
    journeyCount: r.journey_count,
    totalSeconds: r.total_seconds,
    recentGames: (r.recent_games ?? []).map((g) => ({
      igdbId: g.igdb_id,
      name: g.name,
      coverUrl: g.cover_url,
      releaseYear: g.release_year,
      lastPlayed: new Date(g.last_played),
      secondsPlayed: g.seconds_played,
    })),
    genreHours: r.genre_hours ?? [],
    backlog: (r.backlog ?? []).map((g) => ({
      igdbId: g.igdb_id,
      name: g.name,
      coverUrl: g.cover_url,
      genres: g.genres ?? [],
      releaseYear: g.release_year,
    })),
  };
}

export async function getPlayerProfile(id: string): Promise<PlayerProfile | undefined> {
  const resp = await apiFetch(`${API_BASE}/api/players/${id}/profile`, { credentials: "include" });
  if (resp.status === 404) return undefined;
  if (!resp.ok) throw new Error(`get player profile: ${resp.status}`);
  return rawToPlayerProfile(await resp.json());
}

export async function getMyProfile(): Promise<PlayerProfile | undefined> {
  const resp = await apiFetch(`${API_BASE}/api/me/profile`, { credentials: "include" });
  if (resp.status === 401 || resp.status === 404) return undefined;
  if (!resp.ok) throw new Error(`get my profile: ${resp.status}`);
  return rawToPlayerProfile(await resp.json());
}

export async function getPlayer(id: string): Promise<Player | undefined> {
  const resp = await apiFetch(`${API_BASE}/api/players/${id}`, { credentials: "include" });
  if (resp.status === 404) return undefined;
  if (!resp.ok) throw new Error(`get player: ${resp.status}`);
  const p: RawPlayer = await resp.json();
  return rawToPlayer(p);
}

export async function getIsFollowing(playerId: string): Promise<boolean> {
  const player = await getPlayer(playerId);
  return player?.isFollowing ?? false;
}

export async function getFollowers(playerId: string, cursor?: string): Promise<{ players: Player[]; nextCursor?: string }> {
  const url = new URL(`${API_BASE}/api/players/${playerId}/followers`);
  if (cursor) url.searchParams.set("cursor", cursor);
  const resp = await apiFetch(url.toString());
  if (!resp.ok) throw new Error(`get followers: ${resp.status}`);
  const data: { players: RawPlayer[]; next_cursor?: string } = await resp.json();
  return {
    players: (data.players ?? []).map(rawToPlayer),
    nextCursor: data.next_cursor,
  };
}

export async function getFollowing(playerId: string, cursor?: string): Promise<{ players: Player[]; nextCursor?: string }> {
  const url = new URL(`${API_BASE}/api/players/${playerId}/following`);
  if (cursor) url.searchParams.set("cursor", cursor);
  const resp = await apiFetch(url.toString());
  if (!resp.ok) throw new Error(`get following: ${resp.status}`);
  const data: { players: RawPlayer[]; next_cursor?: string } = await resp.json();
  return {
    players: (data.players ?? []).map(rawToPlayer),
    nextCursor: data.next_cursor,
  };
}

export async function followPlayer(playerId: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/players/${playerId}/follow`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`follow: ${resp.status}`);
}

export async function unfollowPlayer(playerId: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/players/${playerId}/follow`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`unfollow: ${resp.status}`);
}

// searchPlayers returns handle-prefix matches for @mention autocomplete.
export async function searchPlayers(query: string): Promise<Player[]> {
  if (!query) return [];
  const url = new URL(`${API_BASE}/api/players/search`);
  url.searchParams.set("q", query);
  const resp = await apiFetch(url.toString(), { credentials: "include" });
  if (!resp.ok) return [];
  const data: { players: RawPlayer[] } = await resp.json();
  return (data.players ?? []).map(rawToPlayer);
}

export function _reset(): void {}
