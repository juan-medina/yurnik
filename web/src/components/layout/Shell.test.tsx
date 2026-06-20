// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { vi } from "vitest";
import { screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { render } from "@testing-library/react";
import { PLAYERS, MOCK_ECHOES } from "@/test/fixtures";
import * as echoesService from "@/services/echoes";
import * as authService from "@/services/auth";
import * as journeysService from "@/services/journeys";
import Shell from "./Shell";
import Echoes from "@/pages/Echoes";

vi.mock("@/services/echoes");
vi.mock("@/services/auth");
vi.mock("@/services/journeys");

// Regression test for a real production bug: Echoes.tsx and useEchoes.ts (used
// by Shell/Sidebar/TopBar on every page) both queried the React Query cache
// under the key ["echoes"] but with two different response shapes. Because
// Shell mounts on every route, its query populated the cache first, and the
// Echoes page then read the wrong-shaped cached value instead of running its
// own fetch — corrupting its state. A test that renders the Echoes page in
// isolation (its own fresh QueryClient, no Shell) can never observe this,
// since the collision only exists when both consumers share one cache. This
// test mounts the real Shell > Outlet > Echoes tree, the way App.tsx actually
// assembles it, under one shared QueryClient.
function renderRealApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ element: <Shell />, children: [{ path: "echoes", element: <Echoes /> }] }],
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
  vi.mocked(echoesService.getEchoes).mockResolvedValue({ echoes: [...MOCK_ECHOES] });
  vi.mocked(echoesService.markAllRead).mockResolvedValue(undefined);
  vi.mocked(journeysService.getPendingJourneysCount).mockResolvedValue(0);
});

describe("Shell + Echoes integration", () => {
  it("renders the echoes list when navigating to /echoes alongside the global nav badge", async () => {
    renderRealApp("/echoes");
    expect(await screen.findAllByText(/commented on your/)).not.toHaveLength(0);
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
