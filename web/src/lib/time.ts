// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import i18next from "@/i18n";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// parseLocalDate parses a "YYYY-MM-DD" date-only string as local midnight,
// avoiding the UTC-midnight interpretation `new Date(s)` would otherwise give.
export function parseLocalDate(s: string): Date {
  const [year, month, day] = s.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// formatLocalDate formats a Date as "YYYY-MM-DD" using its local date parts.
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatJourneyDate(date: Date): string {
  const lang = i18next.language;
  const now = new Date();
  const todayMs = startOfDay(now).getTime();
  const dateMs = startOfDay(date).getTime();
  const diffDays = Math.round((todayMs - dateMs) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return i18next.t("time_today");
  if (diffDays === 1) return i18next.t("time_yesterday");
  if (diffDays < 7) return date.toLocaleDateString(lang, { weekday: "long" });
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(lang, { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString(lang, { month: "short", day: "numeric", year: "numeric" });
}

export function formatCommentAge(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return i18next.t("time_just_now");
  if (diffMins < 60) return i18next.t("time_minutes_ago", { count: diffMins });

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return i18next.t("time_hours_ago", { count: diffHours });

  const diffDays = Math.floor(diffHours / 24);
  return i18next.t("time_days_ago", { count: diffDays });
}

export function formatReleaseDate(date: Date): string {
  const lang = i18next.language;
  return date.toLocaleDateString(lang, { month: "long", day: "numeric", year: "numeric" });
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
