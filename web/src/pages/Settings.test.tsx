// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MOCK_EXCLUSIONS, MOCK_GAME_HINTS } from "@/lib/mock";
import Settings from "./Settings";

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

describe("Settings — sign out", () => {
  it("clicking Sign out shows inline confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByText("Sign out?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("canceling sign out hides the confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Sign out?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("confirming sign out hides the confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.queryByText("Sign out?")).not.toBeInTheDocument();
  });
});

describe("Settings — exclusions", () => {
  it("clicking Remove on an exclusion shows inline confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("canceling exclusion removal restores the row", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` }),
    ).toBeInTheDocument();
  });

  it("confirming removal removes the exclusion from the list", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: `Remove ${MOCK_EXCLUSIONS[0].exeName}` }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText(MOCK_EXCLUSIONS[0].exeName)).not.toBeInTheDocument();
  });

  it("removing all exclusions shows empty state", async () => {
    const user = userEvent.setup();
    renderSettings();
    for (const exc of MOCK_EXCLUSIONS) {
      await user.click(screen.getByRole("button", { name: `Remove ${exc.exeName}` }));
      await user.click(screen.getByRole("button", { name: "Remove" }));
    }
    expect(screen.getByText("No exclusions yet.")).toBeInTheDocument();
  });
});

describe("Settings — game hints", () => {
  it("clicking Remove on a hint shows inline confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      screen.getByRole("button", { name: `Remove hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("canceling hint removal restores the row", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      screen.getByRole("button", { name: `Remove hint for ${MOCK_GAME_HINTS[0].exeName}` }),
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
      screen.getByRole("button", { name: `Remove hint for ${MOCK_GAME_HINTS[0].exeName}` }),
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText(MOCK_GAME_HINTS[0].exeName)).not.toBeInTheDocument();
  });

  it("removing all hints shows empty state", async () => {
    const user = userEvent.setup();
    renderSettings();
    for (const hint of MOCK_GAME_HINTS) {
      await user.click(screen.getByRole("button", { name: `Remove hint for ${hint.exeName}` }));
      await user.click(screen.getByRole("button", { name: "Remove" }));
    }
    expect(screen.getByText("No hints yet.")).toBeInTheDocument();
  });
});
