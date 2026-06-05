// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, afterEach } from "vitest";
import { MemoryRouter } from "react-router";
import { MY_FOLLOWERS, MY_FOLLOWING, MY_PLAYER, MY_PLAYER_ID, JOURNEYS } from "@/test/fixtures";
import { _reset as resetPlayers } from "@/services/players";
import { renderWithProviders } from "@/test/utils";
import Hero from "./Hero";

const MY_SESSIONS = JOURNEYS.filter((j) => j.player.id === MY_PLAYER_ID);

function toApiPlayer(p: { id: string; handle: string; name: string; avatarUrl?: string; color: string }) {
  return { id: p.id, handle: p.handle, name: p.name, avatar_url: p.avatarUrl ?? null, color: p.color };
}

function mockApime(overrides?: { bio?: string }) {
  let currentBio: string | null = overrides?.bio !== undefined ? overrides.bio : MY_PLAYER.bio ?? null;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

    if (url.includes("/api/me") && (!init?.method || init.method === "GET")) {
      return json({ id: MY_PLAYER.id, name: MY_PLAYER.name, handle: MY_PLAYER.handle, color: MY_PLAYER.color, avatar_url: MY_PLAYER.avatarUrl ?? null, bio: currentBio });
    }
    if (url.includes("/api/me") && init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      if (body.bio !== undefined) currentBio = body.bio;
      return new Response(null, { status: 204 });
    }
    if (url.includes("/api/players/me/journeys") && (!init?.method || init.method === "GET")) {
      const journeys = MY_SESSIONS.map((j) => ({
        id: j.id, igdb_id: 1, game: j.game, cover_url: j.coverUrl ?? null,
        genres: j.genres, played_at: j.playedAt.toISOString(), duration_seconds: 3600,
      }));
      return json({ journeys });
    }
    if (url.includes(`/api/players/${MY_PLAYER.id}/followers`)) {
      return json({ players: MY_FOLLOWERS.map(toApiPlayer) });
    }
    if (url.includes(`/api/players/${MY_PLAYER.id}/following`)) {
      return json({ players: MY_FOLLOWING.map(toApiPlayer) });
    }
    return new Response("not found", { status: 404 });
  });
}

function renderHero() {
  return renderWithProviders(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockApime();
  resetPlayers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Hero — profile", () => {
  it("displays the bio from the player", async () => {
    renderHero();
    expect(await screen.findByText(MY_PLAYER.bio!)).toBeInTheDocument();
  });

  it("clicking the edit button opens the Edit profile modal", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(await screen.findByRole("button", { name: /edit profile/i }));
    expect(screen.getByRole("heading", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /display name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /bio/i })).toBeInTheDocument();
  });

  it("canceling the modal closes it without saving", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(await screen.findByRole("button", { name: /edit profile/i }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Edit profile" })).not.toBeInTheDocument();
  });
});

describe("Hero — follow lists", () => {
  it("clicking Followers stat opens the modal listing followers", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(await screen.findByRole("button", { name: /Followers/ }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByText(MY_FOLLOWERS[0].name)).toBeInTheDocument();
  });

  it("clicking Following stat opens the modal listing following", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(await screen.findByRole("button", { name: /Following/ }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByText(MY_FOLLOWING[0].name)).toBeInTheDocument();
  });

  it("closing the follow list modal hides it", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(await screen.findByRole("button", { name: /Followers/ }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});

describe("Hero — journeys", () => {
  it("shows a journey card for each of my sessions", async () => {
    renderHero();
    for (const journey of MY_SESSIONS) {
      expect(await screen.findAllByText(journey.game)).not.toHaveLength(0);
    }
  });

  it("your own journeys do not show an interactive like button", async () => {
    renderHero();
    await screen.findAllByText(MY_SESSIONS[0].game);
    expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlike" })).not.toBeInTheDocument();
  });
});
