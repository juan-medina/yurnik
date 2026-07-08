// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Notification } from "@/models/notification";
import type { Player } from "@/models/player";
import { API_BASE, apiFetch } from "@/lib/api";

type RawActor = {
  id: string;
  handle: string;
  name: string;
  avatar_url?: string;
  color: string;
};

type RawNotification = {
  id: number;
  type: string;
  actors: RawActor[];
  actor_count: number;
  subject_id: string | null;
  subject_igdb_id: number | null;
  subject_title: string | null;
  read: boolean;
  created_at: string;
  updated_at: string;
};

function rawToPlayer(a: RawActor): Player {
  return { id: a.id, handle: a.handle, name: a.name, avatarUrl: a.avatar_url, color: a.color };
}

export async function getNotifications(cursor?: string): Promise<{ notifications: Notification[]; nextCursor?: string }> {
  const url = new URL(`${API_BASE}/api/notifications`);
  if (cursor) url.searchParams.set("cursor", cursor);
  const resp = await apiFetch(url.toString(), { credentials: "include" });
  if (!resp.ok) throw new Error(`get notifications: ${resp.status}`);
  const data: { notifications: RawNotification[]; next_cursor?: string } = await resp.json();
  return {
    notifications: (data.notifications ?? []).map(
      (r): Notification => ({
        id: String(r.id),
        type: r.type as Notification["type"],
        actors: (r.actors ?? []).map(rawToPlayer),
        actorCount: r.actor_count,
        subjectId: r.subject_id ?? null,
        subjectIgdbId: r.subject_igdb_id ?? null,
        subjectTitle: r.subject_title ?? null,
        read: r.read,
        createdAt: new Date(r.created_at),
        updatedAt: new Date(r.updated_at),
      }),
    ),
    nextCursor: data.next_cursor,
  };
}

export async function markAllRead(): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/notifications/read`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`mark notifications read: ${resp.status}`);
}
