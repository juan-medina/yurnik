// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, afterEach } from "vitest";
import { getUserJourneys } from "@/services/journeys";

// getCurrentPlayer is called by getUserJourneys — stub /api/me
function mockFetchWithMe(journeyBody: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/api/me")) {
        return new Response(
          JSON.stringify({ id: "me", handle: "tester", name: "Tester", color: "#ff0000" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify(journeyBody), { status: 200 });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("getUserJourneys", () => {
  it("forwards next_cursor when the API returns one", async () => {
    mockFetchWithMe({ journeys: [], next_cursor: "2026-06-01,2026-06-01T12:00:00Z" });

    const { nextCursor } = await getUserJourneys();

    expect(nextCursor).toBe("2026-06-01,2026-06-01T12:00:00Z");
  });

  it("returns undefined nextCursor when the API omits it", async () => {
    mockFetchWithMe({ journeys: [] });

    const { nextCursor } = await getUserJourneys();

    expect(nextCursor).toBeUndefined();
  });

  it("passes cursor as a query param", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes("/api/me")) {
        return new Response(
          JSON.stringify({ id: "me", handle: "tester", name: "Tester", color: "#ff0000" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ journeys: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    await getUserJourneys("2026-06-01,2026-06-01T12:00:00Z");

    const journeyCall = fetchSpy.mock.calls.find(([input]) =>
      input.toString().includes("/journeys"),
    );
    expect(journeyCall).toBeDefined();
    expect(journeyCall![0].toString()).toContain("cursor=");
  });
});
