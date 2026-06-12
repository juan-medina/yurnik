// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import "@testing-library/jest-dom/vitest";
import "@/i18n";
import { beforeEach, afterEach, vi } from "vitest";
import {
  MY_PLAYER,
  MY_FOLLOWING,
  PLAYERS,
  JOURNEYS,
  MOCK_GAME_ACTIVITY,
  MOCK_FOLLOW_LISTS,
  GAME_LIBRARY,
  MOCK_PENDING_JOURNEYS,
  MOCK_HORIZON,
} from "@/test/fixtures";
import type { Player } from "@/models/player";
import { formatLocalDate } from "@/lib/time";

const playerMap = new Map<string, Player>();
for (const p of PLAYERS) playerMap.set(p.id, p);
for (const j of JOURNEYS) {
  if (!playerMap.has(j.player.id)) playerMap.set(j.player.id, j.player);
}
const ALL_PLAYERS = Array.from(playerMap.values());

function toRawPlayer(p: Player) {
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    avatar_url: p.avatarUrl ?? null,
    bio: p.bio ?? null,
    color: p.color,
    followers: p.followers ?? 0,
    following: p.following ?? 0,
  };
}

function toRawHorizonEntry(g: (typeof MOCK_HORIZON)[number]) {
  return {
    igdb_id: g.igdbId,
    name: g.name,
    cover_url: g.coverUrl ?? null,
    genres: g.genres,
    release_year: g.releaseYear ?? null,
  };
}

