// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Sidebar, { navItems } from "./Sidebar";

describe("Sidebar", () => {
  it("each navigation link points to its declared route", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    for (const { label, to } of navItems) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", to);
    }
  });

  it("marks the active route link as current and leaves others unmarked", () => {
    const active = navItems.find(({ end }) => !end)!;
    const other = navItems.find(({ to }) => to !== active.to)!;

    render(
      <MemoryRouter initialEntries={[active.to]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: active.label })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: other.label })).not.toHaveAttribute("aria-current", "page");
  });
});
