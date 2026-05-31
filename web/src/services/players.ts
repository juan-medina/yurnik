// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";
import type { Journey } from "@/models/journey";
import { likedIds } from "./journeys";
import { API_BASE } from "@/lib/api";
import { formatDuration } from "@/lib/time";

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
};

type RawJourney = {
  id: string;
  igdb_id: number;
  game: string;
  cover_url?: string;
  genres: string[];
  played_at: string;
  duration_seconds: number;
  log?: string;
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
  };
}

export async function getPlayer(id: string): Promise<Player | undefined> {
  const resp = await fetch(`${API_BASE}/api/players/${id}`, { credentials: "include" });
  if (resp.status === 404) return undefined;
  if (!resp.ok) throw new Error(`get player: ${resp.status}`);
  const p: RawPlayer = await resp.json();
  return rawToPlayer(p);
}

export async function getIsFollowing(playerId: string): Promise<boolean> {
  const player = await getPlayer(playerId);
  return player?.isFollowing ?? false;
}

export async function getPlayerJourneys(id: string): Promise<Journey[]> {
  const [player, resp] = await Promise.all([
    getPlayer(id),
    fetch(`${API_BASE}/api/players/${id}/journeys`),
  ]);
  if (!player) return [];
  if (!resp.ok) throw new Error(`get player journeys: ${resp.status}`);
  const data: { journeys: RawJourney[] } = await resp.json();
  return (data.journeys ?? []).map((j): Journey => ({
    id: j.id,
    player,
    game: j.game,
    coverUrl: j.cover_url,
    genres: j.genres,
    duration: formatDuration(j.duration_seconds ?? 0),
    playedAt: new Date(j.played_at),
    log: j.log,
    likes: 0,
    liked: likedIds.has(j.id),
  }));
}

export async function getFollowers(playerId: string): Promise<Player[]> {
  const resp = await fetch(`${API_BASE}/api/players/${playerId}/followers`);
  if (!resp.ok) throw new Error(`get followers: ${resp.status}`);
  const data: { players: RawPlayer[] } = await resp.json();
  return (data.players ?? []).map(rawToPlayer);
}

export async function getFollowing(playerId: string): Promise<Player[]> {
  const resp = await fetch(`${API_BASE}/api/players/${playerId}/following`);
  if (!resp.ok) throw new Error(`get following: ${resp.status}`);
  const data: { players: RawPlayer[] } = await resp.json();
  return (data.players ?? []).map(rawToPlayer);
}

export async function followPlayer(playerId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/players/${playerId}/follow`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`follow: ${resp.status}`);
}

export async function unfollowPlayer(playerId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/players/${playerId}/follow`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`unfollow: ${resp.status}`);
}

export function _reset(): void {}
