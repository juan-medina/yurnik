// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";
import { API_BASE } from "@/lib/api";
import { deriveColor } from "@/lib/display";

export async function listAdminUsers(): Promise<Player[]> {
  const resp = await fetch(`${API_BASE}/api/admin/users`, { credentials: "include" });
  if (!resp.ok) throw new Error(`list users: ${resp.status}`);
  const data: Array<{
    id: string;
    handle: string;
    name: string;
    avatar_url?: string;
    color: string;
    is_admin: boolean;
  }> = await resp.json();
  return data.map((u) => ({
    id: u.id,
    name: u.name,
    handle: u.handle,
    color: u.color ?? deriveColor(u.id),
    avatarUrl: u.avatar_url ?? undefined,
    isAdmin: u.is_admin,
  }));
}

export async function impersonateUser(userId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/admin/impersonate/${userId}`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`impersonate: ${resp.status}`);
}
