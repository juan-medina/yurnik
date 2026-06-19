// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { renderWithProviders } from "@/test/utils";
import Realm from "./Realm";

function makeFetch(nextCursor?: string) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes("/api/me")) {
      return new Response(
        JSON.stringify({ id: "me", handle: "tester", name: "Tester", color: "#ff0000" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/api/feed")) {
      const body: Record<string, unknown> = {
        items: [
          {
            kind: "journey",
            journey: {
              id: "j1",
              igdb_id: 1,
              game: "Hollow Knight",
              genres: [],
              duration_seconds: 3600,
              played_at: "2026-06-01",
              player: { id: "p1", handle: "maria", name: "Maria", color: "#7c3aed" },
            },
          },
        ],
      };
      if (nextCursor) body.next_cursor = nextCursor;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  });
}

function renderRealm() {
  return renderWithProviders(
    <MemoryRouter>
      <Realm />
    </MemoryRouter>,
  );
}

describe("Realm", () => {
  it("shows a Load more button when the feed returns a next_cursor", async () => {
    vi.stubGlobal("fetch", makeFetch("2026-06-01,2026-06-01T12:00:00Z"));
    renderRealm();
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not show a Load more button when the feed returns no next_cursor", async () => {
    vi.stubGlobal("fetch", makeFetch());
    renderRealm();
    await screen.findByText("Hollow Knight");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    });
  });
});
