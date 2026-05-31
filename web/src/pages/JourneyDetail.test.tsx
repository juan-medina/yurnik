// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { MOCK_COMMENTS, MOCK_OTHERS_ON_JOURNEY, MY_PLAYER_ID, MY_PLAYER, JOURNEYS, PLAYERS } from "@/lib/mock";
import { _reset as resetJourneys } from "@/services/journeys";
import { _reset as resetPlayers } from "@/services/players";
import { renderWithProviders } from "@/test/utils";
import JourneyDetail from "./JourneyDetail";

const s1 = JOURNEYS.find((j) => j.id === "s1")!;
const s2 = JOURNEYS.find((j) => j.id === "s2")!;

// Players initially followed: MY_FOLLOWING = PLAYERS[1..3] = p2, p3, p4
const initiallyFollowed = new Set(["p2", "p3", "p4"]);
let followedIds: Set<string>;

function journeyResponse(j: typeof s1, igdbId: number, durationSeconds: number) {
  return JSON.stringify({
    id: j.id, igdb_id: igdbId, game: j.game,
    cover_url: j.coverUrl ?? null, genres: j.genres,
    duration_seconds: durationSeconds, log: j.log ?? null,
    played_at: j.playedAt.toISOString(),
    player: { id: j.player.id, handle: j.player.handle, name: j.player.name, avatar_url: null, color: j.player.color },
  });
}

function makeFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = init?.method ?? "GET";
    const json = (body: string) => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });

    if (url.includes("/api/me") && method === "GET") {
      return json(JSON.stringify({ id: MY_PLAYER.id, name: MY_PLAYER.name, handle: MY_PLAYER.handle, avatar_url: null, bio: null, color: MY_PLAYER.color }));
    }

    // Follow / unfollow mutations
    if (url.includes("/api/players/") && url.endsWith("/follow") && method === "POST") {
      const pid = url.split("/api/players/")[1].replace("/follow", "");
      followedIds.add(pid);
      return new Response(null, { status: 204 });
    }
    if (url.includes("/api/players/") && url.endsWith("/follow") && method === "DELETE") {
      const pid = url.split("/api/players/")[1].replace("/follow", "");
      followedIds.delete(pid);
      return new Response(null, { status: 204 });
    }

    // Player detail (used by getIsFollowing)
    const playerDetailMatch = url.match(/\/api\/players\/([^/]+)$/);
    if (playerDetailMatch && method === "GET") {
      const pid = playerDetailMatch[1];
      const player = PLAYERS.find((p) => p.id === pid);
      if (!player) return new Response("not found", { status: 404 });
      return json(JSON.stringify({ id: player.id, handle: player.handle, name: player.name, avatar_url: null, color: player.color, followers: 0, following: 0, is_following: followedIds.has(pid) }));
    }

    if (/\/api\/journeys\/s1\/players/.test(url)) {
      return json(JSON.stringify({
        players: MOCK_OTHERS_ON_JOURNEY.map((p) => ({
          journey_id: `j_${p.player.id}`,
          player: { id: p.player.id, handle: p.player.handle, name: p.player.name, avatar_url: null, color: p.player.color, is_following: followedIds.has(p.player.id) },
          duration_seconds: 3600,
          played_at: new Date().toISOString(),
        })),
      }));
    }
    if (/\/api\/journeys\/\w+\/players/.test(url)) {
      return json(JSON.stringify({ players: [] }));
    }
    if (/\/api\/journeys\/s1$/.test(url) && method === "GET") {
      return json(journeyResponse(s1, 1001, 11640));
    }
    if (/\/api\/journeys\/s2$/.test(url) && method === "GET") {
      return json(journeyResponse(s2, 1002, 16200));
    }
    if (/\/api\/players\/me\/journeys\/s1$/.test(url) && method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return new Response("not found", { status: 404 });
  });
}

