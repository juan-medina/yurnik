// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

  // Regression test for a real production bug: when the ["feed"] query was
  // already cached and fresh (e.g. from an earlier visit within staleTime),
  // React Query serves the cached data without re-running queryFn. The old
  // code populated its item list only as a side effect inside queryFn, so on
  // a cache hit the list stayed empty and the page rendered the "quiet realm"
  // empty state despite real cached data existing. A fresh-cache test (like
  // the two above) can never hit this path, since queryFn always runs there.
  it("renders cached feed items immediately on a warm cache, without re-fetching", async () => {
    const fetchSpy = vi.fn(async () => new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchSpy);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    queryClient.setQueryData(["feed"], {
      items: [
        {
          kind: "journey",
          journey: {
            id: "j1",
            igdbId: 1,
            game: "Hollow Knight",
            genres: [],
            durationSeconds: 3600,
            playedAt: new Date("2026-06-01"),
            player: { id: "p1", handle: "maria", name: "Maria", color: "#7c3aed" },
          },
        },
      ],
    });
    queryClient.setQueryData(["auth", "me"], { id: "me", handle: "tester", name: "Tester", color: "#ff0000" });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Realm />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Hollow Knight")).toBeInTheDocument();
    expect(screen.queryByText(/realm.*quiet/i)).not.toBeInTheDocument();
  });
});
