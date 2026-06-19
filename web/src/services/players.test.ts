// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, afterEach } from "vitest";
import { getFollowers, getFollowing } from "@/services/players";

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("getFollowers", () => {
  it("forwards next_cursor when the API returns one", async () => {
    mockFetch({ players: [], next_cursor: "dGVzdA==" });

    const { nextCursor } = await getFollowers("maria");

    expect(nextCursor).toBe("dGVzdA==");
  });

  it("returns undefined nextCursor when the API omits it", async () => {
    mockFetch({ players: [] });

    const { nextCursor } = await getFollowers("maria");

    expect(nextCursor).toBeUndefined();
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ players: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getFollowers("maria", "dGVzdA==");

    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain("cursor=");
  });
});

describe("getFollowing", () => {
  it("forwards next_cursor when the API returns one", async () => {
    mockFetch({ players: [], next_cursor: "dGVzdA==" });

    const { nextCursor } = await getFollowing("maria");

    expect(nextCursor).toBe("dGVzdA==");
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ players: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getFollowing("maria", "dGVzdA==");

    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain("cursor=");
  });
});
