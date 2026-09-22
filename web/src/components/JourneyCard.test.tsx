// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/utils";
import JourneyCard from "./JourneyCard";
import type { Journey } from "@/models";

const mockJourney: Journey = {
  id: "j-123",
  igdbId: 1001,
  game: "Elden Ring",
  player: {
    id: "p1",
    name: "Tarnished",
    handle: "tarnished",
    color: "#7c3aed",
  },
  genres: ["Action", "RPG"],
  releaseYear: 2022,
  duration: "2h 15m",
  totalDurationSeconds: 162000, // 45h
  playedAt: new Date("2026-06-15T00:00:00Z"),
  log: "Defeated Malenia finally!",
};

describe("JourneyCard", () => {
  it("renders session duration and total playtime when totalDurationSeconds is present", () => {
    renderWithProviders(
      <MemoryRouter>
        <JourneyCard journey={mockJourney} />
      </MemoryRouter>,
    );

    expect(screen.getByText("2h 15m")).toBeInTheDocument();
    expect(screen.getByText("(45h total)")).toBeInTheDocument();
  });

  it("renders only session duration when totalDurationSeconds is undefined", () => {
    const journeyWithoutTotal: Journey = {
      ...mockJourney,
      totalDurationSeconds: undefined,
    };

    renderWithProviders(
      <MemoryRouter>
        <JourneyCard journey={journeyWithoutTotal} />
      </MemoryRouter>,
    );

    expect(screen.getByText("2h 15m")).toBeInTheDocument();
    expect(screen.queryByText(/total\)/)).not.toBeInTheDocument();
  });

  it("navigates to journey detail on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={["/feed"]}>
        <Routes>
          <Route path="/feed" element={<JourneyCard journey={mockJourney} />} />
          <Route path="/journey/:id" element={<div>Journey Detail Page {mockJourney.id}</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const article = screen.getByRole("article");
    await user.click(article);

    expect(await screen.findByText(`Journey Detail Page ${mockJourney.id}`)).toBeInTheDocument();
  });

  it("renders player info when showPlayer is true", () => {
    renderWithProviders(
      <MemoryRouter>
        <JourneyCard journey={mockJourney} showPlayer={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Tarnished")).toBeInTheDocument();
    expect(screen.getByText("@tarnished")).toBeInTheDocument();
  });
});
