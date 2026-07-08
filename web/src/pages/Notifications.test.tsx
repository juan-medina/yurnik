// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { vi } from "vitest";
import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MOCK_NOTIFICATIONS, MY_PLAYER } from "@/test/fixtures";
import * as notificationsService from "@/services/notifications";
import { renderWithProviders } from "@/test/utils";
import Notifications from "./Notifications";

vi.mock("@/services/notifications");

function renderNotifications() {
  return renderWithProviders(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(notificationsService.getNotifications).mockResolvedValue({ notifications: [...MOCK_NOTIFICATIONS] });
  vi.mocked(notificationsService.markAllRead).mockResolvedValue(undefined);
});

describe("Notifications", () => {
  it("marks all notifications as read when the page opens", async () => {
    renderNotifications();
    await screen.findAllByText(/commented on your/);
    expect(notificationsService.markAllRead).toHaveBeenCalledOnce();
  });

  it("Comments filter hides follower notifications", async () => {
    const user = userEvent.setup();
    renderNotifications();
    await screen.findAllByText(/started following you/);
    await user.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.queryByText(/started following you/)).not.toBeInTheDocument();
  });

  it("Followers filter hides comment notifications", async () => {
    const user = userEvent.setup();
    renderNotifications();
    await screen.findAllByText(/commented on your/);
    await user.click(screen.getByRole("button", { name: "Followers" }));
    expect(screen.queryByText(/commented on your/)).not.toBeInTheDocument();
  });

  it("comment notification links to its journey", async () => {
    renderNotifications();
    const firstComment = MOCK_NOTIFICATIONS.find((e) => e.type === "new_comment")!;
    const links = await screen.findAllByRole("link", { name: /commented on your/ });
    expect(links[0]).toHaveAttribute("href", `/journey/${firstComment.subjectId}`);
  });

  it("comment reply notification links to its journey", async () => {
    renderNotifications();
    const reply = MOCK_NOTIFICATIONS.find((e) => e.type === "new_comment_reply")!;
    const links = await screen.findAllByRole("link", { name: /also commented on/ });
    expect(links[0]).toHaveAttribute("href", `/journey/${reply.subjectId}`);
  });

  it("Comments filter includes comment reply notifications", async () => {
    const user = userEvent.setup();
    renderNotifications();
    await screen.findAllByText(/also commented on/);
    await user.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.queryByText(/also commented on/)).toBeInTheDocument();
  });

  it("Followers filter hides comment reply notifications", async () => {
    const user = userEvent.setup();
    renderNotifications();
    await screen.findAllByText(/also commented on/);
    await user.click(screen.getByRole("button", { name: "Followers" }));
    expect(screen.queryByText(/also commented on/)).not.toBeInTheDocument();
  });

  it("follower notification links to the first actor's profile", async () => {
    renderNotifications();
    const firstFollower = MOCK_NOTIFICATIONS.find((e) => e.type === "new_follower")!;
    const links = await screen.findAllByRole("link", { name: /started following you/ });
    expect(links[0]).toHaveAttribute("href", `/player/${firstFollower.actors[0].handle}`);
  });

  it("backlog_release notification links to the game detail page", async () => {
    renderNotifications();
    const release = MOCK_NOTIFICATIONS.find((e) => e.type === "backlog_release")!;
    const links = await screen.findAllByRole("link", { name: /Elden Ring: Shadow of the Erdtree is releasing soon!/ });
    expect(links[0]).toHaveAttribute("href", `/game/${release.subjectIgdbId}`);
  });

  it("shows a Load more button when the API returns a next_cursor", async () => {
    vi.mocked(notificationsService.getNotifications).mockResolvedValue({
      notifications: [...MOCK_NOTIFICATIONS],
      nextCursor: "2026-06-01T12:00:00Z|42",
    });
    renderNotifications();
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not show a Load more button when the API returns no next_cursor", async () => {
    renderNotifications();
    await screen.findAllByText(/commented on your/);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  // Regression test: the notification list used to be populated only as a side
  // effect inside queryFn, so a warm/cached entry under this page's own
  // query key never reached the page, leaving it stuck empty despite real
  // cached data. (A separate, related bug — this page sharing the
  // ["notifications"] key with the global nav-badge hook — is covered by
  // Shell.test.tsx, which renders both consumers together.)
  it("renders cached notifications immediately on a warm cache, without re-fetching", async () => {
    vi.mocked(notificationsService.markAllRead).mockResolvedValue(undefined);
    vi.mocked(notificationsService.getNotifications).mockRejectedValue(new Error("should not be called"));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    queryClient.setQueryData(["auth", "me"], MY_PLAYER);
    queryClient.setQueryData(["notifications", "page"], { notifications: [...MOCK_NOTIFICATIONS] });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Notifications />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText(/commented on your/)).not.toHaveLength(0);
  });
});
