// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PLAYERS } from "@/test/fixtures";
import ActivityItem from "./ActivityItem";
import type { Activity } from "@/models";

function renderActivity(activity: Activity) {
  return render(
    <MemoryRouter>
      <ActivityItem activity={activity} />
    </MemoryRouter>,
  );
}

describe("ActivityItem", () => {
  it("renders a follow event linking to the recipient's profile", () => {
    const activity: Activity = {
      type: "follow",
      createdAt: new Date("2026-06-01T12:00:00Z"),
      actor: PLAYERS[0],
      recipient: PLAYERS[1],
    };
    renderActivity(activity);

    expect(screen.getByText(PLAYERS[0].name, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/started following/i)).toBeInTheDocument();
    expect(screen.getByText(PLAYERS[1].name, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/player/${PLAYERS[1].handle}`);
  });

  it("renders a comment event linking to the journey, with the game title", () => {
    const activity: Activity = {
      type: "comment",
      createdAt: new Date("2026-06-01T12:00:00Z"),
      actor: PLAYERS[0],
      recipient: PLAYERS[1],
      subjectId: "j99",
      subjectTitle: "Elden Ring",
    };
    renderActivity(activity);

    expect(screen.getByText(/commented on/i)).toBeInTheDocument();
    expect(screen.getByText(/Elden Ring/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/journey/j99");
  });

  it("renders 'started following you' and links to the actor when the viewer is the recipient", () => {
    const activity: Activity = {
      type: "follow",
      createdAt: new Date("2026-06-01T12:00:00Z"),
      actor: PLAYERS[0],
      recipient: PLAYERS[1],
    };
    render(
      <MemoryRouter>
        <ActivityItem activity={activity} viewerId={PLAYERS[1].id} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/started following you/i)).toBeInTheDocument();
    expect(screen.queryByText(PLAYERS[1].name, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/player/${PLAYERS[0].handle}`);
  });

  it("renders 'commented on your <game> journey' when the viewer is the recipient", () => {
    const activity: Activity = {
      type: "comment",
      createdAt: new Date("2026-06-01T12:00:00Z"),
      actor: PLAYERS[0],
      recipient: PLAYERS[1],
      subjectId: "j99",
      subjectTitle: "Elden Ring",
    };
    render(
      <MemoryRouter>
        <ActivityItem activity={activity} viewerId={PLAYERS[1].id} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/commented on your Elden Ring journey/i)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/journey/j99");
  });

  it("renders 'You started following <recipient>' when the viewer is the actor", () => {
    const activity: Activity = {
      type: "follow",
      createdAt: new Date("2026-06-01T12:00:00Z"),
      actor: PLAYERS[0],
      recipient: PLAYERS[1],
    };
    render(
      <MemoryRouter>
        <ActivityItem activity={activity} viewerId={PLAYERS[0].id} />
      </MemoryRouter>,
    );

    expect(screen.getByText(new RegExp(`You started following ${PLAYERS[1].name}`, "i"))).toBeInTheDocument();
    expect(screen.queryByText(PLAYERS[0].name, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/player/${PLAYERS[1].handle}`);
  });

  it("renders 'You commented on <recipient>'s <game> journey' when the viewer is the actor", () => {
    const activity: Activity = {
      type: "comment",
      createdAt: new Date("2026-06-01T12:00:00Z"),
      actor: PLAYERS[0],
      recipient: PLAYERS[1],
      subjectId: "j99",
      subjectTitle: "Elden Ring",
    };
    render(
      <MemoryRouter>
        <ActivityItem activity={activity} viewerId={PLAYERS[0].id} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(new RegExp(`You commented on ${PLAYERS[1].name}'s Elden Ring journey`, "i")),
    ).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/journey/j99");
  });

  it("renders 'You commented on your own <game> journey' when the viewer commented on their own journey", () => {
    const activity: Activity = {
      type: "comment",
      createdAt: new Date("2026-06-01T12:00:00Z"),
      actor: PLAYERS[0],
      recipient: PLAYERS[0],
      subjectId: "j99",
      subjectTitle: "Elden Ring",
    };
    render(
      <MemoryRouter>
        <ActivityItem activity={activity} viewerId={PLAYERS[0].id} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/You commented on your own Elden Ring journey/i)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/journey/j99");
  });

  it("renders '<actor> commented on their own <game> journey' when viewing another player's self-comment", () => {
    const activity: Activity = {
      type: "comment",
      createdAt: new Date("2026-06-01T12:00:00Z"),
      actor: PLAYERS[0],
      recipient: PLAYERS[0],
      subjectId: "j99",
      subjectTitle: "Elden Ring",
    };
    renderActivity(activity);

    expect(screen.getByText(PLAYERS[0].name, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/commented on their own Elden Ring journey/i)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/journey/j99");
  });
});
