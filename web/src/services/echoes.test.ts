// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, afterEach } from "vitest";
import { getEchoes } from "@/services/echoes";

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("getEchoes", () => {
  it("forwards next_cursor when the API returns one", async () => {
    mockFetch({ echoes: [], next_cursor: "2026-06-01T12:00:00Z|42" });

    const { nextCursor } = await getEchoes();

    expect(nextCursor).toBe("2026-06-01T12:00:00Z|42");
  });

  it("returns undefined nextCursor when the API omits it", async () => {
    mockFetch({ echoes: [] });

    const { nextCursor } = await getEchoes();

    expect(nextCursor).toBeUndefined();
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ echoes: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getEchoes("2026-06-01T12:00:00Z|42");

    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain("cursor=");
  });
});
