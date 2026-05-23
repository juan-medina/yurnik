// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type EchoKind = "comment" | "follower";

export type Echo = {
  id: string;
  kind: EchoKind;
  player: Player;
  occurredAt: Date;
  read: boolean;
  sessionId?: string;
  game?: string;
  commentPreview?: string;
};
