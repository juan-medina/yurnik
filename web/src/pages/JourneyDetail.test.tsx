// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { MOCK_COMMENTS, MOCK_OTHERS_ON_JOURNEY, MY_PLAYER_ID, SESSIONS } from "@/lib/mock";
import { _reset as resetSessions } from "@/services/sessions";
import { _reset as resetPlayers } from "@/services/players";
import { _reset as resetJourneys } from "@/services/journeys";
import { renderWithProviders } from "@/test/utils";
import JourneyDetail from "./JourneyDetail";

function renderJourney(id: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/journey/${id}`]}>
      <Routes>
        <Route path="/journey/:id" element={<JourneyDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetJourneys();
  resetSessions();
  resetPlayers();
});

describe("JourneyDetail", () => {
  it("shows a not-found message for an unknown journey id", async () => {
    renderJourney("does-not-exist");
    expect(await screen.findByText("Journey not found.")).toBeInTheDocument();
  });

  it("renders the session game title for a known journey", async () => {
    const session = SESSIONS.find((s) => s.id === "s1")!;
    renderJourney(session.id);
    expect(await screen.findByRole("heading", { name: session.game })).toBeInTheDocument();
  });

  it("liking a journey increments the displayed count by one", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const likeButton = await screen.findByRole("button", { name: "Like" });
    const before = Number(likeButton.textContent);
    await user.click(likeButton);
    const unlikeButton = await screen.findByRole("button", { name: "Unlike" });
    expect(Number(unlikeButton.textContent)).toBe(before + 1);
  });

  it("unliking restores the original count", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const likeButton = await screen.findByRole("button", { name: "Like" });
    const original = Number(likeButton.textContent);
    await user.click(likeButton);
    await user.click(await screen.findByRole("button", { name: "Unlike" }));
    expect(Number((await screen.findByRole("button", { name: "Like" })).textContent)).toBe(original);
  });

  it("Post button is disabled when the comment field is empty", async () => {
    renderJourney("s1");
    expect(await screen.findByRole("button", { name: "Post" })).toBeDisabled();
  });

  it("Post button enables once the comment field has text", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    await screen.findByRole("button", { name: "Post" });
    await user.type(screen.getByPlaceholderText("Add a comment…"), "Great session!");
    expect(screen.getByRole("button", { name: "Post" })).toBeEnabled();
  });

  it("clicking 'See who liked this' opens the liked-by modal", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    await user.click(await screen.findByRole("button", { name: "See who liked this" }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("shows Follow only for Others players, not Friends on this journey", async () => {
    renderJourney("s1"); // s1 is my session — no owner Follow button
    const buttons = await screen.findAllByRole("button", { name: "Follow" });
    expect(buttons).toHaveLength(MOCK_OTHERS_ON_JOURNEY.length);
  });

  it("clicking Follow on an Others player toggles to Following", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const followButtons = await screen.findAllByRole("button", { name: "Follow" });
    await user.click(followButtons[0]);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Follow" })).toHaveLength(
        MOCK_OTHERS_ON_JOURNEY.length - 1,
      ),
    );
  });

  it("shows Unfollow for an already-followed session owner", async () => {
    // s2 belongs to Alex Torres who is in MY_FOLLOWING
    renderJourney("s2");
    expect(await screen.findByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("clicking Unfollow for the owner removes the Unfollow button", async () => {
    const user = userEvent.setup();
    renderJourney("s2");
    await user.click(await screen.findByRole("button", { name: "Unfollow" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Unfollow" })).not.toBeInTheDocument(),
    );
  });

  it("delete journey button is visible only for owned sessions", async () => {
    renderJourney("s1");
    expect(await screen.findByRole("button", { name: "Delete journey" })).toBeInTheDocument();
  });

  it("delete journey button is not shown on another player's session", async () => {
    renderJourney("s2");
    await screen.findByRole("heading", { name: "Baldur's Gate 3" });
    expect(screen.queryByRole("button", { name: "Delete journey" })).not.toBeInTheDocument();
  });

  it("deleting a journey navigates away", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    await user.click(await screen.findByRole("button", { name: "Delete journey" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(SESSIONS.find((s) => s.id === "s1")).toBeUndefined());
  });

  it("delete comment button appears only on own comments", async () => {
    renderJourney("s1");
    const deleteButtons = await screen.findAllByRole("button", { name: "Delete comment" });
    expect(deleteButtons).toHaveLength(MOCK_COMMENTS.filter((c) => c.player.id === MY_PLAYER_ID).length);
  });

  it("deleting a comment removes it from the list", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const before = await screen.findAllByRole("button", { name: "Delete comment" });
    await user.click(before[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryAllByRole("button", { name: "Delete comment" })).toHaveLength(before.length - 1),
    );
  });
});
