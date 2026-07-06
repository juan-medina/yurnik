// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";
import type { Journey, PendingJourney } from "@/models/journey";
import type { Echo } from "@/models/echo";
import type { Game, GameActivity, GameDetail, Comment, JourneyPlayer } from "@/models/game";
import type { HorizonEntry } from "@/models/player";

export const PLAYERS: Player[] = [
  {
    id: "p1", name: "Maria Chen", handle: "maria.bsky.social", color: "#7c3aed",
    avatarUrl: "https://i.pravatar.cc/150?img=47",
    bio: "Chasing bosses and logging every moment. Soulslike enjoyer.",
    followers: 142, following: 37,
  },
  {
    id: "p2", name: "Alex Torres", handle: "alextorres.bsky.social", color: "#059669",
    avatarUrl: "https://i.pravatar.cc/150?img=12",
    bio: "Tactical RPG enthusiast. Always in co-op.",
    followers: 89, following: 64,
  },
  {
    id: "p3", name: "Sam Okafor", handle: "samokafor.bsky.social", color: "#d97706",
    avatarUrl: "https://i.pravatar.cc/150?img=25",
    bio: "Metroidvania completionist. Every map cell, every achievement.",
    followers: 213, following: 51,
  },
  {
    id: "p4", name: "Rin Nakamura", handle: "rin.bsky.social", color: "#e11d48",
    avatarUrl: "https://i.pravatar.cc/150?img=33",
    bio: "Open world wanderer. Story over speed.",
    followers: 58, following: 92,
  },
];

function coverUrl(game: string): string | undefined {
  const urls: Record<string, string> = {
    "Elden Ring": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900.jpg",
    "Baldur's Gate 3": "https://cdn.akamai.steamstatic.com/steam/apps/1086940/library_600x900.jpg",
    "Hollow Knight": "https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900.jpg",
    "Cyberpunk 2077": "https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg",
    "Hades II": "https://cdn.akamai.steamstatic.com/steam/apps/1145360/library_600x900.jpg",
    "Dead Cells": "https://cdn.akamai.steamstatic.com/steam/apps/588650/library_600x900.jpg",
    "Dark Souls III": "https://cdn.akamai.steamstatic.com/steam/apps/374320/library_600x900.jpg",
    "Sekiro": "https://cdn.akamai.steamstatic.com/steam/apps/814380/library_600x900.jpg",
    "Celeste": "https://cdn.akamai.steamstatic.com/steam/apps/504230/library_600x900.jpg",
    "Disco Elysium": "https://cdn.akamai.steamstatic.com/steam/apps/632470/library_600x900.jpg",
    "Persona 5 Royal": "https://cdn.akamai.steamstatic.com/steam/apps/1687950/library_600x900.jpg",
    "Monster Hunter: World": "https://cdn.akamai.steamstatic.com/steam/apps/582010/library_600x900.jpg",
  };
  return urls[game];
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}
function minsAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

export const JOURNEYS: Journey[] = [
  {
    id: "s1", igdbId: 1, player: PLAYERS[0], game: "Elden Ring",
    coverUrl: coverUrl("Elden Ring"),
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "3h 14m", playedAt: minsAgo(23),
    log: "Finally took down Malenia after 40 attempts. The muscle memory just clicked.",
  },
  {
    id: "s2", igdbId: 2, player: PLAYERS[1], game: "Baldur's Gate 3",
    coverUrl: coverUrl("Baldur's Gate 3"),
    genres: ["RPG", "Strategy", "Co-op"],
    duration: "4h 30m", playedAt: hoursAgo(1),
  },
  {
    id: "s3", igdbId: 3, player: PLAYERS[2], game: "Hollow Knight",
    coverUrl: coverUrl("Hollow Knight"),
    genres: ["Metroidvania", "Action", "Indie"],
    duration: "2h 07m", playedAt: hoursAgo(3),
    log: "The Abyss section hit different today. Incredible atmosphere.",
  },
  {
    id: "s4", igdbId: 4, player: PLAYERS[3], game: "Cyberpunk 2077",
    coverUrl: coverUrl("Cyberpunk 2077"),
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "1h 52m", playedAt: new Date(),
  },
  {
    id: "s5", igdbId: 5, player: PLAYERS[0], game: "Hades II",
    coverUrl: coverUrl("Hades II"),
    genres: ["Roguelite", "Action", "Indie"],
    duration: "45m", playedAt: daysAgo(1),
    log: "New build is insane — Aspect of Melinoë with the moon staff.",
  },
  {
    id: "s6", igdbId: 6, player: PLAYERS[1], game: "Dead Cells",
    coverUrl: coverUrl("Dead Cells"),
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 18m", playedAt: daysAgo(2),
  },
  {
    id: "s7", igdbId: 1, player: PLAYERS[2], game: "Elden Ring",
    coverUrl: coverUrl("Elden Ring"),
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "2h 44m", playedAt: daysAgo(2),
    log: "Started a fresh Arcane build. Let's see how this goes.",
  },
  {
    id: "s8", igdbId: 1,
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    game: "Elden Ring", coverUrl: coverUrl("Elden Ring"),
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "3h 02m", playedAt: daysAgo(1),
  },
  {
    id: "s9", igdbId: 4,
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    game: "Cyberpunk 2077", coverUrl: coverUrl("Cyberpunk 2077"),
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "55m", playedAt: daysAgo(3),
  },
  {
    id: "s10", igdbId: 3,
    player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
    game: "Hollow Knight", coverUrl: coverUrl("Hollow Knight"),
    genres: ["Metroidvania", "Action", "Indie"],
    duration: "2h 11m", playedAt: daysAgo(7),
  },
  {
    id: "s11", igdbId: 5,
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    game: "Hades II", coverUrl: coverUrl("Hades II"),
    genres: ["Roguelite", "Action", "Indie"],
    duration: "6h 18m", playedAt: daysAgo(3),
  },
  {
    id: "s12", igdbId: 6,
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    game: "Dead Cells", coverUrl: coverUrl("Dead Cells"),
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 10m", playedAt: daysAgo(5),
  },
];

