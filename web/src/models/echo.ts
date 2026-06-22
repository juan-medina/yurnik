// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type EchoType = "new_comment" | "new_comment_reply" | "new_follower" | "new_mention";

export type Echo = {
  id: string;
  type: EchoType;
  actors: Player[];
  actorCount: number;
  subjectId: string | null;
  subjectTitle: string | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
};
