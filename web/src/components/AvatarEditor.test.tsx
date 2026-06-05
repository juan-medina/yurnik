// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "@/test/utils";
import AvatarEditor from "./AvatarEditor";
import type { Player } from "@/models/player";

vi.mock("@/services/avatar", () => ({
  uploadAvatar: vi.fn(async () => undefined),
  removeAvatar: vi.fn(async () => undefined),
  ACCEPTED_AVATAR_TYPES: ["image/jpeg", "image/png", "image/webp"],
  ACCEPTED_AVATAR_EXTENSIONS: ".jpg,.jpeg,.png,.webp",
  MAX_AVATAR_BYTES: 2 * 1024 * 1024,
}));

const BASE_PLAYER: Player = {
  id: "p1",
  name: "Maria Chen",
  handle: "maria",
  color: "#7c3aed",
};

function renderEditor(player: Player, onChanged = vi.fn()) {
  return renderWithProviders(<AvatarEditor player={player} onChanged={onChanged} />);
}

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Edit avatar" }));
}

describe("AvatarEditor — modal", () => {
  it("clicking the avatar opens the modal", async () => {
    const user = userEvent.setup();
    renderEditor(BASE_PLAYER);
    await openModal(user);
    expect(screen.getByText("Change avatar")).toBeInTheDocument();
  });

  it("Upload image button is always present in the modal", async () => {
    const user = userEvent.setup();
    renderEditor(BASE_PLAYER);
    await openModal(user);
    expect(screen.getByRole("button", { name: /upload image/i })).toBeInTheDocument();
  });
});

describe("AvatarEditor — state reset", () => {
  it("modal reopens in idle state after a successful upload", async () => {
    const { uploadAvatar } = await import("@/services/avatar");
    vi.mocked(uploadAvatar).mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderEditor({ ...BASE_PLAYER, hasCustomAvatar: false });

    await openModal(user);

    const file = new File(["data"], "avatar.jpg", { type: "image/jpeg" });
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    await userEvent.upload(input, file);

    // Modal closes after upload — open it again
    await openModal(user);
    expect(screen.getByRole("button", { name: /upload image/i })).toBeInTheDocument();
    expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
  });
});

describe("AvatarEditor — remove button", () => {
  it("does not show Use Discord avatar when hasCustomAvatar is false", async () => {
    const user = userEvent.setup();
    renderEditor({ ...BASE_PLAYER, hasCustomAvatar: false });
    await openModal(user);
    expect(screen.queryByRole("button", { name: /discord avatar/i })).not.toBeInTheDocument();
  });

  it("shows Use Discord avatar when hasCustomAvatar is true", async () => {
    const user = userEvent.setup();
    renderEditor({ ...BASE_PLAYER, hasCustomAvatar: true });
    await openModal(user);
    expect(screen.getByRole("button", { name: /discord avatar/i })).toBeInTheDocument();
  });
});
