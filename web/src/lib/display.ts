// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";

// Deterministic color derived from a DID — stable across sessions for the same user.
export function deriveColor(did: string): string {
  let hash = 0;
  for (let i = 0; i < did.length; i++) {
    hash = (Math.imul(hash, 31) + did.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

export function avatarSrc(player: Player): string {
  return player.avatarUrl ?? `https://i.pravatar.cc/64?u=${encodeURIComponent(player.id)}`;
}


export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function playerHref(player: Player): string {
  return `/player/${player.handle}`;
}
