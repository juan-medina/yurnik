// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

export type ReportTargetType = "journey_log" | "comment" | "profile";

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "explicit"
  | "impersonation"
  | "private_info"
  | "other";

export type ReportTarget = {
  targetType: ReportTargetType;
  targetId: string;
  contextId?: string;
};

export type SuspendedUser = {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  color: string;
  suspendedAt: Date;
};

export type RecentUser = {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  color: string;
  createdAt: Date;
};

export type UserStats = {
  today: number;
  week: number;
  total: number;
};

export type AdminReport = {
  id: string;
  reporterHandle: string;
  reporterName: string;
  reporterAvatar?: string;
  reporterColor: string;
  targetType: ReportTargetType;
  targetId: string;
  contextId?: string;
  targetHandle?: string;
  reason: ReportReason;
  note?: string;
  createdAt: Date;
};
