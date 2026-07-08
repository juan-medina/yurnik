// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "./player";

export type NotificationType = "new_comment" | "new_comment_reply" | "new_follower" | "new_mention" | "backlog_release";

export type Notification = {
  id: string;
  type: NotificationType;
  actors: Player[];
  actorCount: number;
  subjectId: string | null;
  subjectIgdbId: number | null;
  subjectTitle: string | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
};
