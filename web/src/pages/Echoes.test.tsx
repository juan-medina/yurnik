// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MOCK_ECHOES } from "@/test/fixtures";
import * as echoesService from "@/services/echoes";
import { renderWithProviders } from "@/test/utils";
import Echoes from "./Echoes";

vi.mock("@/services/echoes");

function renderEchoes() {
  return renderWithProviders(
    <MemoryRouter>
      <Echoes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(echoesService.getEchoes).mockResolvedValue({ echoes: [...MOCK_ECHOES] });
  vi.mocked(echoesService.markAllRead).mockResolvedValue(undefined);
});

describe("Echoes", () => {
  it("marks all echoes as read when the page opens", async () => {
    renderEchoes();
    await screen.findAllByText(/commented on your/);
    expect(echoesService.markAllRead).toHaveBeenCalledOnce();
  });

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

  it("comment echo links to its journey", async () => {
    renderEchoes();
    const firstComment = MOCK_ECHOES.find((e) => e.type === "new_comment")!;
    const links = await screen.findAllByRole("link", { name: /commented on your/ });
    expect(links[0]).toHaveAttribute("href", `/journey/${firstComment.subjectId}`);
  });

  it("follower echo links to the first actor's profile", async () => {
    renderEchoes();
    const firstFollower = MOCK_ECHOES.find((e) => e.type === "new_follower")!;
    const links = await screen.findAllByRole("link", { name: /started following you/ });
    expect(links[0]).toHaveAttribute("href", `/player/${firstFollower.actors[0].handle}`);
  });

  it("shows a Load more button when the API returns a next_cursor", async () => {
    vi.mocked(echoesService.getEchoes).mockResolvedValue({
      echoes: [...MOCK_ECHOES],
      nextCursor: "2026-06-01T12:00:00Z|42",
    });
    renderEchoes();
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not show a Load more button when the API returns no next_cursor", async () => {
    renderEchoes();
    await screen.findAllByText(/commented on your/);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });
});
