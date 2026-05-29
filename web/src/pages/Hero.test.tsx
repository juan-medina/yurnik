// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, afterEach } from "vitest";
import { MemoryRouter } from "react-router";
import { MY_FOLLOWERS, MY_FOLLOWING, MY_PLAYER, MY_PLAYER_ID, JOURNEYS } from "@/lib/mock";
import { _reset as resetJourneys } from "@/services/journeys";
import { _reset as resetPlayers } from "@/services/players";
import { renderWithProviders } from "@/test/utils";
import Hero from "./Hero";

const MY_SESSIONS = JOURNEYS.filter((j) => j.player.id === MY_PLAYER_ID);

function mockApime(overrides?: { bio?: string }) {
  let currentBio: string | null = overrides?.bio !== undefined ? overrides.bio : MY_PLAYER.bio ?? null;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("/api/me") && (!init?.method || init.method === "GET")) {
      return new Response(
        JSON.stringify({
          id: MY_PLAYER.id,
          handle: MY_PLAYER.handle,
          color: MY_PLAYER.color,
          avatar_url: MY_PLAYER.avatarUrl ?? null,
          bio: currentBio,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/api/me") && init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      if (body.bio !== undefined) currentBio = body.bio;
      return new Response(null, { status: 204 });
    }
    if (url.includes("/api/players/me/journeys") && (!init?.method || init.method === "GET")) {
      const journeys = MY_SESSIONS.map((j) => ({
        id: j.id,
        igdb_id: 1,
        game: j.game,
        cover_url: j.coverUrl ?? null,
        genres: j.genres,
        played_at: j.playedAt.toISOString(),
        duration_seconds: 3600,
      }));
      return new Response(
        JSON.stringify({ journeys }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
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
  resetJourneys();
  resetPlayers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Hero — Bluesky link", () => {
  it("links to the player's Bluesky profile for editing", async () => {
    renderHero();
    const link = await screen.findByRole("link", { name: "Edit profile on Bluesky" });
    expect(link).toHaveAttribute("href", `https://bsky.app/profile/${MY_PLAYER.handle}`);
  });
});

describe("Hero — bio", () => {
  it("displays the bio from mock player", async () => {
    renderHero();
    expect(await screen.findByText(MY_PLAYER.bio!)).toBeInTheDocument();
  });

  it("clicking Edit bio shows a textarea with the current bio", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(await screen.findByRole("button", { name: "Edit bio" }));
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue(MY_PLAYER.bio!);
  });

  it("saving an edited bio updates the displayed text", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(await screen.findByRole("button", { name: "Edit bio" }));
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    await user.clear(textarea);
    await user.type(textarea, "New bio text");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("New bio text")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Bio" })).not.toBeInTheDocument();
  });

  it("canceling bio edit restores the original bio", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(await screen.findByRole("button", { name: "Edit bio" }));
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    await user.clear(textarea);
    await user.type(textarea, "Changed text");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(MY_PLAYER.bio!)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Bio" })).not.toBeInTheDocument();
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
      expect(await screen.findByText(journey.game)).toBeInTheDocument();
    }
  });

  it("liking a journey changes the button label to Unlike", async () => {
    const user = userEvent.setup();
    renderHero();
    const [firstLike] = await screen.findAllByRole("button", { name: "Like" });
    await user.click(firstLike);
    expect(await screen.findByRole("button", { name: "Unlike" })).toBeInTheDocument();
  });

  it("un-liking a journey restores all Like buttons", async () => {
    const user = userEvent.setup();
    renderHero();
    const [firstLike] = await screen.findAllByRole("button", { name: "Like" });
    await user.click(firstLike);
    await user.click(await screen.findByRole("button", { name: "Unlike" }));
    expect(await screen.findAllByRole("button", { name: "Like" })).toHaveLength(MY_SESSIONS.length);
  });
});
