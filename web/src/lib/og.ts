// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

export type OgPage =
  | { type: "site" }
  | { type: "player"; name: string; handle: string; avatarUrl?: string; bio?: string }
  | { type: "game"; name: string; coverUrl?: string; summary?: string }
  | { type: "journey"; playerName: string; gameName: string; coverUrl?: string; log?: string };

export type OgTags = {
  title: string;
  description: string;
  imageUrl: string;
};

export function buildOgTags(page: OgPage, siteUrl: string): OgTags {
  const logo = `${siteUrl}/logo.png`;
  switch (page.type) {
    case "player":
      return {
        title: `${page.name} — Yurnik`,
        description: page.bio ?? `Follow ${page.name}'s gaming journeys on Yurnik.`,
        imageUrl: page.avatarUrl ?? logo,
      };
    case "game":
      return {
        title: `${page.name} — Yurnik`,
        description: page.summary ?? `See who's playing ${page.name} on Yurnik.`,
        imageUrl: page.coverUrl ?? logo,
      };
    case "journey":
      return {
        title: `${page.playerName}'s journey in ${page.gameName} — Yurnik`,
        description: page.log ?? `Check out this gaming journey on Yurnik.`,
        imageUrl: page.coverUrl ?? logo,
      };
    default:
      return {
        title: "Yurnik",
        description: "The open social network for gaming journeys.",
        imageUrl: logo,
      };
  }
}
