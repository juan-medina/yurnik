// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Session } from "@/models/session";
import type { Comment, JourneyPlayer } from "@/models/game";
import type { Player } from "@/models/player";
import { SESSIONS, MOCK_COMMENTS, MOCK_LIKERS, MOCK_FRIENDS_ON_JOURNEY, MOCK_OTHERS_ON_JOURNEY, MY_PLAYER } from "@/lib/mock";
import { likedIds } from "./sessions";
import { isFollowingHandle } from "./players";

const extraComments = new Map<string, Comment[]>();
const initialComments = [...MOCK_COMMENTS];
const initialSessions = [...SESSIONS];

export async function getJourney(id: string): Promise<Session | undefined> {
  const session = SESSIONS.find((s) => s.id === id);
  if (!session) return undefined;
  return { ...session, liked: likedIds.has(id) };
}

export async function getComments(sessionId: string): Promise<Comment[]> {
  const base = sessionId === "s1" ? MOCK_COMMENTS : [];
  return [...base, ...(extraComments.get(sessionId) ?? [])];
}

export async function getLikers(_sessionId: string): Promise<Player[]> {
  return MOCK_LIKERS;
}

export async function getJourneyPlayers(_sessionId: string): Promise<{
  friends: JourneyPlayer[];
  others: JourneyPlayer[];
}> {
  return {
    friends: MOCK_FRIENDS_ON_JOURNEY.map((jp) => ({
      ...jp,
      isFollowing: isFollowingHandle(jp.player.handle),
    })),
    others: MOCK_OTHERS_ON_JOURNEY.map((jp) => ({
      ...jp,
      isFollowing: isFollowingHandle(jp.player.handle),
    })),
  };
}

export async function postComment(sessionId: string, text: string): Promise<void> {
  const comment: Comment = {
    id: `new-${Date.now()}`,
    player: MY_PLAYER,
    text,
    commentedAt: new Date(),
  };
  extraComments.set(sessionId, [...(extraComments.get(sessionId) ?? []), comment]);
}

export async function deleteJourney(sessionId: string): Promise<void> {
  const idx = SESSIONS.findIndex((s) => s.id === sessionId);
  if (idx !== -1) SESSIONS.splice(idx, 1);
}

export async function deleteComment(sessionId: string, commentId: string): Promise<void> {
  const extra = extraComments.get(sessionId);
  if (extra?.some((c) => c.id === commentId)) {
    extraComments.set(sessionId, extra.filter((c) => c.id !== commentId));
    return;
  }
  const idx = MOCK_COMMENTS.findIndex((c) => c.id === commentId);
  if (idx !== -1) MOCK_COMMENTS.splice(idx, 1);
}

export function _reset(): void {
  extraComments.clear();
  MOCK_COMMENTS.splice(0, MOCK_COMMENTS.length, ...initialComments);
  SESSIONS.splice(0, SESSIONS.length, ...initialSessions);
}
