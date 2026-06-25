// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isUpcoming, upcomingSortKey } from "./Horizon";
import type { HorizonEntry } from "@/models/player";

// June 25, 2026 noon local — a known fixed point for all tests below
const FIXED_NOW = new Date(2026, 5, 25, 12, 0, 0);

function entry(overrides: Partial<HorizonEntry> = {}): HorizonEntry {
  return { igdbId: 1, name: "Some Game", genres: [], ...overrides };
}

describe("isUpcoming", () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXED_NOW }));
  afterEach(() => vi.useRealTimers());

  it("is upcoming when the release date is today", () => {
    expect(isUpcoming(entry({ releaseDate: new Date(2026, 5, 25) }))).toBe(true);
  });

  it("is upcoming when the release date is in the future", () => {
    expect(isUpcoming(entry({ releaseDate: new Date(2026, 11, 1) }))).toBe(true);
  });

  it("is not upcoming when the release date is in the past", () => {
    expect(isUpcoming(entry({ releaseDate: new Date(2026, 5, 24) }))).toBe(false);
  });

  it("is upcoming when only a release year is known and it has not passed", () => {
    expect(isUpcoming(entry({ releaseYear: 2026 }))).toBe(true);
    expect(isUpcoming(entry({ releaseYear: 2027 }))).toBe(true);
  });

  it("is not upcoming when only a release year is known and it has already passed", () => {
    expect(isUpcoming(entry({ releaseYear: 2020 }))).toBe(false);
  });

  it("is upcoming when neither a release date nor a release year is known (TBA/unannounced)", () => {
    expect(isUpcoming(entry({ releaseYear: undefined, releaseDate: undefined }))).toBe(true);
  });

  it("is upcoming when the fields are literal null rather than omitted", () => {
    // The API can send `release_year`/`release_date` as JSON null in some paths;
    // null and undefined must be treated identically here.
    expect(isUpcoming(entry({ releaseYear: null as unknown as undefined, releaseDate: null as unknown as undefined }))).toBe(true);
  });
});

describe("upcomingSortKey", () => {
  it("sorts dated entries by their exact date", () => {
    const earlier = entry({ releaseDate: new Date(2026, 6, 1) });
    const later = entry({ releaseDate: new Date(2026, 8, 1) });
    expect(upcomingSortKey(earlier)).toBeLessThan(upcomingSortKey(later));
  });

  it("sorts year-only entries after dated entries", () => {
    const dated = entry({ releaseDate: new Date(2026, 0, 1) });
    const yearOnly = entry({ releaseYear: 2030 });
    expect(upcomingSortKey(dated)).toBeLessThan(upcomingSortKey(yearOnly));
  });

  it("sorts fully TBA entries (no date, no year) last of all", () => {
    const yearOnly = entry({ releaseYear: 2099 });
    const tba = entry({ releaseYear: undefined, releaseDate: undefined });
    expect(upcomingSortKey(tba)).toBeGreaterThan(upcomingSortKey(yearOnly));
    expect(upcomingSortKey(tba)).toBe(Infinity);
  });
});
