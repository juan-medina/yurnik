// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MOCK_GAME_ACTIVITY } from "@/lib/mock";
import { playerHref } from "@/lib/display";
import { MY_PLAYER_ID } from "@/services/auth";
import { renderWithProviders } from "@/test/utils";
import Players from "./Players";

function renderPlayers() {
  return renderWithProviders(
    <MemoryRouter>
      <Players />
    </MemoryRouter>,
  );
}

describe("Players", () => {
  it("search by game name hides non-matching games", async () => {
    const user = userEvent.setup();
    renderPlayers();
    await screen.findByText(MOCK_GAME_ACTIVITY[0].game);
    await user.type(screen.getByPlaceholderText("Search by game or genre…"), "Elden");
    expect(screen.getByText("Elden Ring")).toBeInTheDocument();
    expect(screen.queryByText("Cyberpunk 2077")).not.toBeInTheDocument();
  });

  it("search by genre shows only games with that genre", async () => {
    const user = userEvent.setup();
    renderPlayers();
    await screen.findByText(MOCK_GAME_ACTIVITY[0].game);
    await user.type(screen.getByPlaceholderText("Search by game or genre…"), "Metroidvania");
    expect(screen.getByText("Hollow Knight")).toBeInTheDocument();
    expect(screen.queryByText("Elden Ring")).not.toBeInTheDocument();
  });

  it("genre chip filters to games with that genre", async () => {
    const user = userEvent.setup();
    renderPlayers();
    await user.click(await screen.findByRole("button", { name: "Indie" }));
    expect(screen.getByText("Hollow Knight")).toBeInTheDocument();
    expect(screen.getByText("Hades II")).toBeInTheDocument();
    expect(screen.queryByText("Elden Ring")).not.toBeInTheDocument();
  });

  it("clicking All chip after genre filter restores all games", async () => {
    const user = userEvent.setup();
    renderPlayers();
    await user.click(await screen.findByRole("button", { name: "Indie" }));
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Elden Ring")).toBeInTheDocument();
    expect(screen.getByText("Hollow Knight")).toBeInTheDocument();
  });

  it("clicking an active genre chip deactivates it", async () => {
    const user = userEvent.setup();
    renderPlayers();
    await user.click(await screen.findByRole("button", { name: "Indie" }));
    expect(screen.queryByText("Elden Ring")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Indie" }));
    expect(screen.getByText("Elden Ring")).toBeInTheDocument();
  });

  it("player name in a journey row links to their profile", async () => {
    renderPlayers();
    const firstGame = MOCK_GAME_ACTIVITY[0];
    const firstEntry = firstGame.entries[0];
    const links = await screen.findAllByRole("link", { name: new RegExp(firstEntry.player.name) });
    const expectedHref = playerHref(firstEntry.player, MY_PLAYER_ID);
    expect(links.some((l) => l.getAttribute("href") === expectedHref)).toBe(true);
  });

  it("empty state appears when nothing matches search", async () => {
    const user = userEvent.setup();
    renderPlayers();
    await screen.findByText(MOCK_GAME_ACTIVITY[0].game);
    await user.type(screen.getByPlaceholderText("Search by game or genre…"), "xyznothing");
    expect(screen.getByText("No games match your search.")).toBeInTheDocument();
  });
});
