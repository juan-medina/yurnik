// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MOCK_PENDING_SESSIONS } from "@/lib/mock";
import Journeys from "./Journeys";

function renderJourneys() {
  return render(
    <MemoryRouter>
      <Journeys />
    </MemoryRouter>,
  );
}

describe("Journeys — pending actions", () => {
  it("discarding a pending session removes it from the list", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const first = MOCK_PENDING_SESSIONS[0];
    const [firstDiscard] = screen.getAllByRole("button", { name: "Discard" });
    await user.click(firstDiscard);
    expect(screen.queryByText(first.game)).not.toBeInTheDocument();
  });

  it("clicking Confirm opens the log form", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstConfirm] = screen.getAllByRole("button", { name: "Confirm" });
    await user.click(firstConfirm);
    expect(screen.getByPlaceholderText("Add a log entry… (optional)")).toBeInTheDocument();
  });

  it("canceling the log form restores the discard and confirm buttons", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstConfirm] = screen.getAllByRole("button", { name: "Confirm" });
    await user.click(firstConfirm);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByRole("button", { name: "Confirm" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length,
    );
  });

  it("publishing from the log form removes the session from the pending list", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const first = MOCK_PENDING_SESSIONS[0];
    const [firstConfirm] = screen.getAllByRole("button", { name: "Confirm" });
    await user.click(firstConfirm);
    await user.click(screen.getByRole("button", { name: "Publish journey" }));
    expect(screen.queryByText(first.game)).not.toBeInTheDocument();
  });

  it("Change link on a pending card opens the game search directly", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstChange] = screen.getAllByRole("button", { name: "Change" });
    await user.click(firstChange);
    expect(screen.getByPlaceholderText("Search for a game…")).toBeInTheDocument();
  });

  it("can change the game from the confirm form", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstConfirm] = screen.getAllByRole("button", { name: "Confirm" });
    await user.click(firstConfirm);
    // First "Change" in the DOM belongs to the confirm form's GameSelector
    const [changeInForm] = screen.getAllByRole("button", { name: "Change" });
    await user.click(changeInForm);
    await user.type(screen.getByPlaceholderText("Search for a game…"), "Sekiro");
    await user.click(screen.getByRole("button", { name: /Sekiro/ }));
    expect(screen.getByText("Sekiro")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
  });

  it("pending section disappears when all sessions are dismissed", async () => {
    const user = userEvent.setup();
    renderJourneys();
    for (const _ of MOCK_PENDING_SESSIONS) {
      await user.click(screen.getAllByRole("button", { name: "Discard" })[0]);
    }
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });
});

describe("Journeys — client hint", () => {
  it("dismissing the hint hides it", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/installing the Windows client/)).not.toBeInTheDocument();
  });
});

describe("Journeys — add journey", () => {
  it("clicking Add journey shows the game search", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Add journey" }));
    expect(screen.getByPlaceholderText("Search for a game…")).toBeInTheDocument();
  });

  it("canceling the add form hides it", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Add journey" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
  });

  it("Log journey is disabled until a game is selected and duration set", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Add journey" }));

    expect(screen.getByRole("button", { name: "Log journey" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Search for a game…"), "Celeste");
    await user.click(screen.getByRole("button", { name: /Celeste/ }));
    expect(screen.getByRole("button", { name: "Log journey" })).toBeDisabled();

    await user.clear(screen.getByRole("spinbutton", { name: "Hours" }));
    await user.type(screen.getByRole("spinbutton", { name: "Hours" }), "2");
    expect(screen.getByRole("button", { name: "Log journey" })).toBeEnabled();
  });

  it("selecting a game hides the search input and shows the game name", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Add journey" }));
    await user.type(screen.getByPlaceholderText("Search for a game…"), "Celeste");
    await user.click(screen.getByRole("button", { name: /Celeste/ }));
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
    expect(screen.getByText("Celeste")).toBeInTheDocument();
  });

  it("adding a journey places it in History", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Add journey" }));
    await user.type(screen.getByPlaceholderText("Search for a game…"), "Celeste");
    await user.click(screen.getByRole("button", { name: /Celeste/ }));
    await user.clear(screen.getByRole("spinbutton", { name: "Hours" }));
    await user.type(screen.getByRole("spinbutton", { name: "Hours" }), "2");
    await user.click(screen.getByRole("button", { name: "Log journey" }));
    expect(screen.getByText("Celeste")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
  });
});
