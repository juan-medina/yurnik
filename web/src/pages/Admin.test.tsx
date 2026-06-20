// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { vi } from "vitest";
import { screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

  // Regression test: the reports list used to be populated only as a side
  // effect inside queryFn, so a warm/cached ["admin", "reports"] entry (e.g.
  // from revisiting the tab) never reached the page, leaving it stuck empty.
  it("renders cached reports immediately on a warm cache, without re-fetching", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    queryClient.setQueryData(["auth", "me"], ADMIN_PLAYER);
    queryClient.setQueryData(["admin", "reports"], { reports: [MOCK_REPORT] });
    vi.mocked(reportsService.listReports).mockRejectedValue(new Error("should not be called"));

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin"]}>
          <Admin />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });
});
