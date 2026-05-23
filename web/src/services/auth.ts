// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";
import { MY_PLAYER, MY_PLAYER_ID as MOCK_MY_PLAYER_ID } from "@/lib/mock";

export const MY_PLAYER_ID: string = MOCK_MY_PLAYER_ID;

let _profile: Player = { ...MY_PLAYER };

export async function getCurrentPlayer(): Promise<Player> {
  return { ..._profile };
}

export async function updateProfile(patch: { name?: string; bio?: string }): Promise<void> {
  _profile = { ..._profile, ...patch };
}

export async function uploadAvatar(file: File): Promise<void> {
  const url = URL.createObjectURL(file);
  _profile = { ..._profile, avatarUrl: url };
}

const AUTH_KEY = "agon_authed";

export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) === "1";
}

export async function signIn(): Promise<void> {
  localStorage.setItem(AUTH_KEY, "1");
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(AUTH_KEY);
}

export function _reset(): void {
  _profile = { ...MY_PLAYER };
}
