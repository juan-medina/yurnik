// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";
import { API_BASE, apiFetch } from "@/lib/api";
import { deriveColor } from "@/lib/display";

// Updated on every successful getCurrentPlayer call. Used for playerHref routing.
export let MY_PLAYER_ID: string = "";

export class SessionExpiredError extends Error {}
export class AccountSuspendedError extends Error {}

export async function getCurrentPlayer(): Promise<Player> {
  const resp = await apiFetch(`${API_BASE}/api/me`, { credentials: "include" });
  if (resp.status === 401 || resp.status === 404) throw new SessionExpiredError();
  if (resp.status === 403) throw new AccountSuspendedError();
  if (!resp.ok) throw new Error(`get profile: ${resp.status}`);
  const data = await resp.json();
  MY_PLAYER_ID = data.id;
  return {
    id: data.id,
    name: data.name,
    handle: data.handle,
    color: data.color ?? deriveColor(data.id),
    avatarUrl: data.avatar_url ?? undefined,
    hasCustomAvatar: data.has_custom_avatar === true,
    hasCustomName: data.has_custom_name === true,
    bio: data.bio ?? undefined,
    isAdmin: data.is_admin === true,
    notificationPreferences: data.notification_preferences,
  };
}

export async function updateProfile(patch: { bio?: string; displayName?: string }): Promise<void> {
  const body: Record<string, string> = {};
  if (patch.bio !== undefined) body.bio = patch.bio;
  if (patch.displayName !== undefined) body.display_name = patch.displayName;
  if (Object.keys(body).length === 0) return;
  const resp = await apiFetch(`${API_BASE}/api/me`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`update profile: ${resp.status}`);
}

export async function updateNotificationPreferences(prefs: { updates: boolean; echoes: boolean }): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/me/preferences`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!resp.ok) throw new Error(`update preferences: ${resp.status}`);
}

// Navigates the browser to the API's auth/init endpoint. The server generates
// a PKCE verifier, sets it in a cookie, and redirects to Discord — does not return.
export function signIn(): void {
  window.location.href = `${API_BASE}/auth/init`;
}

// Called by the /auth/complete page after Discord redirects back. The server
// reads the auth_state cookie, issues a session JWT, and sets the yurnik_session cookie.
export async function completeSignIn(): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/auth/session`, {
    method: "POST",
    credentials: "include",
  });
  if (resp.status === 403) throw new AccountSuspendedError();
  if (!resp.ok) throw new Error(`session exchange failed: ${resp.status}`);
}

// Called by /auth/agent. Issues a Bearer token the agent receives via yurnik://.
export async function getAgentToken(): Promise<string> {
  const resp = await apiFetch(`${API_BASE}/api/v1/agent/token`, {
    method: "POST",
    credentials: "include",
  });
  if (resp.status === 401) throw new SessionExpiredError();
  if (!resp.ok) throw new Error(`agent token: ${resp.status}`);
  const data = await resp.json();
  return data.token as string;
}

export async function signOut(): Promise<void> {
  await apiFetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
  window.location.href = "/";
}

// Permanently deletes the caller's account and all owned data. The server
// clears the session cookie; redirect to the logged-out home afterwards.
export async function deleteAccount(): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/me`, { method: "DELETE", credentials: "include" });
  if (!resp.ok) throw new Error(`delete account: ${resp.status}`);
  window.location.href = "/";
}

