// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { MOCK_COMMENTS, MOCK_OTHERS_ON_JOURNEY, MY_PLAYER_ID, MY_PLAYER, JOURNEYS, PLAYERS } from "@/test/fixtures";
import { formatLocalDate } from "@/lib/time";
import { _reset as resetPlayers } from "@/services/players";
import { renderWithProviders } from "@/test/utils";
import JourneyDetail from "./JourneyDetail";

const s1 = JOURNEYS.find((j) => j.id === "s1")!;
const s2 = JOURNEYS.find((j) => j.id === "s2")!;

// Players initially followed: MY_FOLLOWING = PLAYERS[1..3] = p2, p3, p4
const initiallyFollowed = new Set(["p2", "p3", "p4"]);
let followedIds: Set<string>;
let mockComments: typeof MOCK_COMMENTS;

function journeyResponse(j: typeof s1, igdbId: number, durationSeconds: number) {
  return JSON.stringify({
    id: j.id, igdb_id: igdbId, game: j.game,
    cover_url: j.coverUrl ?? null, genres: j.genres,
    duration_seconds: durationSeconds, log: j.log ?? null,
    played_at: formatLocalDate(j.playedAt),
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
    // Routes are keyed by handle (the API resolves {handle} to the internal user,
    // mirroring the real backend); resolve the same way so a regression that builds
    // the URL from player.id instead of player.handle fails this test.
    const resolveByHandleOrId = (value: string) => PLAYERS.find((p) => p.id === value || p.handle === value);

    if (url.includes("/api/players/") && url.endsWith("/follow") && method === "POST") {
      const value = url.split("/api/players/")[1].replace("/follow", "");
      const player = resolveByHandleOrId(value);
      if (player) followedIds.add(player.id);
      return new Response(null, { status: 204 });
    }
    if (url.includes("/api/players/") && url.endsWith("/follow") && method === "DELETE") {
      const value = url.split("/api/players/")[1].replace("/follow", "");
      const player = resolveByHandleOrId(value);
      if (player) followedIds.delete(player.id);
      return new Response(null, { status: 204 });
    }

    // Player detail (used by getIsFollowing)
    const playerDetailMatch = url.match(/\/api\/players\/([^/]+)$/);
    if (playerDetailMatch && method === "GET") {
      const player = resolveByHandleOrId(playerDetailMatch[1]);
      if (!player) return new Response("not found", { status: 404 });
      return json(JSON.stringify({ id: player.id, handle: player.handle, name: player.name, avatar_url: null, color: player.color, followers: 0, following: 0, is_following: followedIds.has(player.id) }));
    }

    // Comments
    const deleteCommentMatch = url.match(/\/api\/journeys\/(\w+)\/comments\/(\S+)$/);
    if (deleteCommentMatch && method === "DELETE") {
      const commentId = deleteCommentMatch[2];
      mockComments = mockComments.filter((c) => c.id !== commentId);
      return new Response(null, { status: 204 });
    }
    if (/\/api\/journeys\/\w+\/comments$/.test(url) && method === "POST") {
      const body = JSON.parse((init?.body as string) ?? "{}");
      const newComment = {
        id: `new-${Date.now()}`,
        player: { id: MY_PLAYER.id, handle: MY_PLAYER.handle, name: MY_PLAYER.name, avatar_url: null, color: MY_PLAYER.color },
        text: body.text as string,
        commented_at: new Date().toISOString(),
      };
      return new Response(JSON.stringify(newComment), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if (/\/api\/journeys\/\w+\/comments$/.test(url) && method === "GET") {
      const comments = mockComments.map((c) => ({
        id: c.id,
        player: { id: c.player.id, handle: c.player.handle, name: c.player.name, avatar_url: c.player.avatarUrl ?? null, color: c.player.color },
        text: c.text,
        commented_at: c.commentedAt.toISOString(),
      }));
      return json(JSON.stringify({ comments }));
    }

    if (/\/api\/journeys\/s1\/players/.test(url)) {
      return json(JSON.stringify({
        players: MOCK_OTHERS_ON_JOURNEY.map((p) => ({
          journey_id: `j_${p.player.id}`,
          player: { id: p.player.id, handle: p.player.handle, name: p.player.name, avatar_url: null, color: p.player.color, is_following: followedIds.has(p.player.id) },
          duration_seconds: 3600,
          played_at: formatLocalDate(new Date()),
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
  mockComments = [...MOCK_COMMENTS];
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
