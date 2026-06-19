// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, afterEach } from "vitest";
import { getGameJourneys } from "@/services/games";

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

const selfPlayer = { id: "me", handle: "tester", name: "Tester", color: "#ff0000", is_following: false, is_self: true };
const friendPlayer = { id: "p2", handle: "friend", name: "Friend", color: "#059669", is_following: true, is_self: false };
const otherPlayer = { id: "p3", handle: "other", name: "Other", color: "#d97706", is_following: false, is_self: false };

describe("getGameJourneys", () => {
  it("collects all journeys from the same player into self — not just the last one", async () => {
    mockFetch({
      players: [
        { journey_id: "j1", player: selfPlayer, duration_seconds: 7200, played_at: "2026-06-01" },
        { journey_id: "j2", player: selfPlayer, duration_seconds: 3600, played_at: "2026-06-02" },
      ],
    });

    const result = await getGameJourneys("1");

    expect(result.self).toHaveLength(2);
    expect(result.self.map((e) => e.journeyId)).toEqual(["j1", "j2"]);
  });

  it("routes following and others into separate arrays", async () => {
    mockFetch({
      players: [
        { journey_id: "jf", player: friendPlayer, duration_seconds: 3600, played_at: "2026-06-01" },
        { journey_id: "jo", player: otherPlayer, duration_seconds: 1800, played_at: "2026-06-01" },
      ],
    });

    const result = await getGameJourneys("1");

    expect(result.self).toHaveLength(0);
    expect(result.following.map((e) => e.journeyId)).toEqual(["jf"]);
    expect(result.others.map((e) => e.journeyId)).toEqual(["jo"]);
  });

  it("forwards next_cursor when the API returns one", async () => {
    mockFetch({ players: [], next_cursor: "2026-06-01,2026-06-01T12:00:00Z" });

    const result = await getGameJourneys("1");

    expect(result.nextCursor).toBe("2026-06-01,2026-06-01T12:00:00Z");
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ players: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getGameJourneys("1", "2026-06-01,2026-06-01T12:00:00Z");

    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain("cursor=");
  });
});
