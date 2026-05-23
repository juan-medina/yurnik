// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Session, PendingSession, NewSession } from "@/models/session";
import { SESSIONS, MOCK_PENDING_SESSIONS, MY_PLAYER } from "@/lib/mock";

export const likedIds = new Set<string>();

let _history: Session[] = SESSIONS.filter((s) => s.player.id === MY_PLAYER.id);
let _pending: PendingSession[] = [...MOCK_PENDING_SESSIONS];

export async function getUserSessions(): Promise<Session[]> {
  return _history.map((s) => ({ ...s, liked: likedIds.has(s.id) }));
}

export async function getPendingSessions(): Promise<PendingSession[]> {
  return [..._pending];
}

export async function toggleLike(sessionId: string): Promise<void> {
  if (likedIds.has(sessionId)) likedIds.delete(sessionId);
  else likedIds.add(sessionId);
}

export async function addSession(input: NewSession): Promise<void> {
  const session: Session = {
    id: `m-${Date.now()}`,
    player: MY_PLAYER,
    ...input,
    likes: 0,
    liked: false,
  };
  _history = [session, ..._history];
}

export async function confirmPendingSession(
  pendingId: string,
  input: { game: string; coverColor: string; coverAccent: string; genres: string[]; log?: string },
): Promise<void> {
  const pending = _pending.find((p) => p.id === pendingId);
  if (!pending) return;
  const session: Session = {
    id: `c-${Date.now()}`,
    player: MY_PLAYER,
    game: input.game,
    coverColor: input.coverColor,
    coverAccent: input.coverAccent,
    genres: input.genres,
    duration: pending.duration,
    playedAt: pending.endedAt,
    log: input.log,
    likes: 0,
    liked: false,
  };
  _history = [session, ..._history];
  _pending = _pending.filter((p) => p.id !== pendingId);
}

export async function dismissPendingSession(pendingId: string): Promise<void> {
  _pending = _pending.filter((p) => p.id !== pendingId);
}

export function _reset(): void {
  likedIds.clear();
  _history = SESSIONS.filter((s) => s.player.id === MY_PLAYER.id);
  _pending = [...MOCK_PENDING_SESSIONS];
}
