// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MOCK_PENDING_SESSIONS } from "@/lib/mock";
import { _reset as resetSessions } from "@/services/sessions";
import { renderWithProviders } from "@/test/utils";
import Journeys from "./Journeys";

function renderJourneys() {
  return renderWithProviders(
    <MemoryRouter>
      <Journeys />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetSessions();
});

describe("Journeys — pending actions", () => {
  it("discarding a pending session removes it from the list", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const first = MOCK_PENDING_SESSIONS[0];
    const [firstDiscard] = await screen.findAllByRole("button", { name: "Discard" });
    await user.click(firstDiscard);
    expect(screen.queryByText(first.game)).not.toBeInTheDocument();
  });

  it("clicking Confirm opens the log form", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstConfirm] = await screen.findAllByRole("button", { name: "Confirm" });
    await user.click(firstConfirm);
    expect(screen.getByPlaceholderText("Add a log entry… (optional)")).toBeInTheDocument();
  });

  it("canceling the log form restores the discard and confirm buttons", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstConfirm] = await screen.findAllByRole("button", { name: "Confirm" });
    await user.click(firstConfirm);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByRole("button", { name: "Confirm" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length,
    );
  });

  it("publishing from the log form removes the session from pending and adds it to history", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstConfirm] = await screen.findAllByRole("button", { name: "Confirm" });
    await user.click(firstConfirm);
    await user.click(screen.getByRole("button", { name: "Publish journey" }));
    expect(await screen.findAllByRole("button", { name: "Confirm" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length - 1,
    );
    expect(screen.getAllByRole("button", { name: "Discard" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length - 1,
    );
  });

  it("Change link on a pending card opens the game search directly", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstChange] = await screen.findAllByRole("button", { name: "Change" });
    await user.click(firstChange);
    expect(screen.getByPlaceholderText("Search for a game…")).toBeInTheDocument();
  });

  it("can change the game from the confirm form", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstConfirm] = await screen.findAllByRole("button", { name: "Confirm" });
    await user.click(firstConfirm);
    const [changeInForm] = screen.getAllByRole("button", { name: "Change" });
    await user.click(changeInForm);
    await user.type(screen.getByPlaceholderText("Search for a game…"), "Sekiro");
    await user.click(await screen.findByRole("button", { name: /Sekiro/ }));
    expect(screen.getByText("Sekiro")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
  });

  it("pending section disappears when all sessions are dismissed", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await screen.findAllByRole("button", { name: "Discard" });
    for (const _ of MOCK_PENDING_SESSIONS) {
      await user.click(screen.getAllByRole("button", { name: "Discard" })[0]);
    }
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });

  it("Never detect this button appears only when exeName is present", async () => {
    renderJourneys();
    const sessionsWithExe = MOCK_PENDING_SESSIONS.filter((s) => s.exeName);
    const buttons = await screen.findAllByRole("button", { name: "Never detect this" });
    expect(buttons).toHaveLength(sessionsWithExe.length);
  });

  it("clicking Never detect this shows inline confirmation", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstNeverDetect] = await screen.findAllByRole("button", { name: "Never detect this" });
    await user.click(firstNeverDetect);
    expect(screen.getByText("Exclude cyberpunk2077.exe from detection?")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Discard" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length - 1,
    );
    expect(screen.getAllByRole("button", { name: "Confirm" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length - 1,
    );
  });

  it("canceling the exclusion confirmation restores the card", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstNeverDetect] = await screen.findAllByRole("button", { name: "Never detect this" });
    await user.click(firstNeverDetect);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByRole("button", { name: "Discard" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length,
    );
    expect(screen.getAllByRole("button", { name: "Confirm" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length,
    );
  });

  it("confirming exclusion removes the card", async () => {
    const user = userEvent.setup();
    renderJourneys();
    const [firstNeverDetect] = await screen.findAllByRole("button", { name: "Never detect this" });
    await user.click(firstNeverDetect);
    await user.click(screen.getByRole("button", { name: "Exclude" }));
    expect(await screen.findAllByRole("button", { name: "Discard" })).toHaveLength(
      MOCK_PENDING_SESSIONS.length - 1,
    );
  });

  it("unknown game session shows Unknown Game label", async () => {
    renderJourneys();
    expect(await screen.findByText("Unknown Game")).toBeInTheDocument();
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
    await user.click(await screen.findByRole("button", { name: /Celeste/ }));
    expect(screen.getByRole("button", { name: "Log journey" })).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Duration" }), "2h");
    expect(screen.getByRole("button", { name: "Log journey" })).toBeEnabled();
  });

  it("selecting a game hides the search input and shows the game name", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Add journey" }));
    await user.type(screen.getByPlaceholderText("Search for a game…"), "Celeste");
    await user.click(await screen.findByRole("button", { name: /Celeste/ }));
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
    expect(screen.getByText("Celeste")).toBeInTheDocument();
  });

  it("Log journey is disabled when Pick date is selected but no date is picked", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Add journey" }));
    await user.type(screen.getByPlaceholderText("Search for a game…"), "Celeste");
    await user.click(await screen.findByRole("button", { name: /Celeste/ }));
    await user.type(screen.getByRole("textbox", { name: "Duration" }), "2h");

    await user.click(screen.getByRole("button", { name: /Pick date/ }));
    expect(screen.getByRole("button", { name: "Log journey" })).toBeDisabled();
  });

  it("adding a journey places it in History", async () => {
    const user = userEvent.setup();
    renderJourneys();
    await user.click(screen.getByRole("button", { name: "Add journey" }));
    await user.type(screen.getByPlaceholderText("Search for a game…"), "Celeste");
    await user.click(await screen.findByRole("button", { name: /Celeste/ }));
    await user.type(screen.getByRole("textbox", { name: "Duration" }), "2h");
    await user.click(screen.getByRole("button", { name: "Log journey" }));
    expect(await screen.findByText("Celeste")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search for a game…")).not.toBeInTheDocument();
  });
});