function makeDefaultFetch() {
  // Mutable follow state for this test. Initially set from MY_FOLLOWING.
  const followState: Record<string, boolean> = {};
  for (const p of MY_FOLLOWING) followState[p.id] = true;

  // Mutable pending journeys state for this test.
  const pendingJourneys = [...MOCK_PENDING_JOURNEYS];

  // Mutable horizon state for this test. Only MY_PLAYER starts with entries.
  const horizonState: Record<string, (typeof MOCK_HORIZON)[number][]> = {
    [MY_PLAYER.id]: [...MOCK_HORIZON],
  };

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    // GET /api/games/search?q=... — must be before other game routes
    if (url.includes("/api/games/search") && method === "GET") {
      const q = new URL(url).searchParams.get("q") ?? "";
      const results = GAME_LIBRARY.filter((g) =>
        g.game.toLowerCase().includes(q.toLowerCase()),
      ).slice(0, 10);
      return new Response(
        JSON.stringify(
          results.map((g) => ({ id: g.id, name: g.game, cover_url: g.coverUrl ?? null, genres: g.genres })),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET /api/me/profile
    if (url.endsWith("/api/me/profile") && method === "GET") {
      const myJourneys = JOURNEYS.filter((j) => j.player.id === MY_PLAYER.id);
      const genreMap = new Map<string, number>();
      for (const j of myJourneys) {
        for (const g of j.genres) genreMap.set(g, (genreMap.get(g) ?? 0) + 0);
      }
      return new Response(
        JSON.stringify({
          ...toRawPlayer(MY_PLAYER),
          is_following: false,
          journey_count: myJourneys.length,
          total_seconds: 0,
          recent_games: [...new Map(myJourneys.map((j) => [j.game, j])).values()].slice(0, 5).map((j) => ({
            igdb_id: j.igdbId ?? 0,
            name: j.game,
            cover_url: j.coverUrl ?? null,
            last_played: formatLocalDate(j.playedAt),
          })),
          genre_hours: [...genreMap.entries()].map(([genre, seconds]) => ({ genre, seconds })),
          horizon: (horizonState[MY_PLAYER.id] ?? []).map(toRawHorizonEntry),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET /api/me
    if (url.includes("/api/me") && method === "GET") {
      return new Response(
        JSON.stringify({
          id: MY_PLAYER.id,
          name: MY_PLAYER.name,
          handle: MY_PLAYER.handle,
          avatar_url: MY_PLAYER.avatarUrl ?? null,
          bio: MY_PLAYER.bio ?? null,
          color: MY_PLAYER.color,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET /api/activity
    if (url.includes("/api/activity") && method === "GET") {
      return new Response(
        JSON.stringify({
          games: MOCK_GAME_ACTIVITY.map((g) => ({
            id: g.id,
            game: g.game,
            cover_url: g.coverUrl ?? null,
            genres: g.genres,
            entries: g.entries.map((e) => ({
              session_id: e.sessionId,
              player: {
                id: e.player.id,
                handle: e.player.handle,
                name: e.player.name,
                avatar_url: e.player.avatarUrl ?? null,
                color: e.player.color,
              },
              duration_seconds: 0,
              played_at: formatLocalDate(e.playedAt),
              log: e.log ?? null,
            })),
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // POST /api/players/me/journeys/pending/:id/(discard|confirm|exclude)
    // Must be before the general journeys routes.
    const pendingActionMatch = url.match(
      /\/api\/players\/me\/journeys\/pending\/([^/]+)\/(discard|confirm|exclude)$/,
    );
    if (pendingActionMatch && method === "POST") {
      const [, id, action] = pendingActionMatch;
      const idx = pendingJourneys.findIndex((p) => p.id === id);
      if (idx >= 0) pendingJourneys.splice(idx, 1);
      if (action === "confirm") {
        return new Response(
          JSON.stringify({ id: `j-${id}` }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 204 });
    }

    // GET /api/players/me/journeys/pending
    if (url.match(/\/api\/players\/me\/journeys\/pending$/) && method === "GET") {
      return new Response(
        JSON.stringify({
          journeys: pendingJourneys.map((p) => ({
            id: p.id,
            status: "active",
            igdb_id: p.igdbId ?? null,
            game: p.game || null,
            cover_url: p.coverUrl ?? null,
            genres: p.genres,
            exe_name: p.exeName ?? null,
            window_title: p.windowTitle ?? null,
            started_at: new Date(p.endedAt.getTime() - 3600000).toISOString(),
            ended_at: p.endedAt.toISOString(),
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // POST /api/players/me/journeys (add journey) — before the GET handler below
    if (url.match(/\/api\/players\/me\/journeys$/) && method === "POST") {
      return new Response(
        JSON.stringify({ id: "new-journey" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    // Players are addressed by handle in URLs (mirrors the real API, which
    // resolves the {handle} path segment to the internal user before querying).
    function resolvePlayer(value: string): Player | undefined {
      if (value === "me") return MY_PLAYER;
      return ALL_PLAYERS.find((p) => p.id === value || p.handle === value);
    }

    // /api/players/:handle/follow (POST or DELETE) — must match before /:handle
    const followMatch = url.match(/\/api\/players\/([^/]+)\/follow$/);
    if (followMatch) {
      const target = resolvePlayer(followMatch[1]);
      if (target) {
        if (method === "POST") followState[target.id] = true;
        if (method === "DELETE") followState[target.id] = false;
      }
      return new Response(null, { status: 200 });
    }

    // GET /api/players/:handle/followers
    const followersMatch = url.match(/\/api\/players\/([^/]+)\/followers$/);
    if (followersMatch && method === "GET") {
      const target = resolvePlayer(followersMatch[1]);
      const players = (target && MOCK_FOLLOW_LISTS[target.id]?.followers) ?? [];
      return new Response(
        JSON.stringify({ players: players.map(toRawPlayer) }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET /api/players/:handle/following
    const followingMatch = url.match(/\/api\/players\/([^/]+)\/following$/);
    if (followingMatch && method === "GET") {
      const target = resolvePlayer(followingMatch[1]);
      const players = (target && MOCK_FOLLOW_LISTS[target.id]?.following) ?? [];
      return new Response(
        JSON.stringify({ players: players.map(toRawPlayer) }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET /api/players/:handle/activity
    const activityMatch = url.match(/\/api\/players\/([^/]+)\/activity$/);
    if (activityMatch && method === "GET") {
      const target = resolvePlayer(activityMatch[1]);
      const pid = target?.id;
      const journeys = JOURNEYS.filter((j) => j.player.id === pid);
      return new Response(
        JSON.stringify({
          items: journeys.map((j) => ({
            kind: "journey",
            journey: {
              id: j.id,
              igdb_id: j.igdbId ?? 0,
              game: j.game,
              cover_url: j.coverUrl ?? null,
              genres: j.genres,
              duration_seconds: 0,
              played_at: formatLocalDate(j.playedAt),
              log: j.log ?? null,
              player: target ? toRawPlayer(target) : { id: pid, handle: "", name: "", color: "#000000" },
            },
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET /api/players/:handle/journeys
    const journeysMatch = url.match(/\/api\/players\/([^/]+)\/journeys$/);
    if (journeysMatch && method === "GET") {
      const target = resolvePlayer(journeysMatch[1]);
      const pid = target?.id;
      const journeys = JOURNEYS.filter((j) => j.player.id === pid);
      return new Response(
        JSON.stringify({
          journeys: journeys.map((j) => ({
            id: j.id,
            igdb_id: 0,
            game: j.game,
            cover_url: j.coverUrl ?? null,
            genres: j.genres,
            played_at: formatLocalDate(j.playedAt),
            duration_seconds: 0,
            log: j.log ?? null,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET /api/players/:handle/profile
    const playerProfileMatch = url.match(/\/api\/players\/([^/]+)\/profile$/);
    if (playerProfileMatch && method === "GET") {
      const player = resolvePlayer(playerProfileMatch[1]);
      if (!player) return new Response("not found", { status: 404 });
      const pid = player.id;
      const pJourneys = JOURNEYS.filter((j) => j.player.id === pid);
      const genreMap = new Map<string, number>();
      for (const j of pJourneys) {
        for (const g of j.genres) genreMap.set(g, (genreMap.get(g) ?? 0) + 0);
      }
      return new Response(
        JSON.stringify({
          ...toRawPlayer(player),
          is_following: followState[pid] ?? false,
          journey_count: pJourneys.length,
          total_seconds: 0,
          recent_games: [...new Map(pJourneys.map((j) => [j.game, j])).values()].slice(0, 5).map((j) => ({
            igdb_id: j.igdbId ?? 0,
            name: j.game,
            cover_url: j.coverUrl ?? null,
            last_played: formatLocalDate(j.playedAt),
          })),
          genre_hours: [...genreMap.entries()].map(([genre, seconds]) => ({ genre, seconds })),
          horizon: (horizonState[pid] ?? []).map(toRawHorizonEntry),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET /api/players/:handle/horizon
    const horizonMatch = url.match(/\/api\/players\/([^/]+)\/horizon$/);
    if (horizonMatch && method === "GET") {
      const target = resolvePlayer(horizonMatch[1]);
      const entries = (target && horizonState[target.id]) ?? [];
      return new Response(
        JSON.stringify({ entries: entries.map(toRawHorizonEntry) }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // POST /api/me/horizon
    if (url.endsWith("/api/me/horizon") && method === "POST") {
      return new Response(null, { status: 204 });
    }

    // DELETE /api/me/horizon/:igdbId
    const removeHorizonMatch = url.match(/\/api\/me\/horizon\/(\d+)$/);
    if (removeHorizonMatch && method === "DELETE") {
      const igdbId = Number(removeHorizonMatch[1]);
      const entries = horizonState[MY_PLAYER.id] ?? [];
      horizonState[MY_PLAYER.id] = entries.filter((e) => e.igdbId !== igdbId);
      return new Response(null, { status: 204 });
    }

    // GET /api/players/:handle
    const playerMatch = url.match(/\/api\/players\/([^/]+)$/);
    if (playerMatch && method === "GET") {
      const player = resolvePlayer(playerMatch[1]);
      if (!player) return new Response("not found", { status: 404 });
      return new Response(
        JSON.stringify({
          ...toRawPlayer(player),
          is_following: followState[player.id] ?? false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("not found", { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeDefaultFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});
