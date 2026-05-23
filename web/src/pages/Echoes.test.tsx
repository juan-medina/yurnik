// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MOCK_ECHOES } from "@/lib/mock";
import { _reset as resetEchoes } from "@/services/echoes";
import { renderWithProviders } from "@/test/utils";
import Echoes from "./Echoes";

function renderEchoes() {
  return renderWithProviders(
    <MemoryRouter>
      <Echoes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetEchoes();
});

describe("Echoes", () => {
  it("Comments filter hides follower echoes", async () => {
    const user = userEvent.setup();
    renderEchoes();
    await screen.findAllByText(/started following you/);
    await user.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.queryByText(/started following you/)).not.toBeInTheDocument();
  });

  it("Followers filter hides comment echoes", async () => {
    const user = userEvent.setup();
    renderEchoes();
    await screen.findAllByText(/commented on your/);
    await user.click(screen.getByRole("button", { name: "Followers" }));
    expect(screen.queryByText(/commented on your/)).not.toBeInTheDocument();
  });

  it("clicking Mark all read disables the button", async () => {
    const user = userEvent.setup();
    renderEchoes();
    await screen.findAllByText(/commented on your/);
    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled(),
    );
  });

  it("comment echo links to its journey", async () => {
    renderEchoes();
    const firstComment = MOCK_ECHOES.find((e) => e.kind === "comment")!;
    const links = await screen.findAllByRole("link", { name: /commented on your/ });
    expect(links[0]).toHaveAttribute("href", `/journey/${firstComment.sessionId}`);
  });

  it("follower echo links to the follower's player profile", async () => {
    renderEchoes();
    const firstFollower = MOCK_ECHOES.find((e) => e.kind === "follower")!;
    const links = await screen.findAllByRole("link", { name: /started following you/ });
    expect(links[0]).toHaveAttribute("href", `/player/${firstFollower.player.handle}`);
  });
});
