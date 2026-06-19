// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { API_BASE, apiFetch } from "@/lib/api";
import type { AdminReport, ReportReason, ReportTargetType } from "@/models";

export async function submitReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  note?: string,
  contextId?: string,
): Promise<void> {
  const body: Record<string, unknown> = { target_type: targetType, target_id: targetId, reason };
  if (contextId) body.context_id = contextId;
  if (note) body.note = note;

  // apiFetch throws RateLimitedError on 429 automatically.
  const resp = await apiFetch(`${API_BASE}/api/reports`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (resp.status === 409) throw new Error("already_reported");
  if (!resp.ok) throw new Error(`report: ${resp.status}`);
}

type RawReport = {
  id: string;
  reporter_handle: string;
  reporter_name: string;
  reporter_avatar?: string;
  reporter_color: string;
  target_type: string;
  target_id: string;
  context_id?: string;
  target_handle?: string;
  reason: string;
  note?: string;
  created_at: string;
};

function toAdminReport(r: RawReport): AdminReport {
  return {
    id: r.id,
    reporterHandle: r.reporter_handle,
    reporterName: r.reporter_name,
    reporterAvatar: r.reporter_avatar,
    reporterColor: r.reporter_color,
    targetType: r.target_type as ReportTargetType,
    targetId: r.target_id,
    contextId: r.context_id,
    targetHandle: r.target_handle,
    reason: r.reason as ReportReason,
    note: r.note,
    createdAt: new Date(r.created_at),
  };
}

export async function listReports(cursor?: string): Promise<{ reports: AdminReport[]; nextCursor?: string }> {
  const url = new URL(`${API_BASE}/api/admin/reports`);
  if (cursor) url.searchParams.set("cursor", cursor);
  const resp = await apiFetch(url.toString(), { credentials: "include" });
  if (!resp.ok) throw new Error(`list reports: ${resp.status}`);
  const data: { reports: RawReport[]; next_cursor?: string } = await resp.json();
  return { reports: (data.reports ?? []).map(toAdminReport), nextCursor: data.next_cursor };
}
