// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Exclusion, GameHint, Inclusion } from "@/models/settings";
import { API_BASE, apiFetch } from "@/lib/api";

type RawExclusion = { exe_name: string; path_hash?: string };
type RawInclusion = { exe_name: string };
type RawHint = { exe_name: string; path_hash?: string; igdb_id: number; title: string };

export async function getExclusions(): Promise<Exclusion[]> {
  const resp = await apiFetch(`${API_BASE}/api/settings/exclusions`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get exclusions: ${resp.status}`);
  const data: { exclusions: RawExclusion[] } = await resp.json();
  return (data.exclusions ?? []).map((e) => ({ exeName: e.exe_name, pathHash: e.path_hash }));
}

export async function addExclusion(exeName: string, pathHash?: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/settings/exclusions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exe_name: exeName, path_hash: pathHash ?? "" }),
  });
  if (!resp.ok) throw new Error(`add exclusion: ${resp.status}`);
}

export async function removeExclusion({ exeName, pathHash }: { exeName: string; pathHash?: string }): Promise<void> {
  const url = pathHash
    ? `${API_BASE}/api/settings/exclusions/${encodeURIComponent(exeName)}?path_hash=${encodeURIComponent(pathHash)}`
    : `${API_BASE}/api/settings/exclusions/${encodeURIComponent(exeName)}`;
  const resp = await apiFetch(url, { method: "DELETE", credentials: "include" });
  if (!resp.ok) throw new Error(`remove exclusion: ${resp.status}`);
}

export async function getInclusions(): Promise<Inclusion[]> {
  const resp = await apiFetch(`${API_BASE}/api/settings/inclusions`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get inclusions: ${resp.status}`);
  const data: { inclusions: RawInclusion[] } = await resp.json();
  return (data.inclusions ?? []).map((e) => ({ exeName: e.exe_name }));
}

export async function addInclusion(exeName: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/settings/inclusions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exe_name: exeName }),
  });
  if (!resp.ok) throw new Error(`add inclusion: ${resp.status}`);
}

export async function removeInclusion(exeName: string): Promise<void> {
  const resp = await apiFetch(
    `${API_BASE}/api/settings/inclusions/${encodeURIComponent(exeName)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!resp.ok) throw new Error(`remove inclusion: ${resp.status}`);
}

export async function getGameHints(): Promise<GameHint[]> {
  const resp = await apiFetch(`${API_BASE}/api/settings/hints`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get hints: ${resp.status}`);
  const data: { hints: RawHint[] } = await resp.json();
  return (data.hints ?? []).map((h) => ({ exeName: h.exe_name, pathHash: h.path_hash, game: h.title }));
}

export async function addGameHint(exeName: string, igdbId: number, pathHash?: string): Promise<void> {
  const resp = await apiFetch(
    `${API_BASE}/api/settings/hints/${encodeURIComponent(exeName)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ igdb_id: igdbId, path_hash: pathHash ?? "" }),
    },
  );
  if (!resp.ok) throw new Error(`add hint: ${resp.status}`);
}

export async function removeGameHint({ exeName, pathHash }: { exeName: string; pathHash?: string }): Promise<void> {
  const url = pathHash
    ? `${API_BASE}/api/settings/hints/${encodeURIComponent(exeName)}?path_hash=${encodeURIComponent(pathHash)}`
    : `${API_BASE}/api/settings/hints/${encodeURIComponent(exeName)}`;
  const resp = await apiFetch(url, { method: "DELETE", credentials: "include" });
  if (!resp.ok) throw new Error(`remove hint: ${resp.status}`);
}

export async function updateGameHint(exeName: string, igdbId: number, pathHash?: string): Promise<void> {
  return addGameHint(exeName, igdbId, pathHash);
}

