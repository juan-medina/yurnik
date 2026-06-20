// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MOCK_FRIENDS_ON_JOURNEY, MOCK_HORIZON, MY_PLAYER, MY_PLAYER_ID, PLAYERS, JOURNEYS } from "@/test/fixtures";
import { _reset as resetPlayers } from "@/services/players";
import { renderWithProviders } from "@/test/utils";
import PlayerProfile from "./PlayerProfile";

function renderProfile(handle: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/player/${handle}`]}>
      <Routes>
        <Route path="/player/:handle" element={<PlayerProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

const followed = MOCK_FRIENDS_ON_JOURNEY[0].player;
const unfollowed = JOURNEYS.find(
  (j) =>
    j.player.id !== MY_PLAYER_ID &&
    !MOCK_FRIENDS_ON_JOURNEY.some((jp) => jp.player.id === j.player.id),
)!.player;

beforeEach(() => {
  resetPlayers();
});

describe("PlayerProfile", () => {
  it("shows Player not found for an unknown handle", async () => {
    renderProfile("nonexistent-handle");
    expect(await screen.findByText("Player not found.")).toBeInTheDocument();
  });

  it("shows the player's sessions on their profile", async () => {
    const player = PLAYERS[1]; // Alex Torres — has s2 and s6
    renderProfile(player.handle);
    const journeys = JOURNEYS.filter((j) => j.player.id === player.id);
    for (const j of journeys) {
      expect(await screen.findAllByText(j.game)).not.toHaveLength(0);
    }
  });

  it("shows Unfollow for an already-followed player", async () => {
    renderProfile(followed.handle);
    expect(await screen.findByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("shows Follow for a player not yet followed", async () => {
    renderProfile(unfollowed.handle);
    expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("Follow toggles to Unfollow after clicking", async () => {
    const user = userEvent.setup();
    renderProfile(unfollowed.handle);
    await user.click(await screen.findByRole("button", { name: "Follow" }));
    expect(await screen.findByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("Unfollow toggles to Follow after clicking", async () => {
    const user = userEvent.setup();
    renderProfile(followed.handle);
    await user.click(await screen.findByRole("button", { name: "Unfollow" }));
    expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("shows edit controls instead of a follow button on your own profile", async () => {
    renderProfile(MY_PLAYER.handle);
    expect(await screen.findByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unfollow" })).not.toBeInTheDocument();
  });

  it("clicking Followers stat opens the follow list modal", async () => {
    const user = userEvent.setup();
    renderProfile(PLAYERS[1].handle);
    await user.click(await screen.findByRole("button", { name: /Followers/ }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("clicking Following stat opens the follow list modal", async () => {
    const user = userEvent.setup();
    renderProfile(PLAYERS[1].handle);
    await user.click(await screen.findByRole("button", { name: /Following/ }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("shows the Horizon section with entries on your own profile", async () => {
    renderProfile(MY_PLAYER.handle);
    expect(await screen.findByText("Horizon")).toBeInTheDocument();
    expect(await screen.findByText(MOCK_HORIZON[0].name)).toBeInTheDocument();
  });

  it("does not show the Horizon section on another player's profile with an empty horizon", async () => {
    renderProfile(PLAYERS[1].handle);
    await screen.findByText(PLAYERS[1].name);
    expect(screen.queryByText("Horizon")).not.toBeInTheDocument();
  });

  it("shows a Load more button when the player activity returns a next_cursor", async () => {
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url.includes("/api/players/") && url.endsWith("/activity")) {
          return new Response(
            JSON.stringify({ items: [], next_cursor: "2026-06-01,2026-06-01T12:00:00Z" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return defaultFetch(input, init);
      }),
    );

    renderProfile(PLAYERS[1].handle);
    await screen.findByText(PLAYERS[1].name);
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not show a Load more button when the player activity returns no next_cursor", async () => {
    renderProfile(PLAYERS[1].handle);
    await screen.findByText(PLAYERS[1].name);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    });
  });

  it("shows a Load more button inside the followers modal when the API returns a next_cursor", async () => {
    const user = userEvent.setup();
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url.includes("/api/players/") && url.includes("/followers")) {
          return new Response(
            JSON.stringify({ players: [], next_cursor: "dGVzdA==" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return defaultFetch(input, init);
      }),
    );

    renderProfile(PLAYERS[1].handle);
    await user.click(await screen.findByRole("button", { name: /Followers/ }));
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not show a Load more button inside the followers modal when no next_cursor", async () => {
    const user = userEvent.setup();
    renderProfile(PLAYERS[1].handle);
    await user.click(await screen.findByRole("button", { name: /Followers/ }));
    // modal opens
    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    });
  });

  // Regression tests: activity/followers/following used to be populated only
  // as a side effect inside queryFn, so a warm/cached entry for any of these
  // keys (e.g. from revisiting the profile) never reached the page, leaving
  // the section stuck empty despite real cached data.
  it("renders cached activity immediately on a warm cache, without re-fetching", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    const target = PLAYERS[1];

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    queryClient.setQueryData(["auth", "me"], MY_PLAYER);
    queryClient.setQueryData(["player-profile", target.handle], {
      player: target,
      journeyCount: 0,
      totalSeconds: 0,
      recentGames: [],
      genreHours: [],
      horizon: [],
    });
    queryClient.setQueryData(["activity", "player", target.handle], {
      items: [
        {
          kind: "journey",
          journey: {
            id: "j_warm",
            igdbId: 999,
            player: target,
            game: "Subnautica",
            genres: [],
            duration: "3h",
            playedAt: new Date("2026-06-01"),
          },
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/player/${target.handle}`]}>
          <Routes>
            <Route path="/player/:handle" element={<PlayerProfile />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Subnautica")).toBeInTheDocument();
  });

  it("renders cached followers immediately on a warm cache, without re-fetching", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    const target = PLAYERS[1];
    const follower = PLAYERS[2];

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    queryClient.setQueryData(["auth", "me"], MY_PLAYER);
    queryClient.setQueryData(["player-profile", target.handle], {
      player: target,
      journeyCount: 0,
      totalSeconds: 0,
      recentGames: [],
      genreHours: [],
      horizon: [],
    });
    queryClient.setQueryData(["activity", "player", target.handle], { items: [] });
    queryClient.setQueryData(["follow-list", target.id, "followers"], { players: [follower] });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/player/${target.handle}`]}>
          <Routes>
            <Route path="/player/:handle" element={<PlayerProfile />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /Followers/ }));
    expect(await screen.findByText(follower.name)).toBeInTheDocument();
  });

  it("renders cached following immediately on a warm cache, without re-fetching", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    const target = PLAYERS[1];
    const followee = PLAYERS[3];

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    queryClient.setQueryData(["auth", "me"], MY_PLAYER);
    queryClient.setQueryData(["player-profile", target.handle], {
      player: target,
      journeyCount: 0,
      totalSeconds: 0,
      recentGames: [],
      genreHours: [],
      horizon: [],
    });
    queryClient.setQueryData(["activity", "player", target.handle], { items: [] });
    queryClient.setQueryData(["follow-list", target.id, "following"], { players: [followee] });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/player/${target.handle}`]}>
          <Routes>
            <Route path="/player/:handle" element={<PlayerProfile />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /Following/ }));
    expect(await screen.findByText(followee.name)).toBeInTheDocument();
  });
});
