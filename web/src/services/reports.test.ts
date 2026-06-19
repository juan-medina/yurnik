// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, afterEach } from "vitest";
import { listReports } from "@/services/reports";

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("listReports", () => {
  it("forwards next_cursor when the API returns one", async () => {
    mockFetch({ reports: [], next_cursor: "2026-06-01T12:00:00Z|abc-123" });

    const { nextCursor } = await listReports();

    expect(nextCursor).toBe("2026-06-01T12:00:00Z|abc-123");
  });

  it("returns undefined nextCursor when the API omits it", async () => {
    mockFetch({ reports: [] });

    const { nextCursor } = await listReports();

    expect(nextCursor).toBeUndefined();
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reports: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await listReports("2026-06-01T12:00:00Z|abc-123");

    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain("cursor=");
  });

  it("maps reports to camelCase fields", async () => {
    mockFetch({
      reports: [{
        id: "r1",
        reporter_handle: "alice",
        reporter_name: "Alice",
        reporter_color: "#ff0000",
        target_type: "comment",
        target_id: "c1",
        reason: "spam",
        created_at: "2026-06-01T12:00:00Z",
      }],
    });

    const { reports } = await listReports();

    expect(reports[0].reporterHandle).toBe("alice");
    expect(reports[0].targetType).toBe("comment");
    expect(reports[0].createdAt).toBeInstanceOf(Date);
  });
});
