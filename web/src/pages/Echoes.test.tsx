// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { vi } from "vitest";
import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MOCK_ECHOES, MY_PLAYER } from "@/test/fixtures";
import * as echoesService from "@/services/echoes";
import { renderWithProviders } from "@/test/utils";
import Echoes from "./Echoes";

vi.mock("@/services/echoes");

function renderEchoes() {
  return renderWithProviders(
    <MemoryRouter>
      <Echoes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(echoesService.getEchoes).mockResolvedValue({ echoes: [...MOCK_ECHOES] });
  vi.mocked(echoesService.markAllRead).mockResolvedValue(undefined);
});

describe("Echoes", () => {
  it("marks all echoes as read when the page opens", async () => {
    renderEchoes();
    await screen.findAllByText(/commented on your/);
    expect(echoesService.markAllRead).toHaveBeenCalledOnce();
  });

  it("Comments filter hides follower echoes", async () => {
    const user = userEvent.setup();
    renderEchoes();
    await screen.findAllByText(/started following you/);
    await user.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.queryByText(/started following you/)).not.toBeInTheDocument();
  });

  it("Followers filter hides comment echoes", async () => {
    const user = userEvent.setup();
    renderEchoes();
    await screen.findAllByText(/commented on your/);
    await user.click(screen.getByRole("button", { name: "Followers" }));
    expect(screen.queryByText(/commented on your/)).not.toBeInTheDocument();
  });

  it("comment echo links to its journey", async () => {
    renderEchoes();
    const firstComment = MOCK_ECHOES.find((e) => e.type === "new_comment")!;
    const links = await screen.findAllByRole("link", { name: /commented on your/ });
    expect(links[0]).toHaveAttribute("href", `/journey/${firstComment.subjectId}`);
  });

  it("comment reply echo links to its journey", async () => {
    renderEchoes();
    const reply = MOCK_ECHOES.find((e) => e.type === "new_comment_reply")!;
    const links = await screen.findAllByRole("link", { name: /also commented on/ });
    expect(links[0]).toHaveAttribute("href", `/journey/${reply.subjectId}`);
  });

  it("Comments filter includes comment reply echoes", async () => {
    const user = userEvent.setup();
    renderEchoes();
    await screen.findAllByText(/also commented on/);
    await user.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.queryByText(/also commented on/)).toBeInTheDocument();
  });

  it("Followers filter hides comment reply echoes", async () => {
    const user = userEvent.setup();
    renderEchoes();
    await screen.findAllByText(/also commented on/);
    await user.click(screen.getByRole("button", { name: "Followers" }));
    expect(screen.queryByText(/also commented on/)).not.toBeInTheDocument();
  });

  it("follower echo links to the first actor's profile", async () => {
    renderEchoes();
    const firstFollower = MOCK_ECHOES.find((e) => e.type === "new_follower")!;
    const links = await screen.findAllByRole("link", { name: /started following you/ });
    expect(links[0]).toHaveAttribute("href", `/player/${firstFollower.actors[0].handle}`);
  });

  it("shows a Load more button when the API returns a next_cursor", async () => {
    vi.mocked(echoesService.getEchoes).mockResolvedValue({
      echoes: [...MOCK_ECHOES],
      nextCursor: "2026-06-01T12:00:00Z|42",
    });
    renderEchoes();
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not show a Load more button when the API returns no next_cursor", async () => {
    renderEchoes();
    await screen.findAllByText(/commented on your/);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  // Regression test: the echo list used to be populated only as a side
  // effect inside queryFn, so a warm/cached entry under this page's own
  // query key never reached the page, leaving it stuck empty despite real
  // cached data. (A separate, related bug — this page sharing the
  // ["echoes"] key with the global nav-badge hook — is covered by
  // Shell.test.tsx, which renders both consumers together.)
  it("renders cached echoes immediately on a warm cache, without re-fetching", async () => {
    vi.mocked(echoesService.markAllRead).mockResolvedValue(undefined);
    vi.mocked(echoesService.getEchoes).mockRejectedValue(new Error("should not be called"));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    queryClient.setQueryData(["auth", "me"], MY_PLAYER);
    queryClient.setQueryData(["echoes", "page"], { echoes: [...MOCK_ECHOES] });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Echoes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText(/commented on your/)).not.toHaveLength(0);
  });
});
