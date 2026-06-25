// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { API_BASE, apiFetch } from "@/lib/api";
import type { SuspendedUser, RecentUser, UserStats } from "@/models";

export async function suspendUser(id: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/admin/users/${id}/suspend`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`suspend user: ${resp.status}`);
}

export async function unsuspendUser(id: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/admin/users/${id}/suspend`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`unsuspend user: ${resp.status}`);
}

export async function resetProfile(id: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/admin/users/${id}/reset-profile`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`reset profile: ${resp.status}`);
}

export async function adminDeleteJourneyLog(id: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/admin/journeys/${id}/log`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`admin delete journey log: ${resp.status}`);
}

export async function adminDeleteComment(id: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/admin/comments/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`admin delete comment: ${resp.status}`);
}

export async function listSuspendedUsers(): Promise<SuspendedUser[]> {
  const resp = await apiFetch(`${API_BASE}/api/admin/users/suspended`, { credentials: "include" });
  if (!resp.ok) throw new Error(`list suspended: ${resp.status}`);
  const data: { users: { id: string; handle: string; name: string; avatar_url?: string; color: string; suspended_at: string }[] } = await resp.json();
  return (data.users ?? []).map((u) => ({
    id: u.id,
    handle: u.handle,
    name: u.name,
    avatarUrl: u.avatar_url,
    color: u.color,
    suspendedAt: new Date(u.suspended_at),
  }));
}

export async function getUserStats(): Promise<UserStats> {
  const resp = await apiFetch(`${API_BASE}/api/admin/users/stats`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get user stats: ${resp.status}`);
  return resp.json();
}

type RawRecentUser = { id: string; handle: string; name: string; avatar_url?: string; color: string; created_at: string };

export async function listRecentUsers(cursor?: string): Promise<{ users: RecentUser[]; nextCursor?: string }> {
  const url = new URL(`${API_BASE}/api/admin/users`);
  if (cursor) url.searchParams.set("cursor", cursor);
  const resp = await apiFetch(url.toString(), { credentials: "include" });
  if (!resp.ok) throw new Error(`list recent users: ${resp.status}`);
  const data: { users: RawRecentUser[]; next_cursor?: string } = await resp.json();
  return {
    users: (data.users ?? []).map((u) => ({
      id: u.id,
      handle: u.handle,
      name: u.name,
      avatarUrl: u.avatar_url,
      color: u.color,
      createdAt: new Date(u.created_at),
    })),
    nextCursor: data.next_cursor,
  };
}
