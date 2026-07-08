// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, afterEach } from "vitest";
import { getNotifications } from "@/services/notifications";

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("getNotifications", () => {
  it("forwards next_cursor when the API returns one", async () => {
    mockFetch({ notifications: [], next_cursor: "2026-06-01T12:00:00Z|42" });

    const { nextCursor } = await getNotifications();

    expect(nextCursor).toBe("2026-06-01T12:00:00Z|42");
  });

  it("returns undefined nextCursor when the API omits it", async () => {
    mockFetch({ notifications: [] });

    const { nextCursor } = await getNotifications();

    expect(nextCursor).toBeUndefined();
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ notifications: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getNotifications("2026-06-01T12:00:00Z|42");

    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain("cursor=");
  });
});
