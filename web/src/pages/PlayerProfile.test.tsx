// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { MOCK_FRIENDS_ON_JOURNEY, MY_PLAYER_ID, PLAYERS, JOURNEYS } from "@/lib/mock";
import { _reset as resetPlayers } from "@/services/players";
import { renderWithProviders } from "@/test/utils";
import PlayerProfile from "./PlayerProfile";

function renderProfile(id: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/player/${id}`]}>
      <Routes>
        <Route path="/player/:id" element={<PlayerProfile />} />
        <Route path="/hero" element={<div>Hero</div>} />
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
    renderProfile("nonexistent-id");
    expect(await screen.findByText("Player not found.")).toBeInTheDocument();
  });

  it("shows the player's sessions on their profile", async () => {
    const player = PLAYERS[1]; // Alex Torres — has s2 and s6
    renderProfile(player.id);
    const journeys = JOURNEYS.filter((j) => j.player.id === player.id);
    for (const j of journeys) {
      expect(await screen.findAllByText(j.game)).not.toHaveLength(0);
    }
  });

  it("shows Unfollow for an already-followed player", async () => {
    renderProfile(followed.id);
    expect(await screen.findByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("shows Follow for a player not yet followed", async () => {
    renderProfile(unfollowed.id);
    expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("Follow toggles to Unfollow after clicking", async () => {
    const user = userEvent.setup();
    renderProfile(unfollowed.id);
    await user.click(await screen.findByRole("button", { name: "Follow" }));
    expect(await screen.findByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("Unfollow toggles to Follow after clicking", async () => {
    const user = userEvent.setup();
    renderProfile(followed.id);
    await user.click(await screen.findByRole("button", { name: "Unfollow" }));
    expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("does not show a follow button on your own profile", async () => {
    renderProfile("p1");
    // Own profile redirects to /hero — no follow button is ever rendered
    expect(await screen.findByText("Hero")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unfollow" })).not.toBeInTheDocument();
  });

  it("clicking Followers stat opens the follow list modal", async () => {
    const user = userEvent.setup();
    renderProfile(PLAYERS[1].id);
    await user.click(await screen.findByRole("button", { name: /Followers/ }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("clicking Following stat opens the follow list modal", async () => {
    const user = userEvent.setup();
    renderProfile(PLAYERS[1].id);
    await user.click(await screen.findByRole("button", { name: /Following/ }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
