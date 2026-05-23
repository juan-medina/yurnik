// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Session } from "@/models/session";
import { SESSIONS } from "@/lib/mock";
import { likedIds } from "./sessions";

export async function getFeedSessions(): Promise<Session[]> {
  return SESSIONS.map((s) => ({ ...s, liked: likedIds.has(s.id) }));
}
