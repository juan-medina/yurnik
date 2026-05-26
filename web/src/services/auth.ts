// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";
import { MY_PLAYER_ID as MOCK_MY_PLAYER_ID } from "@/lib/mock";
import { API_BASE } from "@/lib/api";
import { deriveColor } from "@/lib/display";

// Still points to the mock ID while follow lists are not yet backed by the API.
export const MY_PLAYER_ID: string = MOCK_MY_PLAYER_ID;

export async function getCurrentPlayer(): Promise<Player> {
  const resp = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
  if (!resp.ok) throw new Error(`get profile: ${resp.status}`);
  const data = await resp.json();
  return {
    id: data.did,
    name: data.display_name ?? data.handle,
    handle: data.handle,
    color: deriveColor(data.did),
    avatarUrl: data.avatar_url ?? undefined,
    bio: data.bio ?? undefined,
  };
}

export async function updateProfile(patch: { name?: string; bio?: string }): Promise<void> {
  if (patch.bio === undefined) return;
  const resp = await fetch(`${API_BASE}/api/me`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bio: patch.bio }),
  });
  if (!resp.ok) throw new Error(`update profile: ${resp.status}`);
}

// Navigates the browser to the API's auth/init endpoint. The server generates
// a state nonce, sets it in a cookie, and redirects to Bluesky — does not return.
export function signIn(): void {
  window.location.href = `${API_BASE}/auth/init`;
}

// Called by the /auth/complete page after Bluesky redirects back. The server
// reads the auth_state cookie, issues a session JWT, and sets agon_authed=1.
export async function completeSignIn(): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/session`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`session exchange failed: ${resp.status}`);
}

export async function signOut(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
  window.location.href = "/login";
}

// No-op kept for test compatibility.
export function _reset(): void {}

