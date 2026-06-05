// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "@/test/utils";
import EditProfileModal from "./EditProfileModal";
import type { Player } from "@/models/player";

const BASE_PLAYER: Player = {
  id: "p1",
  name: "Maria Chen",
  handle: "maria",
  color: "#7c3aed",
  bio: "Soulslike enjoyer.",
};

function renderModal(player: Player, onSave = vi.fn(async () => {}), onClose = vi.fn()) {
  return renderWithProviders(
    <EditProfileModal player={player} onSave={onSave} onClose={onClose} />,
  );
}

describe("EditProfileModal — Use Discord name button", () => {
  it("does not show when hasCustomName is false", () => {
    renderModal({ ...BASE_PLAYER, hasCustomName: false });
    expect(screen.queryByRole("button", { name: /discord name/i })).not.toBeInTheDocument();
  });

  it("shows when hasCustomName is true", () => {
    renderModal({ ...BASE_PLAYER, hasCustomName: true });
    expect(screen.getByRole("button", { name: /discord name/i })).toBeInTheDocument();
  });

  it("clicking Use Discord name clears the display name field", async () => {
    const user = userEvent.setup();
    renderModal({ ...BASE_PLAYER, hasCustomName: true });
    await user.click(screen.getByRole("button", { name: /discord name/i }));
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /display name/i }).value).toBe("");
  });
});

describe("EditProfileModal — save", () => {
  it("calls onSave with changed fields only", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    renderModal(BASE_PLAYER, onSave);

    const nameInput = screen.getByRole("textbox", { name: /display name/i });
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith({ displayName: "New Name" });
  });

  it("does not call onSave when nothing changed", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();
    renderModal(BASE_PLAYER, onSave, onClose);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
