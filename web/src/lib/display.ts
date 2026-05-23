// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";

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

export function playerHref(player: Player, currentUserId: string): string {
  return player.id === currentUserId ? "/hero" : `/player/${player.handle}`;
}
