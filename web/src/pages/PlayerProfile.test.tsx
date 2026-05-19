// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { MOCK_FRIENDS_ON_JOURNEY, MY_PLAYER_ID, PLAYERS, SESSIONS } from "@/lib/mock";
import PlayerProfile from "./PlayerProfile";

function renderProfile(handle: string) {
  return render(
    <MemoryRouter initialEntries={[`/player/${handle}`]}>
      <Routes>
        <Route path="/player/:handle" element={<PlayerProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

const followed = MOCK_FRIENDS_ON_JOURNEY[0].player;
const unfollowed = SESSIONS.find(
  (s) =>
    s.player.id !== MY_PLAYER_ID &&
    !MOCK_FRIENDS_ON_JOURNEY.some((jp) => jp.player.handle === s.player.handle),
)!.player;

describe("PlayerProfile", () => {
  it("shows Player not found for an unknown handle", () => {
    renderProfile("nobody.bsky.social");
    expect(screen.getByText("Player not found.")).toBeInTheDocument();
  });

  it("shows the player's sessions on their profile", () => {
    const player = PLAYERS[1]; // Alex Torres — has s2 and s6
    renderProfile(player.handle);
    const sessions = SESSIONS.filter((s) => s.player.handle === player.handle);
    for (const s of sessions) {
      expect(screen.getByText(s.game)).toBeInTheDocument();
    }
  });

  it("shows Unfollow for an already-followed player", () => {
    renderProfile(followed.handle);
    expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("shows Follow for a player not yet followed", () => {
    renderProfile(unfollowed.handle);
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("Follow toggles to Unfollow after clicking", async () => {
    const user = userEvent.setup();
    renderProfile(unfollowed.handle);
    await user.click(screen.getByRole("button", { name: "Follow" }));
    expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("Unfollow toggles to Follow after clicking", async () => {
    const user = userEvent.setup();
    renderProfile(followed.handle);
    await user.click(screen.getByRole("button", { name: "Unfollow" }));
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
  });

  it("does not show a follow button on your own profile", () => {
    const me = PLAYERS.find((p) => p.id === "p1")!;
    renderProfile(me.handle);
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unfollow" })).not.toBeInTheDocument();
  });
});
