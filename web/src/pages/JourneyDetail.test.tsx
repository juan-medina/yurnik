// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { SESSIONS } from "@/lib/mock";
import JourneyDetail from "./JourneyDetail";

function renderJourney(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/journey/${id}`]}>
      <Routes>
        <Route path="/journey/:id" element={<JourneyDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("JourneyDetail", () => {
  it("shows a not-found message for an unknown journey id", () => {
    renderJourney("does-not-exist");
    expect(screen.getByText("Journey not found.")).toBeInTheDocument();
  });

  it("renders the session game title for a known journey", () => {
    const session = SESSIONS.find((s) => s.id === "s1")!;
    renderJourney(session.id);
    expect(screen.getByRole("heading", { name: session.game })).toBeInTheDocument();
  });

  it("liking a journey increments the displayed count by one", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const likeButton = screen.getByRole("button", { name: "Like" });
    const before = Number(likeButton.textContent);
    await user.click(likeButton);
    expect(Number(screen.getByRole("button", { name: "Unlike" }).textContent)).toBe(before + 1);
  });

  it("unliking restores the original count", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    const likeButton = screen.getByRole("button", { name: "Like" });
    const original = Number(likeButton.textContent);
    await user.click(likeButton);
    await user.click(screen.getByRole("button", { name: "Unlike" }));
    expect(Number(screen.getByRole("button", { name: "Like" }).textContent)).toBe(original);
  });

  it("Post button is disabled when the comment field is empty", () => {
    renderJourney("s1");
    expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
  });

  it("Post button enables once the comment field has text", async () => {
    const user = userEvent.setup();
    renderJourney("s1");
    await user.type(screen.getByPlaceholderText("Add a comment…"), "Great session!");
    expect(screen.getByRole("button", { name: "Post" })).toBeEnabled();
  });
});
