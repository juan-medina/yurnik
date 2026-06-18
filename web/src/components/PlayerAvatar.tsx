// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { initials } from "@/lib/display";
import type { Player } from "@/models/player";

interface PlayerAvatarProps {
  player: Player;
  className?: string;
}

export default function PlayerAvatar({ player, className = "" }: PlayerAvatarProps) {
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt={player.name}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{ backgroundColor: player.color }}
      aria-label={player.name}
    >
      {initials(player.name)}
    </span>
  );
}
