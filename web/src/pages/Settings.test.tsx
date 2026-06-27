// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { GAME_LIBRARY } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";
import Settings from "./Settings";
import type { Exclusion, GameHint } from "@/models/settings";
import { updateGameHint } from "@/services/settings";

const TEST_EXCLUSIONS: Exclusion[] = [
  { exeName: "cyberpunk2077.exe" },
  { exeName: "svb.exe" },
  { exeName: "launcher.exe" },
];

const TEST_HINTS: GameHint[] = [
  { exeName: "eldenring.exe", game: "Elden Ring" },
  { exeName: "bg3.exe", game: "Baldur's Gate 3" },
  { exeName: "hollowknight.exe", game: "Hollow Knight" },
];

const mockState = vi.hoisted(() => ({
  exclusions: [] as Exclusion[],
  hints: [] as GameHint[],
}));

vi.mock("@/services/settings", () => ({
  getExclusions: vi.fn(() => Promise.resolve([...mockState.exclusions])),
  addExclusion: vi.fn(async () => undefined),
  removeExclusion: vi.fn(async (exeName: string) => {
    mockState.exclusions = mockState.exclusions.filter((e) => e.exeName !== exeName);
  }),
  getGameHints: vi.fn(() => Promise.resolve([...mockState.hints])),
  addGameHint: vi.fn(async () => undefined),
  removeGameHint: vi.fn(async (exeName: string) => {
    mockState.hints = mockState.hints.filter((h) => h.exeName !== exeName);
  }),
  updateGameHint: vi.fn(async () => undefined),
}));

function renderSettings() {
  return renderWithProviders(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockState.exclusions = [...TEST_EXCLUSIONS];
  mockState.hints = [...TEST_HINTS];
  vi.mocked(updateGameHint).mockImplementation(async () => undefined);
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
      await screen.findByRole("button", { name: `Remove ${TEST_EXCLUSIONS[0].exeName}` }),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("canceling exclusion removal restores the row", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Remove ${TEST_EXCLUSIONS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: `Remove ${TEST_EXCLUSIONS[0].exeName}` }),
    ).toBeInTheDocument();
  });

  it("confirming removal removes the exclusion from the list", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Remove ${TEST_EXCLUSIONS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(screen.queryByText(TEST_EXCLUSIONS[0].exeName)).not.toBeInTheDocument(),
    );
  });

  it("removing all exclusions shows empty state", async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByRole("button", { name: `Remove ${TEST_EXCLUSIONS[0].exeName}` });
    for (const exc of TEST_EXCLUSIONS) {
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
      await screen.findByRole("button", { name: `Stop auto-confirming ${TEST_HINTS[0].exeName}` }),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("canceling hint removal restores the row", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Stop auto-confirming ${TEST_HINTS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: `Stop auto-confirming ${TEST_HINTS[0].exeName}` }),
    ).toBeInTheDocument();
  });

  it("confirming hint removal removes it from the list", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Stop auto-confirming ${TEST_HINTS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(screen.queryByText(TEST_HINTS[0].exeName)).not.toBeInTheDocument(),
    );
  });

  it("removing all hints shows empty state", async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByRole("button", { name: `Stop auto-confirming ${TEST_HINTS[0].exeName}` });
    for (const hint of TEST_HINTS) {
      await user.click(screen.getByRole("button", { name: `Stop auto-confirming ${hint.exeName}` }));
      await user.click(screen.getByRole("button", { name: "Remove" }));
    }
    expect(await screen.findByText("No games will auto-confirm yet.")).toBeInTheDocument();
  });
});

describe("Settings — game hint editing", () => {
  it("clicking Edit on a hint shows a search input", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Edit auto-confirm for ${TEST_HINTS[0].exeName}` }),
    );
    expect(screen.getByPlaceholderText("Search for a game…")).toBeInTheDocument();
  });

  it("canceling edit restores the normal row", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Edit auto-confirm for ${TEST_HINTS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Edit auto-confirm for ${TEST_HINTS[0].exeName}` }),
    ).toBeInTheDocument();
  });

  it("typing a game name shows matching results", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Edit auto-confirm for ${TEST_HINTS[0].exeName}` }),
    );
    const matching = GAME_LIBRARY.find((g) => g.game !== TEST_HINTS[0].game)!;
    await user.type(screen.getByPlaceholderText("Search for a game…"), matching.game.slice(0, 4));
    expect(await screen.findByRole("button", { name: matching.game })).toBeInTheDocument();
  });

  it("selecting a game updates the hint and closes the editor", async () => {
    const user = userEvent.setup();
    const hint = TEST_HINTS[0];
    const newGame = GAME_LIBRARY.find((g) => !TEST_HINTS.some((h) => h.game === g.game))!;

    vi.mocked(updateGameHint).mockImplementationOnce(async (exeName: string) => {
      mockState.hints = mockState.hints.map((h) =>
        h.exeName === exeName ? { ...h, game: newGame.game } : h,
      );
    });

    renderSettings();
    await user.click(
      await screen.findByRole("button", { name: `Edit auto-confirm for ${hint.exeName}` }),
    );
    await user.type(screen.getByPlaceholderText("Search for a game…"), newGame.game.slice(0, 4));
    await user.click(await screen.findByRole("button", { name: newGame.game }));
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
    expect(await screen.findByText(newGame.game)).toBeInTheDocument();
  });
});