function renderJourney(id: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/journey/${id}`]}>
      <Routes>
        <Route path="/journey/:id" element={<JourneyDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  followedIds = new Set(initiallyFollowed);
  resetJourneys();
  resetPlayers();
  vi.stubGlobal("fetch", makeFetch());
});

describe("JourneyDetail", () => {
  it("shows a not-found message for an unknown journey id", async () => {
    renderJourney("does-not-exist");
    expect(await screen.findByText("Journey not found.")).toBeInTheDocument();
  });

  it("renders the journey game title for a known journey", async () => {
    renderJourney("s1");
    expect(await screen.findByRole("heading", { name: s1.game })).toBeInTheDocument();
  });

  it("liking a journey increments the displayed count by one", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const likeButton = await screen.findByRole("button", { name: "Like" });
    const before = Number(likeButton.textContent);
    await user.click(likeButton);
    const unlikeButton = await screen.findByRole("button", { name: "Unlike" });
    expect(Number(unlikeButton.textContent)).toBe(before + 1);
  });

  it("unliking restores the original count", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const likeButton = await screen.findByRole("button", { name: "Like" });
    const original = Number(likeButton.textContent);
    await user.click(likeButton);
    await user.click(await screen.findByRole("button", { name: "Unlike" }));
    expect(Number((await screen.findByRole("button", { name: "Like" })).textContent)).toBe(original);
  });

  it("Post button is disabled when the comment field is empty", async () => {
    renderJourney("s1");
    expect(await screen.findByRole("button", { name: "Post" })).toBeDisabled();
  });

  it("Post button enables once the comment field has text", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    await screen.findByRole("button", { name: "Post" });
    await user.type(screen.getByPlaceholderText("Add a comment…"), "Great journey!");
    expect(screen.getByRole("button", { name: "Post" })).toBeEnabled();
  });

  it("clicking 'See who liked this' opens the liked-by modal", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    await user.click(await screen.findByRole("button", { name: "See who liked this" }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("shows Follow for each player on this journey", async () => {
    renderJourney("s1"); // s1 is my journey — no owner Follow button
    const buttons = await screen.findAllByRole("button", { name: "Follow" });
    expect(buttons).toHaveLength(MOCK_OTHERS_ON_JOURNEY.length);
  });

  it("clicking Follow on a player toggles to Following", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const followButtons = await screen.findAllByRole("button", { name: "Follow" });
    await user.click(followButtons[0]);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Follow" })).toHaveLength(
        MOCK_OTHERS_ON_JOURNEY.length - 1,
      ),
    );
  });

  it("shows Unfollow for an already-followed journey owner", async () => {
    // s2 belongs to Alex Torres who is in MY_FOLLOWING
    renderJourney("s2");
    expect(await screen.findByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("clicking Unfollow for the owner removes the Unfollow button", async () => {
    const user = userEvent.setup();
    renderJourney("s2");
    await user.click(await screen.findByRole("button", { name: "Unfollow" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Unfollow" })).not.toBeInTheDocument(),
    );
  });

  it("delete journey button is visible only for owned journeys", async () => {
    renderJourney("s1");
    expect(await screen.findByRole("button", { name: "Delete journey" })).toBeInTheDocument();
  });

  it("delete journey button is not shown on another player's journey", async () => {
    renderJourney("s2");
    await screen.findByRole("heading", { name: "Baldur's Gate 3" });
    expect(screen.queryByRole("button", { name: "Delete journey" })).not.toBeInTheDocument();
  });

  it("deleting a journey navigates away", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    await user.click(await screen.findByRole("button", { name: "Delete journey" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Elden Ring" })).not.toBeInTheDocument(),
    );
  });

  it("delete comment button appears only on own comments", async () => {
    renderJourney("s1");
    const deleteButtons = await screen.findAllByRole("button", { name: "Delete comment" });
    expect(deleteButtons).toHaveLength(MOCK_COMMENTS.filter((c) => c.player.id === MY_PLAYER_ID).length);
  });

  it("deleting a comment removes it from the list", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const before = await screen.findAllByRole("button", { name: "Delete comment" });
    await user.click(before[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryAllByRole("button", { name: "Delete comment" })).toHaveLength(before.length - 1),
    );
  });
});
