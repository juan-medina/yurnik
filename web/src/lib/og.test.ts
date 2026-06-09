// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, it, expect } from "vitest";
import { buildOgTags } from "./og";

const SITE = "https://yurnik.gg";
const LOGO = `${SITE}/logo.png`;

describe("buildOgTags — site", () => {
  it("returns site defaults", () => {
    const tags = buildOgTags({ type: "site" }, SITE);
    expect(tags.title).toBe("Yurnik");
    expect(tags.description).toBe("The open social network for gaming journeys.");
    expect(tags.imageUrl).toBe(LOGO);
  });
});

describe("buildOgTags — player", () => {
  it("uses display name in title", () => {
    const tags = buildOgTags({ type: "player", name: "Juan", handle: "juanito" }, SITE);
    expect(tags.title).toBe("Juan — Yurnik");
  });

  it("uses avatar url when present", () => {
    const avatarUrl = "https://cdn.discord.com/avatars/juan.jpg";
    const tags = buildOgTags({ type: "player", name: "Juan", handle: "juanito", avatarUrl }, SITE);
    expect(tags.imageUrl).toBe(avatarUrl);
  });

  it("falls back to logo when no avatar", () => {
    const tags = buildOgTags({ type: "player", name: "Juan", handle: "juanito" }, SITE);
    expect(tags.imageUrl).toBe(LOGO);
  });

  it("uses bio as description when present", () => {
    const tags = buildOgTags({ type: "player", name: "Juan", handle: "juanito", bio: "I love RPGs" }, SITE);
    expect(tags.description).toBe("I love RPGs");
  });

  it("generates description from name when no bio", () => {
    const tags = buildOgTags({ type: "player", name: "Juan", handle: "juanito" }, SITE);
    expect(tags.description).toContain("Juan");
  });
});

describe("buildOgTags — game", () => {
  it("uses game name in title", () => {
    const tags = buildOgTags({ type: "game", name: "Elden Ring" }, SITE);
    expect(tags.title).toBe("Elden Ring — Yurnik");
  });

  it("uses cover url when present", () => {
    const coverUrl = "https://images.igdb.com/igdb/image/upload/t_cover_big/co2ekt.jpg";
    const tags = buildOgTags({ type: "game", name: "Elden Ring", coverUrl }, SITE);
    expect(tags.imageUrl).toBe(coverUrl);
  });

  it("falls back to logo when no cover", () => {
    const tags = buildOgTags({ type: "game", name: "Elden Ring" }, SITE);
    expect(tags.imageUrl).toBe(LOGO);
  });

  it("uses summary as description when present", () => {
    const tags = buildOgTags({ type: "game", name: "Elden Ring", summary: "An open world action RPG." }, SITE);
    expect(tags.description).toBe("An open world action RPG.");
  });

  it("generates description from name when no summary", () => {
    const tags = buildOgTags({ type: "game", name: "Elden Ring" }, SITE);
    expect(tags.description).toContain("Elden Ring");
  });
});

describe("buildOgTags — journey", () => {
  it("builds title from player and game names", () => {
    const tags = buildOgTags({ type: "journey", playerName: "Juan", gameName: "Elden Ring" }, SITE);
    expect(tags.title).toBe("Juan's journey in Elden Ring — Yurnik");
  });

  it("uses game cover art as image", () => {
    const coverUrl = "https://images.igdb.com/igdb/image/upload/t_cover_big/co2ekt.jpg";
    const tags = buildOgTags({ type: "journey", playerName: "Juan", gameName: "Elden Ring", coverUrl }, SITE);
    expect(tags.imageUrl).toBe(coverUrl);
  });

  it("falls back to logo when no cover", () => {
    const tags = buildOgTags({ type: "journey", playerName: "Juan", gameName: "Elden Ring" }, SITE);
    expect(tags.imageUrl).toBe(LOGO);
  });

  it("uses log as description when present", () => {
    const tags = buildOgTags({ type: "journey", playerName: "Juan", gameName: "Elden Ring", log: "Best game ever." }, SITE);
    expect(tags.description).toBe("Best game ever.");
  });

  it("uses fallback description when no log", () => {
    const tags = buildOgTags({ type: "journey", playerName: "Juan", gameName: "Elden Ring" }, SITE);
    expect(tags.description).toBe("Check out this gaming journey on Yurnik.");
  });
});
