// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { vi } from "vitest";
import { screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { render } from "@testing-library/react";
import { PLAYERS, MOCK_NOTIFICATIONS } from "@/test/fixtures";
import * as notificationsService from "@/services/notifications";
import * as authService from "@/services/auth";
import * as journeysService from "@/services/journeys";
import Shell from "./Shell";
import Notifications from "@/pages/Notifications";

vi.mock("@/services/notifications");
vi.mock("@/services/auth");
vi.mock("@/services/journeys");

// Regression test for a real production bug: Notifications.tsx and useNotifications.ts (used
// by Shell/Sidebar/TopBar on every page) both queried the React Query cache
// under the key ["notifications"] but with two different response shapes. Because
// Shell mounts on every route, its query populated the cache first, and the
// Notifications page then read the wrong-shaped cached value instead of running its
// own fetch — corrupting its state. A test that renders the Notifications page in
// isolation (its own fresh QueryClient, no Shell) can never observe this,
// since the collision only exists when both consumers share one cache. This
// test mounts the real Shell > Outlet > Notifications tree, the way App.tsx actually
// assembles it, under one shared QueryClient.
function renderRealApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ element: <Shell />, children: [{ path: "notifications", element: <Notifications /> }] }],
    { initialEntries: [initialPath] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(authService.getCurrentPlayer).mockResolvedValue(PLAYERS[0]);
  vi.mocked(notificationsService.getNotifications).mockResolvedValue({ notifications: [...MOCK_NOTIFICATIONS] });
  vi.mocked(notificationsService.markAllRead).mockResolvedValue(undefined);
  vi.mocked(journeysService.getPendingJourneysCount).mockResolvedValue(0);
});

describe("Shell + Notifications integration", () => {
  it("renders the notifications list when navigating to /notifications alongside the global nav badge", async () => {
    renderRealApp("/notifications");
    expect(await screen.findAllByText(/commented on your/)).not.toHaveLength(0);
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
