// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import "@testing-library/jest-dom/vitest";
import { beforeEach, afterEach, vi } from "vitest";
import { MY_PLAYER } from "@/lib/mock";

// Default fetch stub: returns MY_PLAYER data for GET /api/me.
// Tests that need different profile data or PATCH /api/me state should call
// vi.stubGlobal("fetch", ...) in their own beforeEach to override this.
function makeDefaultFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("/api/me") && (!init?.method || init.method === "GET")) {
      return new Response(
        JSON.stringify({
          id: MY_PLAYER.id,
          name: MY_PLAYER.name,
          handle: MY_PLAYER.handle,
          avatar_url: MY_PLAYER.avatarUrl ?? null,
          bio: MY_PLAYER.bio ?? null,
          color: MY_PLAYER.color,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeDefaultFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});
