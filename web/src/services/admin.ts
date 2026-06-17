// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { API_BASE, apiFetch } from "@/lib/api";
import type { SuspendedUser } from "@/models";

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
