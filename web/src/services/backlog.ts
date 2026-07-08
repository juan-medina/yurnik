// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { BacklogEntry } from "@/models/player";
import { API_BASE, apiFetch } from "@/lib/api";

type RawBacklogEntry = {
  igdb_id: number;
  name: string;
  cover_url?: string;
  genres: string[];
  release_year?: number;
  release_date?: string;
  added_at: string;
};

export async function getBacklog(handle: string): Promise<BacklogEntry[]> {
  const resp = await apiFetch(`${API_BASE}/api/players/${handle}/backlog`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get backlog: ${resp.status}`);
  const data: { entries: RawBacklogEntry[] } = await resp.json();
  return (data.entries ?? []).map((e) => ({
    igdbId: e.igdb_id,
    name: e.name,
    coverUrl: e.cover_url,
    genres: e.genres ?? [],
    releaseYear: e.release_year,
    releaseDate: e.release_date ? new Date(e.release_date) : undefined,
  }));
}

export async function addToBacklog(igdbId: number): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/me/backlog`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ igdb_id: igdbId }),
  });
  if (!resp.ok) throw new Error(`add to backlog: ${resp.status}`);
}

export async function removeFromBacklog(igdbId: number): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/me/backlog/${igdbId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`remove from backlog: ${resp.status}`);
}

export async function reorderBacklog(igdbIds: number[]): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/me/backlog/order`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ igdb_ids: igdbIds }),
  });
  if (!resp.ok) throw new Error(`reorder backlog: ${resp.status}`);
}
