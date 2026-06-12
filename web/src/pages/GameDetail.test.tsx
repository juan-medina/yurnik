// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { MOCK_GAME_DETAIL, MOCK_FRIENDS_ON_JOURNEY, MOCK_OTHERS_ON_JOURNEY } from "@/test/fixtures";
import { formatLocalDate } from "@/lib/time";
import { _reset as resetPlayers } from "@/services/players";
import { renderWithProviders } from "@/test/utils";
import GameDetail from "./GameDetail";

function gameDetailResponse(withTrailer: boolean, withStoreLinks: boolean, inHorizon = false) {
  return JSON.stringify({
    id: MOCK_GAME_DETAIL.id,
    name: MOCK_GAME_DETAIL.name,
    cover_url: MOCK_GAME_DETAIL.coverUrl,
    genres: MOCK_GAME_DETAIL.genres,
    release_year: MOCK_GAME_DETAIL.releaseYear,
    platforms: MOCK_GAME_DETAIL.platforms,
    developer: MOCK_GAME_DETAIL.developer,
    publisher: MOCK_GAME_DETAIL.publisher,
    summary: MOCK_GAME_DETAIL.summary,
    screenshots: MOCK_GAME_DETAIL.screenshots,
    trailer_id: withTrailer ? MOCK_GAME_DETAIL.trailerId : undefined,
    store_links: withStoreLinks ? MOCK_GAME_DETAIL.storeLinks : {},
    in_horizon: inHorizon,
  });
}

function journeyPlayersResponse(withFollowing: boolean) {
  const following = withFollowing ? MOCK_FRIENDS_ON_JOURNEY : [];
  return JSON.stringify({
    players: [
      ...following.map((jp) => ({
        journey_id: `j_${jp.player.id}`,
        player: { id: jp.player.id, handle: jp.player.handle, name: jp.player.name, avatar_url: null, color: jp.player.color, is_following: true, is_self: false },
        duration_seconds: 9840,
        played_at: formatLocalDate(jp.playedAt),
      })),
      ...MOCK_OTHERS_ON_JOURNEY.map((jp) => ({
        journey_id: `j_${jp.player.id}`,
        player: { id: jp.player.id, handle: jp.player.handle, name: jp.player.name, avatar_url: null, color: jp.player.color, is_following: false, is_self: false },
        duration_seconds: 3600,
        played_at: formatLocalDate(jp.playedAt),
      })),
    ],
  });
}

function makeFetch({ withTrailer = true, withStoreLinks = true, withFollowing = true, notFound = false, inHorizon = false, anonymous = false } = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = init?.method ?? "GET";
    const json = (body: string) => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });

    if (url.endsWith("/api/me")) {
      if (anonymous) return new Response("unauthorized", { status: 401 });
      return json(JSON.stringify({ id: "me", handle: "tester", name: "Tester", color: "#ff0000" }));
    }
    if (url.includes("/api/players/") && url.endsWith("/follow") && method === "POST") {
      return new Response(null, { status: 204 });
    }
    if (url.includes("/api/players/") && url.endsWith("/follow") && method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/api/me/horizon") && method === "POST") {
      return new Response(null, { status: 204 });
    }
    if (/\/api\/games\/\d+\/journeys/.test(url)) {
      return json(journeyPlayersResponse(withFollowing));
    }
    if (/\/api\/games\/\d+$/.test(url)) {
      if (notFound) return new Response("not found", { status: 404 });
      return json(gameDetailResponse(withTrailer, withStoreLinks, inHorizon));
    }
    return new Response("not found", { status: 404 });
  });
}

function renderGame(igdbId: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/game/${igdbId}`]}>
      <Routes>
        <Route path="/game/:igdbId" element={<GameDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetPlayers();
  vi.stubGlobal("fetch", makeFetch());
});

describe("GameDetail", () => {
  it("renders the game title", async () => {
    renderGame("1");
    expect(await screen.findByRole("heading", { name: /Elden Ring/ })).toBeInTheDocument();
  });

  it("shows Watch trailer link when trailer_id is present", async () => {
    renderGame("1");
    expect(await screen.findByRole("link", { name: /Watch trailer/i })).toBeInTheDocument();
  });

  it("does not show Watch trailer link when trailer_id is absent", async () => {
    vi.stubGlobal("fetch", makeFetch({ withTrailer: false }));
    renderGame("1");
    await screen.findByRole("heading", { name: /Elden Ring/ });
    expect(screen.queryByRole("link", { name: /Watch trailer/i })).not.toBeInTheDocument();
  });

  it("shows store links when store_links are present", async () => {
    renderGame("1");
    expect(await screen.findByRole("link", { name: /Steam/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Epic Games/i })).toBeInTheDocument();
  });

  it("does not show store links when store_links is empty", async () => {
    vi.stubGlobal("fetch", makeFetch({ withStoreLinks: false }));
    renderGame("1");
    await screen.findByRole("heading", { name: /Elden Ring/ });
    expect(screen.queryByRole("link", { name: /Steam/i })).not.toBeInTheDocument();
  });

  it("shows Following section label when followed players have journeys", async () => {
    renderGame("1");
    await screen.findByRole("heading", { name: /Elden Ring/ });
    // "Following" appears as a section label <p> and as button text — both confirm the section exists
    const labels = await screen.findAllByText("Following");
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getByText("Others")).toBeInTheDocument();
  });

  it("does not show Following section label when no followed players have journeys", async () => {
    vi.stubGlobal("fetch", makeFetch({ withFollowing: false }));
    renderGame("1");
    await screen.findByRole("heading", { name: /Elden Ring/ });
    await waitFor(() => {
      const labels = screen.queryAllByText("Following");
      // Only button text can exist; the section <p> label must not be present
      expect(labels.every((el) => el.tagName !== "P")).toBe(true);
    });
    expect(screen.getByText("Others")).toBeInTheDocument();
  });

  it("clicking Follow on a player in the others list toggles to Following", async () => {
    const user = userEvent.setup();
    renderGame("1");
    const followButtons = await screen.findAllByRole("button", { name: "Follow" });
    expect(followButtons.length).toBeGreaterThan(0);
    await user.click(followButtons[0]);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Follow" })).toHaveLength(followButtons.length - 1),
    );
  });

  it("shows an Add to horizon button when the game is not in the player's horizon", async () => {
    renderGame("1");
    expect(await screen.findByRole("button", { name: /Add to horizon/i })).toBeInTheDocument();
  });

  it("shows an In horizon indicator when the game is already in the player's horizon", async () => {
    vi.stubGlobal("fetch", makeFetch({ inHorizon: true }));
    renderGame("1");
    await screen.findByRole("heading", { name: /Elden Ring/ });
    expect(screen.getByText(/In horizon/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add to horizon/i })).not.toBeInTheDocument();
  });

  it("clicking Add to horizon switches to the In horizon indicator", async () => {
    const user = userEvent.setup();
    renderGame("1");
    const addButton = await screen.findByRole("button", { name: /Add to horizon/i });
    await user.click(addButton);
    expect(await screen.findByText(/In horizon/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add to horizon/i })).not.toBeInTheDocument();
  });

  it("clicking Add to horizon as an anonymous user shows a sign-in prompt", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch({ anonymous: true }));
    renderGame("1");
    const addButton = await screen.findByRole("button", { name: /Add to horizon/i });
    await user.click(addButton);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
