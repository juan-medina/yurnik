// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { GAME_LIBRARY, MOCK_EXCLUSIONS, MOCK_GAME_HINTS } from "@/lib/mock";
import { _reset as resetSettings } from "@/services/settings";
import { renderWithProviders } from "@/test/utils";
import Settings from "./Settings";

function renderSettings() {
  return renderWithProviders(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetSettings();
});

describe("Settings — sign out", () => {
  it("clicking Sign out shows inline confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(screen.getByText("Sign out?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("canceling sign out hides the confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Sign out?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("confirming sign out hides the confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.queryByText("Sign out?")).not.toBeInTheDocument();
  });
});

describe("Settings — exclusions", () => {
  it("clicking Remove on an exclusion shows inline confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` }),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("canceling exclusion removal restores the row", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` }),
    ).toBeInTheDocument();
  });

  it("confirming removal removes the exclusion from the list", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(screen.queryByText(MOCK_EXCLUSIONS[0].exeName)).not.toBeInTheDocument(),
    );
  });

  it("removing all exclusions shows empty state", async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` });
    for (const exc of MOCK_EXCLUSIONS) {
      await user.click(screen.getByRole("button", { name: `Remove ${exc.exeName}` }));
      await user.click(screen.getByRole("button", { name: "Remove" }));
    }
    expect(await screen.findByText("No exclusions yet.")).toBeInTheDocument();
  });
});

describe("Settings — game hints", () => {
  it("clicking Remove on a hint shows inline confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Remove hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("canceling hint removal restores the row", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Remove hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: `Remove hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    ).toBeInTheDocument();
  });

  it("confirming hint removal removes it from the list", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Remove hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(screen.queryByText(MOCK_GAME_HINTS[0].exeName)).not.toBeInTheDocument(),
    );
  });

  it("removing all hints shows empty state", async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByRole("button", { name: `Remove hint for ${MOCK_GAME_HINTS[0].exeName}` });
    for (const hint of MOCK_GAME_HINTS) {
      await user.click(screen.getByRole("button", { name: `Remove hint for ${hint.exeName}` }));
      await user.click(screen.getByRole("button", { name: "Remove" }));
    }
    expect(await screen.findByText("No hints yet.")).toBeInTheDocument();
  });
});

describe("Settings — game hint editing", () => {
  it("clicking Edit on a hint shows a search input", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Edit hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    );
    expect(screen.getByPlaceholderText("Search for a game…")).toBeInTheDocument();
  });

  it("canceling edit restores the normal row", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Edit hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Edit hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    ).toBeInTheDocument();
  });

  it("typing a game name shows matching results", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Edit hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    );
    const matching = GAME_LIBRARY.find((g) => g.game !== MOCK_GAME_HINTS[0].game)!;
    await user.type(screen.getByPlaceholderText("Search for a game…"), matching.game.slice(0, 4));
    expect(await screen.findByRole("button", { name: matching.game })).toBeInTheDocument();
  });

  it("selecting a game updates the hint and closes the editor", async () => {
    const user = userEvent.setup();
    renderSettings();
    const hint = MOCK_GAME_HINTS[0];
    const otherGames = MOCK_GAME_HINTS.map((h) => h.game);
    const newGame = GAME_LIBRARY.find((g) => !otherGames.includes(g.game))!;
    await user.click(
      await screen.findByRole("button", { name: `Edit hint for ${hint.exeName}` }),
    );
    await user.type(screen.getByPlaceholderText("Search for a game…"), newGame.game.slice(0, 4));
    await user.click(await screen.findByRole("button", { name: newGame.game }));
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
    expect(await screen.findByText(newGame.game)).toBeInTheDocument();
  });
});