export const MOCK_COMMENTS: Comment[] = [
  {
    id: "c1", player: PLAYERS[1],
    text: "40 attempts is wild, respect. I gave up at 20.",
    commentedAt: minsAgo(18),
    mentions: [],
  },
  {
    id: "c2", player: PLAYERS[2],
    text: "Which build were you running? I keep dying in phase 2.",
    commentedAt: minsAgo(15),
    mentions: [],
  },
  {
    id: "c3", player: PLAYERS[0],
    text: "Bleed build, Rivers of Blood. Phase 2 just takes patience — stop panic rolling.",
    commentedAt: minsAgo(12),
    mentions: [],
  },
  {
    id: "c4", player: PLAYERS[3],
    text: "She's the hardest optional boss in the game. Congrats fr",
    commentedAt: minsAgo(5),
    mentions: [],
  },
];

export const MOCK_FRIENDS_ON_JOURNEY: JourneyPlayer[] = [
  { journeyId: "j_p2", player: PLAYERS[1], duration: "2h 44m", playedAt: daysAgo(2), isFollowing: true, isSelf: false },
  { journeyId: "j_p3", player: PLAYERS[2], duration: "1h 30m", playedAt: daysAgo(5), isFollowing: true, isSelf: false },
  { journeyId: "j_p4", player: PLAYERS[3], duration: "4h 10m", playedAt: daysAgo(7), isFollowing: true, isSelf: false },
];

export const MOCK_OTHERS_ON_JOURNEY: JourneyPlayer[] = [
  {
    journeyId: "j_o1", player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    duration: "3h 02m", playedAt: daysAgo(1), isFollowing: false, isSelf: false,
  },
  {
    journeyId: "j_o2", player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    duration: "55m", playedAt: daysAgo(3), isFollowing: false, isSelf: false,
  },
  {
    journeyId: "j_o3", player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    duration: "6h 18m", playedAt: daysAgo(4), isFollowing: false, isSelf: false,
  },
  {
    journeyId: "j_o4", player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
    duration: "2h 11m", playedAt: daysAgo(7), isFollowing: false, isSelf: false,
  },
];

export const MY_PLAYER_ID = "p1";
export const MY_PLAYER = PLAYERS.find((p) => p.id === MY_PLAYER_ID)!;

