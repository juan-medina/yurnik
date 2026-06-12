// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCommentAge, formatJourneyDate, formatLocalDate, parseLocalDate } from "./time";

// May 22, 2026 noon local — a known fixed point for all time tests
const FIXED_NOW = new Date(2026, 4, 22, 12, 0, 0);

describe("formatJourneyDate", () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXED_NOW }));
  afterEach(() => vi.useRealTimers());

  it("returns Today for same calendar day", () => {
    expect(formatJourneyDate(new Date(2026, 4, 22, 8, 0, 0))).toBe("Today");
  });

  it("returns Yesterday for the previous calendar day", () => {
    expect(formatJourneyDate(new Date(2026, 4, 21, 20, 0, 0))).toBe("Yesterday");
  });

  it("returns a weekday name for 2–6 days ago", () => {
    const result = formatJourneyDate(new Date(2026, 4, 18, 12, 0, 0)); // 4 days ago
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    expect(weekdays).toContain(result);
  });

  it("returns short month+day for same year beyond 7 days", () => {
    expect(formatJourneyDate(new Date(2026, 4, 10, 12, 0, 0))).toBe("May 10");
  });

  it("includes the year for a date in a different year", () => {
    expect(formatJourneyDate(new Date(2025, 2, 15, 12, 0, 0))).toBe("Mar 15, 2025");
  });
});

describe("parseLocalDate / formatLocalDate", () => {
  it("parses a date-only string as local midnight", () => {
    const d = parseLocalDate("2026-06-12");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  it("formats a Date back to YYYY-MM-DD using local parts", () => {
    expect(formatLocalDate(new Date(2026, 5, 12))).toBe("2026-06-12");
  });

  it("round-trips across the year boundary", () => {
    const s = "2026-01-01";
    expect(formatLocalDate(parseLocalDate(s))).toBe(s);
  });

  it("round-trips near midnight without shifting the date", () => {
    const d = parseLocalDate("2026-12-31");
    expect(formatLocalDate(d)).toBe("2026-12-31");
  });
});

describe("formatCommentAge", () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXED_NOW }));
  afterEach(() => vi.useRealTimers());

  it("returns just now for under a minute", () => {
    expect(formatCommentAge(new Date(FIXED_NOW.getTime() - 30_000))).toBe("just now");
  });

  it("returns singular minute", () => {
    expect(formatCommentAge(new Date(FIXED_NOW.getTime() - 60_000))).toBe("1 minute ago");
  });

  it("returns plural minutes", () => {
    expect(formatCommentAge(new Date(FIXED_NOW.getTime() - 23 * 60_000))).toBe("23 minutes ago");
  });

  it("returns singular hour", () => {
    expect(formatCommentAge(new Date(FIXED_NOW.getTime() - 3_600_000))).toBe("1 hour ago");
  });

  it("returns plural hours", () => {
    expect(formatCommentAge(new Date(FIXED_NOW.getTime() - 3 * 3_600_000))).toBe("3 hours ago");
  });

  it("returns singular day", () => {
    expect(formatCommentAge(new Date(FIXED_NOW.getTime() - 86_400_000))).toBe("1 day ago");
  });

  it("returns plural days", () => {
    expect(formatCommentAge(new Date(FIXED_NOW.getTime() - 2 * 86_400_000))).toBe("2 days ago");
  });
});
