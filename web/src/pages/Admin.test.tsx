// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import * as reportsService from "@/services/reports";
import * as authService from "@/services/auth";
import * as adminService from "@/services/admin";
import { renderWithProviders } from "@/test/utils";
import Admin from "./Admin";

vi.mock("@/services/reports");
vi.mock("@/services/auth");
vi.mock("@/services/admin");

const ADMIN_PLAYER = {
  id: "admin-1",
  handle: "admin",
  name: "Admin User",
  color: "#000000",
  isAdmin: true,
};

const MOCK_REPORT = {
  id: "r1",
  reporterHandle: "alice",
  reporterName: "Alice",
  reporterColor: "#ff0000",
  targetType: "comment" as const,
  targetId: "c1",
  contextId: "j1",
  reason: "spam" as const,
  createdAt: new Date("2026-06-01T12:00:00Z"),
};

function renderAdmin() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/admin"]}>
      <Admin />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(authService.getCurrentPlayer).mockResolvedValue(ADMIN_PLAYER);
  vi.mocked(reportsService.listReports).mockResolvedValue({ reports: [MOCK_REPORT] });
  vi.mocked(adminService.listSuspendedUsers).mockResolvedValue([]);
});

describe("Admin — Reports tab", () => {
  it("renders reports from the API", async () => {
    renderAdmin();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("shows a Load more button when the API returns a next_cursor", async () => {
    vi.mocked(reportsService.listReports).mockResolvedValue({
      reports: [MOCK_REPORT],
      nextCursor: "2026-06-01T12:00:00Z|r1",
    });
    renderAdmin();
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not show a Load more button when the API returns no next_cursor", async () => {
    renderAdmin();
    await screen.findByText("Alice");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    });
  });

  it("clicking Load more appends the next page", async () => {
    const user = userEvent.setup();
    const page2Report = { ...MOCK_REPORT, id: "r2", reporterHandle: "bob", reporterName: "Bob" };
    vi.mocked(reportsService.listReports)
      .mockResolvedValueOnce({ reports: [MOCK_REPORT], nextCursor: "2026-06-01T12:00:00Z|r1" })
      .mockResolvedValueOnce({ reports: [page2Report] });

    renderAdmin();
    await user.click(await screen.findByRole("button", { name: /load more/i }));

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});
