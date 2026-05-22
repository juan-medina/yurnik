// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MY_PLAYER, MY_PLAYER_ID, SESSIONS } from "@/lib/mock";
import Hero from "./Hero";

const MY_SESSIONS = SESSIONS.filter((s) => s.player.id === MY_PLAYER_ID);

function renderHero() {
  return render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>,
  );
}

describe("Hero — display name", () => {
  it("clicking Edit name shows an input with the current name", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue(MY_PLAYER.name);
  });

  it("saving an edited name updates the displayed name", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    const input = screen.getByRole("textbox", { name: "Display name" });
    await user.clear(input);
    await user.type(input, "Aria Nova");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Aria Nova")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Display name" })).not.toBeInTheDocument();
  });

  it("canceling name edit restores the original name", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    const input = screen.getByRole("textbox", { name: "Display name" });
    await user.clear(input);
    await user.type(input, "Changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(MY_PLAYER.name)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Display name" })).not.toBeInTheDocument();
  });

  it("saving a new name updates the avatar alt text", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: "Edit name" }));
    const input = screen.getByRole("textbox", { name: "Display name" });
    await user.clear(input);
    await user.type(input, "Rex Vance");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("img", { name: "Rex Vance" })).toBeInTheDocument();
  });
});

describe("Hero — avatar", () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-avatar");
  });

  it("uploading a new photo updates the avatar image src", async () => {
    const user = userEvent.setup();
    renderHero();
    const input = screen.getByLabelText("Upload avatar");
    const file = new File(["image-data"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(input, file);
    expect(screen.getByRole("img", { name: MY_PLAYER.name })).toHaveAttribute(
      "src",
      "blob:http://localhost/mock-avatar",
    );
  });
});

describe("Hero — bio", () => {
  it("displays the bio from mock player", () => {
    renderHero();
    expect(screen.getByText(MY_PLAYER.bio!)).toBeInTheDocument();
  });

  it("clicking Edit bio shows a textarea with the current bio", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: "Edit bio" }));
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue(MY_PLAYER.bio!);
  });

  it("saving an edited bio updates the displayed text", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: "Edit bio" }));
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    await user.clear(textarea);
    await user.type(textarea, "New bio text");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("New bio text")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Bio" })).not.toBeInTheDocument();
  });

  it("canceling bio edit restores the original bio", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: "Edit bio" }));
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    await user.clear(textarea);
    await user.type(textarea, "Changed text");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(MY_PLAYER.bio!)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Bio" })).not.toBeInTheDocument();
  });
});

describe("Hero — journeys", () => {
  it("shows a journey card for each of my sessions", () => {
    renderHero();
    for (const session of MY_SESSIONS) {
      expect(screen.getAllByText(session.game).length).toBeGreaterThan(0);
    }
  });

  it("liking a session changes the button label to Unlike", async () => {
    const user = userEvent.setup();
    renderHero();
    const [firstLike] = screen.getAllByRole("button", { name: "Like" });
    await user.click(firstLike);
    expect(screen.getByRole("button", { name: "Unlike" })).toBeInTheDocument();
  });

  it("un-liking a session restores all Like buttons", async () => {
    const user = userEvent.setup();
    renderHero();
    const [firstLike] = screen.getAllByRole("button", { name: "Like" });
    await user.click(firstLike);
    await user.click(screen.getByRole("button", { name: "Unlike" }));
    expect(screen.getAllByRole("button", { name: "Like" })).toHaveLength(MY_SESSIONS.length);
  });
});

