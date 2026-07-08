// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MOCK_BACKLOG } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";
import Backlog from "./Backlog";

function renderBacklog() {
  return renderWithProviders(
    <MemoryRouter>
      <Backlog />
    </MemoryRouter>,
  );
}

describe("Backlog", () => {
  it("shows the player's backlog entries", async () => {
    renderBacklog();
    expect(await screen.findByText(MOCK_BACKLOG[0].name)).toBeInTheDocument();
    expect(await screen.findByText(MOCK_BACKLOG[1].name)).toBeInTheDocument();
  });

  it("shows the first entry as 'Next up'", async () => {
    renderBacklog();
    expect(await screen.findByText(/next up/i)).toBeInTheDocument();
  });

  it("filters entries by genre", async () => {
    const user = userEvent.setup();
    renderBacklog();
    await screen.findByText(MOCK_BACKLOG[0].name);

    await user.click(screen.getByRole("button", { name: /genre/i }));
    await user.click(await screen.findByRole("button", { name: "Roguelike" }));

    expect(await screen.findByText(MOCK_BACKLOG[1].name)).toBeInTheDocument();
    expect(screen.queryByText(MOCK_BACKLOG[0].name)).not.toBeInTheDocument();
    expect(screen.queryByText(/next up/i)).not.toBeInTheDocument();
  });

  it("shows the empty-state copy when the player's backlog has no entries", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/me") && method === "GET") {
        return new Response(
          JSON.stringify({ id: "me", handle: "tester", name: "Tester", color: "#ff0000" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/backlog") && method === "GET") {
        return new Response(JSON.stringify({ entries: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    }));
    renderBacklog();
    expect(await screen.findByText(/place for your future journeys/i)).toBeInTheDocument();
  });

  it("shows a sign-in prompt for anonymous users", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/api/me")) return new Response("unauthorized", { status: 401 });
      return new Response("not found", { status: 404 });
    }));
    renderBacklog();
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("rolling within a genre filter picks a game from that filter only", async () => {
    const user = userEvent.setup();
    renderBacklog();
    await screen.findByText(MOCK_BACKLOG[0].name);

    await user.click(screen.getByRole("button", { name: /genre/i }));
    await user.click(await screen.findByRole("button", { name: "Roguelike" }));
    await screen.findByText(MOCK_BACKLOG[1].name);

    await user.click(screen.getByRole("button", { name: /roll/i }));

    expect(
      await screen.findByRole("link", { name: /view game/i }, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(MOCK_BACKLOG[0].name)).not.toBeInTheDocument();
  });

  it("rolling again re-spins and settles on a new pick", async () => {
    const user = userEvent.setup();
    renderBacklog();
    await screen.findByText(MOCK_BACKLOG[0].name);

    await user.click(screen.getByRole("button", { name: /roll/i }));
    await screen.findByRole("link", { name: /view game/i }, { timeout: 2000 });

    await user.click(screen.getByRole("button", { name: /roll again/i }));
    expect(screen.getByText(/rolling/i)).toBeInTheDocument();

    expect(
      await screen.findByRole("link", { name: /view game/i }, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it("removing an entry takes it off the list", async () => {
    const user = userEvent.setup();
    renderBacklog();
    await screen.findByText(MOCK_BACKLOG[0].name);
    const removeButtons = await screen.findAllByRole("button", { name: /remove from backlog/i });
    await user.click(removeButtons[0]);
    await waitFor(() => expect(screen.queryByText(MOCK_BACKLOG[0].name)).not.toBeInTheDocument());
    expect(await screen.findByText(MOCK_BACKLOG[1].name)).toBeInTheDocument();
  });

  it("removing all entries shows the empty state", async () => {
    const user = userEvent.setup();
    renderBacklog();
    await screen.findByText(MOCK_BACKLOG[0].name);
    for (const entry of MOCK_BACKLOG) {
      const removeButtons = await screen.findAllByRole("button", { name: /remove from backlog/i });
      await user.click(removeButtons[0]);
      await waitFor(() => expect(screen.queryByText(entry.name)).not.toBeInTheDocument());
    }
    expect(await screen.findByText(/place for your future journeys/i)).toBeInTheDocument();
  });
});
