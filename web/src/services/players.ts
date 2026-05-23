// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";
import type { Session } from "@/models/session";
import {
  PLAYERS,
  SESSIONS,
  MY_FOLLOWING,
  MY_FOLLOWERS,
  MY_PLAYER,
  MOCK_FOLLOW_LISTS,
  MOCK_GAME_ACTIVITY,
} from "@/lib/mock";
import { likedIds } from "./sessions";

const followingHandles = new Set<string>(MY_FOLLOWING.map((p) => p.handle));

export function isFollowingHandle(handle: string): boolean {
  return followingHandles.has(handle);
}

export async function getPlayer(handle: string): Promise<Player | undefined> {
  const fromPlayers = PLAYERS.find((p) => p.handle === handle);
  if (fromPlayers) return fromPlayers;
  const fromSessions = SESSIONS.find((s) => s.player.handle === handle)?.player;
  if (fromSessions) return fromSessions;
  return MOCK_GAME_ACTIVITY.flatMap((g) => g.entries)
    .find((e) => e.player.handle === handle)?.player;
}

export async function getPlayerSessions(handle: string): Promise<Session[]> {
  return SESSIONS
    .filter((s) => s.player.handle === handle)
    .map((s) => ({ ...s, liked: likedIds.has(s.id) }));
}

export async function getFollowers(playerId: string): Promise<Player[]> {
  if (playerId === MY_PLAYER.id) return MY_FOLLOWERS;
  return MOCK_FOLLOW_LISTS[playerId]?.followers ?? [];
}

export async function getFollowing(playerId: string): Promise<Player[]> {
  if (playerId === MY_PLAYER.id) return MY_FOLLOWING;
  return MOCK_FOLLOW_LISTS[playerId]?.following ?? [];
}

export async function toggleFollow(handle: string): Promise<void> {
  if (followingHandles.has(handle)) followingHandles.delete(handle);
  else followingHandles.add(handle);
}

export function _reset(): void {
  followingHandles.clear();
  MY_FOLLOWING.forEach((p) => followingHandles.add(p.handle));
}
