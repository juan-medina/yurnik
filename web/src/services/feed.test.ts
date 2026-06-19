// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, afterEach } from "vitest";
import { getFeedItems, getPlayerActivity } from "@/services/feed";

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("getFeedItems", () => {
  it("maps a journey item", async () => {
    mockFetch({
      items: [
        {
          kind: "journey",
          journey: {
            id: "j1",
            igdb_id: 42,
            game: "Hollow Knight",
            genres: ["Metroidvania"],
            duration_seconds: 3600,
            played_at: "2026-06-01",
            player: { id: "p1", handle: "maria", name: "Maria", color: "#7c3aed" },
          },
        },
      ],
    });

    const { items } = await getFeedItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      kind: "journey",
      journey: expect.objectContaining({
        id: "j1",
        igdbId: 42,
        game: "Hollow Knight",
        player: expect.objectContaining({ id: "p1", handle: "maria", name: "Maria" }),
        playedAt: new Date(2026, 5, 1),
      }),
    });
  });

  it("maps a follow activity item", async () => {
    mockFetch({
      items: [
        {
          kind: "activity",
          activity: {
            type: "follow",
            created_at: "2026-06-01T12:00:00Z",
            actor: { id: "p1", handle: "maria", name: "Maria", color: "#7c3aed" },
            recipient: { id: "p2", handle: "alex", name: "Alex", color: "#059669" },
          },
        },
      ],
    });

    const { items } = await getFeedItems();

    expect(items[0]).toEqual({
      kind: "activity",
      activity: expect.objectContaining({
        type: "follow",
        actor: expect.objectContaining({ id: "p1", name: "Maria" }),
        recipient: expect.objectContaining({ id: "p2", name: "Alex" }),
        subjectId: undefined,
        subjectTitle: undefined,
      }),
    });
  });

  it("maps a comment activity item with subject info", async () => {
    mockFetch({
      items: [
        {
          kind: "activity",
          activity: {
            type: "comment",
            created_at: "2026-06-01T12:00:00Z",
            actor: { id: "p1", handle: "maria", name: "Maria", color: "#7c3aed" },
            recipient: { id: "p2", handle: "alex", name: "Alex", color: "#059669" },
            subject_id: "j99",
            subject_title: "Elden Ring",
          },
        },
      ],
    });

    const { items } = await getFeedItems();

    expect(items[0]).toEqual({
      kind: "activity",
      activity: expect.objectContaining({
        type: "comment",
        subjectId: "j99",
        subjectTitle: "Elden Ring",
      }),
    });
  });

  it("returns an empty array on a non-ok response", async () => {
    mockFetch({}, 500);
    expect((await getFeedItems()).items).toEqual([]);
  });

  it("forwards next_cursor when the API returns one", async () => {
    mockFetch({ items: [], next_cursor: "2026-06-01,2026-06-01T12:00:00Z" });
    const { nextCursor } = await getFeedItems();
    expect(nextCursor).toBe("2026-06-01,2026-06-01T12:00:00Z");
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getFeedItems("2026-06-01,2026-06-01T12:00:00Z");

    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain("cursor=");
  });
});

describe("getPlayerActivity", () => {
  it("forwards next_cursor when the API returns one", async () => {
    mockFetch({ items: [], next_cursor: "2026-06-01,2026-06-01T12:00:00Z" });
    const { nextCursor } = await getPlayerActivity("maria");
    expect(nextCursor).toBe("2026-06-01,2026-06-01T12:00:00Z");
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getPlayerActivity("maria", "2026-06-01,2026-06-01T12:00:00Z");

    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain("cursor=");
  });
});