const OTHER_PLAYERS: Player[] = [
  { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
  { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
  { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
  { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
];

export const MY_FOLLOWING: Player[] = MOCK_FRIENDS_ON_JOURNEY.map((jp) => jp.player);
export const MY_FOLLOWERS: Player[] = [
  PLAYERS[1], PLAYERS[2], OTHER_PLAYERS[0], OTHER_PLAYERS[1], OTHER_PLAYERS[2],
];

export const MOCK_FOLLOW_LISTS: Record<string, { followers: Player[]; following: Player[] }> = {
  p2: {
    followers: [MY_PLAYER, PLAYERS[2], OTHER_PLAYERS[0], OTHER_PLAYERS[3]],
    following: [MY_PLAYER, PLAYERS[3], OTHER_PLAYERS[1], OTHER_PLAYERS[2]],
  },
  p3: {
    followers: [MY_PLAYER, PLAYERS[1], OTHER_PLAYERS[0], OTHER_PLAYERS[1], OTHER_PLAYERS[2]],
    following: [MY_PLAYER, PLAYERS[0], OTHER_PLAYERS[3]],
  },
  p4: {
    followers: [OTHER_PLAYERS[0], OTHER_PLAYERS[2]],
    following: [MY_PLAYER, PLAYERS[1], PLAYERS[2], OTHER_PLAYERS[0], OTHER_PLAYERS[1]],
  },
};

export const GAME_LIBRARY: Game[] = [
  { id: "g1", game: "Elden Ring", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900.jpg", genres: ["RPG", "Soulslike", "Open World"] },
  { id: "g2", game: "Baldur's Gate 3", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/library_600x900.jpg", genres: ["RPG", "Strategy", "Co-op"] },
  { id: "g3", game: "Hollow Knight", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900.jpg", genres: ["Metroidvania", "Action", "Indie"] },
  { id: "g4", game: "Cyberpunk 2077", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg", genres: ["RPG", "Open World", "Sci-fi"] },
  { id: "g5", game: "Hades II", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1145360/library_600x900.jpg", genres: ["Roguelite", "Action", "Indie"] },
  { id: "g6", game: "Dead Cells", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/588650/library_600x900.jpg", genres: ["Roguelike", "Action", "Platformer"] },
  { id: "g7", game: "Dark Souls III", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/374320/library_600x900.jpg", genres: ["RPG", "Soulslike", "Action"] },
  { id: "g8", game: "Sekiro", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/814380/library_600x900.jpg", genres: ["Action", "Soulslike"] },
  { id: "g9", game: "Celeste", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/504230/library_600x900.jpg", genres: ["Platformer", "Indie"] },
  { id: "g10", game: "Disco Elysium", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/632470/library_600x900.jpg", genres: ["RPG", "Adventure", "Narrative"] },
  { id: "g11", game: "Persona 5 Royal", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1687950/library_600x900.jpg", genres: ["RPG", "JRPG", "Turn-based"] },
  { id: "g12", game: "Monster Hunter: World", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/582010/library_600x900.jpg", genres: ["Action", "RPG", "Co-op"] },
];

export const MOCK_GAME_DETAIL: GameDetail = {
  id: "1",
  name: "Elden Ring",
  coverUrl: coverUrl("Elden Ring"),
  genres: ["RPG", "Soulslike", "Open World"],
  releaseYear: 2022,
  platforms: ["PC", "PlayStation 5", "Xbox Series X"],
  developer: "FromSoftware",
  publisher: "Bandai Namco",
  summary: "A vast world where open fields with a variety of situations and huge dungeons are seamlessly connected.",
  screenshots: [
    "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1.jpg",
    "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc2.jpg",
  ],
  trailerId: "E3y8jNIHZCA",
  storeLinks: {
    steam: "https://store.steampowered.com/app/1245620",
    epic: "https://store.epicgames.com/p/elden-ring",
  },
  inHorizon: false,
};

export const MOCK_HORIZON: HorizonEntry[] = [
  { igdbId: 4, name: "Cyberpunk 2077", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg", genres: ["RPG", "Open World", "Sci-fi"], releaseYear: 2020 },
  { igdbId: 5, name: "Hades", coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1145360/library_600x900.jpg", genres: ["Roguelike", "Action"], releaseYear: 2020 },
];

export const MOCK_PENDING_JOURNEYS: PendingJourney[] = [
  {
    id: "ps1", game: "Cyberpunk 2077",
    coverUrl: coverUrl("Cyberpunk 2077"),
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "1h 52m", durationSeconds: 6720,
    startedAt: new Date(Date.now() - 6720 * 1000), endedAt: new Date(),
    exeName: "cyberpunk2077.exe", windowTitle: "Cyberpunk 2077",
  },
  {
    id: "ps2", game: "Dead Cells",
    coverUrl: coverUrl("Dead Cells"),
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 18m", durationSeconds: 4680,
    startedAt: new Date(hoursAgo(2).getTime() - 4680 * 1000), endedAt: hoursAgo(2),
    exeName: "deadcells.exe", windowTitle: "Dead Cells",
  },
  {
    id: "ps3", game: "",
    genres: [], duration: "34m", durationSeconds: 2040,
    startedAt: new Date(hoursAgo(5).getTime() - 2040 * 1000), endedAt: hoursAgo(5),
    exeName: "svb.exe", windowTitle: "SVB!",
  },
];

export const MOCK_ECHOES: Echo[] = [
  {
    id: "e1", type: "new_comment",
    actors: [PLAYERS[1], PLAYERS[2]],
    actorCount: 2,
    subjectId: "s1", subjectIgdbId: null, subjectTitle: "Elden Ring",
    read: false,
    createdAt: minsAgo(18), updatedAt: minsAgo(10),
  },
  {
    id: "e2", type: "new_follower",
    actors: [{ id: "o1", name: "Jordan Park", handle: "jordanp", color: "#0284c7" }],
    actorCount: 1,
    subjectId: null, subjectIgdbId: null, subjectTitle: null,
    read: false,
    createdAt: minsAgo(45), updatedAt: minsAgo(45),
  },
  {
    id: "e3", type: "new_comment",
    actors: [PLAYERS[3]],
    actorCount: 1,
    subjectId: "s5", subjectIgdbId: null, subjectTitle: "Hades II",
    read: true,
    createdAt: hoursAgo(5), updatedAt: hoursAgo(5),
  },
  {
    id: "e4", type: "new_follower",
    actors: [
      { id: "o2", name: "Priya Nair", handle: "priyanair", color: "#7c3aed" },
      { id: "o3", name: "Luca Rossi", handle: "lucarossi", color: "#059669" },
    ],
    actorCount: 3,
    subjectId: null, subjectIgdbId: null, subjectTitle: null,
    read: true,
    createdAt: daysAgo(1), updatedAt: hoursAgo(3),
  },
  {
    id: "e5", type: "new_comment_reply",
    actors: [PLAYERS[1]],
    actorCount: 1,
    subjectId: "s9", subjectIgdbId: null, subjectTitle: "Hollow Knight",
    read: false,
    createdAt: minsAgo(5), updatedAt: minsAgo(5),
  },
  {
    id: "e6", type: "horizon_release",
    actors: [],
    actorCount: 0,
    subjectId: null, subjectIgdbId: 1, subjectTitle: "Elden Ring: Shadow of the Erdtree",
    read: false,
    createdAt: minsAgo(1), updatedAt: minsAgo(1),
  },
];

export const MOCK_GAME_ACTIVITY: GameActivity[] = [
  {
    id: "ga1", game: "Elden Ring",
    coverUrl: coverUrl("Elden Ring"),
    genres: ["RPG", "Soulslike", "Open World"],
    entries: [
      { sessionId: "s1", player: PLAYERS[0], duration: "3h 14m", playedAt: minsAgo(23), log: "Finally took down Malenia after 40 attempts. The muscle memory just clicked." },
      { sessionId: "s8", player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" }, duration: "3h 02m", playedAt: daysAgo(1) },
      { sessionId: "s7", player: PLAYERS[2], duration: "2h 44m", playedAt: daysAgo(2), log: "Started a fresh Arcane build. Let's see how this goes." },
    ],
  },
  {
    id: "ga2", game: "Cyberpunk 2077",
    coverUrl: coverUrl("Cyberpunk 2077"),
    genres: ["RPG", "Open World", "Sci-fi"],
    entries: [
      { sessionId: "s4", player: PLAYERS[3], duration: "1h 52m", playedAt: new Date() },
      { sessionId: "s9", player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" }, duration: "55m", playedAt: daysAgo(3) },
    ],
  },
  {
    id: "ga3", game: "Hollow Knight",
    coverUrl: coverUrl("Hollow Knight"),
    genres: ["Metroidvania", "Action", "Indie"],
    entries: [
      { sessionId: "s3", player: PLAYERS[2], duration: "2h 07m", playedAt: hoursAgo(3), log: "The Abyss section hit different today. Incredible atmosphere." },
      { sessionId: "s10", player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" }, duration: "2h 11m", playedAt: daysAgo(7) },
    ],
  },
  {
    id: "ga4", game: "Hades II",
    coverUrl: coverUrl("Hades II"),
    genres: ["Roguelite", "Action", "Indie"],
    entries: [
      { sessionId: "s5", player: PLAYERS[0], duration: "45m", playedAt: daysAgo(1), log: "New build is insane — Aspect of Melinoë with the moon staff." },
      { sessionId: "s11", player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" }, duration: "6h 18m", playedAt: daysAgo(3) },
    ],
  },
  {
    id: "ga5", game: "Baldur's Gate 3",
    coverUrl: coverUrl("Baldur's Gate 3"),
    genres: ["RPG", "Strategy", "Co-op"],
    entries: [
      { sessionId: "s2", player: PLAYERS[1], duration: "4h 30m", playedAt: hoursAgo(1) },
    ],
  },
  {
    id: "ga6", game: "Dead Cells",
    coverUrl: coverUrl("Dead Cells"),
    genres: ["Roguelike", "Action", "Platformer"],
    entries: [
      { sessionId: "s6", player: PLAYERS[1], duration: "1h 18m", playedAt: daysAgo(2) },
      { sessionId: "s12", player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" }, duration: "1h 10m", playedAt: daysAgo(5) },
    ],
  },
];
