// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type ActivityType = "follow" | "comment";

export type Activity = {
  type: ActivityType;
  createdAt: Date;
  actor: Player;
  recipient: Player;
  subjectId?: string;
  subjectTitle?: string;
};
