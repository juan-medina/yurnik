// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

export type Player = {
  id: string;
  name: string;
  handle: string;
  color: string;
  avatarUrl?: string;
  bio?: string;
  followers?: number;
  following?: number;
};

export type MockSession = {
  id: string;
  player: Player;
  game: string;
  coverColor: string;
  coverAccent: string;
  genres: string[];
  duration: string;
  playedAt: Date;
  log?: string;
  likes: number;
};

export type MockComment = {
  id: string;
  player: Player;
  text: string;
  commentedAt: Date;
};

export type JourneyPlayer = {
  player: Player;
  duration: string;
  playedAt: Date;
  isFollowing: boolean;
};

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

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}
function minsAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

export const SESSIONS: MockSession[] = [
  {
    id: "s1",
    player: PLAYERS[0],
    game: "Elden Ring",
    coverColor: "#3d2b1f",
    coverAccent: "#c9a84c",
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "3h 14m",
    playedAt: minsAgo(23),
    log: "Finally took down Malenia after 40 attempts. The muscle memory just clicked.",
    likes: 47,
  },
  {
    id: "s2",
    player: PLAYERS[1],
    game: "Baldur's Gate 3",
    coverColor: "#1a1f3e",
    coverAccent: "#818cf8",
    genres: ["RPG", "Strategy", "Co-op"],
    duration: "4h 30m",
    playedAt: hoursAgo(1),
    likes: 12,
  },
  {
    id: "s3",
    player: PLAYERS[2],
    game: "Hollow Knight",
    coverColor: "#1c1c2e",
    coverAccent: "#94a3b8",
    genres: ["Metroidvania", "Action", "Indie"],
    duration: "2h 07m",
    playedAt: hoursAgo(3),
    log: "The Abyss section hit different today. Incredible atmosphere.",
    likes: 8,
  },
  {
    id: "s4",
    player: PLAYERS[3],
    game: "Cyberpunk 2077",
    coverColor: "#0a0a12",
    coverAccent: "#eab308",
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "1h 52m",
    playedAt: new Date(),
    likes: 0,
  },
  {
    id: "s5",
    player: PLAYERS[0],
    game: "Hades II",
    coverColor: "#2d0a0a",
    coverAccent: "#f97316",
    genres: ["Roguelite", "Action", "Indie"],
    duration: "45m",
    playedAt: daysAgo(1),
    log: "New build is insane — Aspect of Melinoë with the moon staff.",
    likes: 23,
  },
  {
    id: "s6",
    player: PLAYERS[1],
    game: "Dead Cells",
    coverColor: "#0f2a1e",
    coverAccent: "#22c55e",
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 18m",
    playedAt: daysAgo(2),
    likes: 5,
  },
  {
    id: "s7",
    player: PLAYERS[2],
    game: "Elden Ring",
    coverColor: "#3d2b1f",
    coverAccent: "#c9a84c",
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "2h 44m",
    playedAt: daysAgo(2),
    log: "Started a fresh Arcane build. Let's see how this goes.",
    likes: 31,
  },
  {
    id: "s8",
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    game: "Elden Ring",
    coverColor: "#3d2b1f",
    coverAccent: "#c9a84c",
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "3h 02m",
    playedAt: daysAgo(1),
    likes: 4,
  },
  {
    id: "s9",
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    game: "Cyberpunk 2077",
    coverColor: "#0a0a12",
    coverAccent: "#eab308",
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "55m",
    playedAt: daysAgo(3),
    likes: 2,
  },
  {
    id: "s10",
    player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
    game: "Hollow Knight",
    coverColor: "#1c1c2e",
    coverAccent: "#94a3b8",
    genres: ["Metroidvania", "Action", "Indie"],
    duration: "2h 11m",
    playedAt: daysAgo(7),
    likes: 7,
  },
  {
    id: "s11",
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    game: "Hades II",
    coverColor: "#2d0a0a",
    coverAccent: "#f97316",
    genres: ["Roguelite", "Action", "Indie"],
    duration: "6h 18m",
    playedAt: daysAgo(3),
    likes: 15,
  },
  {
    id: "s12",
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    game: "Dead Cells",
    coverColor: "#0f2a1e",
    coverAccent: "#22c55e",
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 10m",
    playedAt: daysAgo(5),
    likes: 1,
  },
];

export const MOCK_LIKERS: Player[] = [
  { id: "l1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
  { id: "l2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
  { id: "l3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
  { id: "l4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
  { id: "l5", name: "Alex Torres", handle: "alextorres.bsky.social", color: "#059669" },
];

export const MOCK_COMMENTS: MockComment[] = [
  {
    id: "c1",
    player: PLAYERS[1],
    text: "40 attempts is wild, respect. I gave up at 20.",
    commentedAt: minsAgo(18),
  },
  {
    id: "c2",
    player: PLAYERS[2],
    text: "Which build were you running? I keep dying in phase 2.",
    commentedAt: minsAgo(15),
  },
  {
    id: "c3",
    player: PLAYERS[0],
    text: "Bleed build, Rivers of Blood. Phase 2 just takes patience — stop panic rolling.",
    commentedAt: minsAgo(12),
  },
  {
    id: "c4",
    player: PLAYERS[3],
    text: "She's the hardest optional boss in the game. Congrats fr",
    commentedAt: minsAgo(5),
  },
];

export const MOCK_FRIENDS_ON_JOURNEY: JourneyPlayer[] = [
  { player: PLAYERS[1], duration: "2h 44m", playedAt: daysAgo(2), isFollowing: true },
  { player: PLAYERS[2], duration: "1h 30m", playedAt: daysAgo(5), isFollowing: true },
  { player: PLAYERS[3], duration: "4h 10m", playedAt: daysAgo(7), isFollowing: true },
];

export const MOCK_OTHERS_ON_JOURNEY: JourneyPlayer[] = [
  {
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    duration: "3h 02m",
    playedAt: daysAgo(1),
    isFollowing: false,
  },
  {
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    duration: "55m",
    playedAt: daysAgo(3),
    isFollowing: false,
  },
  {
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    duration: "6h 18m",
    playedAt: daysAgo(4),
    isFollowing: false,
  },
  {
    player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
    duration: "2h 11m",
    playedAt: daysAgo(7),
    isFollowing: false,
  },
];

export const MY_PLAYER_ID = "p1"; // Maria Chen is "me" in the mockup
export const MY_PLAYER = PLAYERS.find((p) => p.id === MY_PLAYER_ID)!;

const _OTHER_PLAYERS: Player[] = [
  { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
  { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
  { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
  { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
];

export const MY_FOLLOWING: Player[] = MOCK_FRIENDS_ON_JOURNEY.map((jp) => jp.player);
export const MY_FOLLOWERS: Player[] = [
  PLAYERS[1],
  PLAYERS[2],
  _OTHER_PLAYERS[0],
  _OTHER_PLAYERS[1],
  _OTHER_PLAYERS[2],
];

export const MOCK_FOLLOW_LISTS: Record<string, { followers: Player[]; following: Player[] }> = {
  p2: {
    followers: [MY_PLAYER, PLAYERS[2], _OTHER_PLAYERS[0], _OTHER_PLAYERS[3]],
    following: [MY_PLAYER, PLAYERS[3], _OTHER_PLAYERS[1], _OTHER_PLAYERS[2]],
  },
  p3: {
    followers: [MY_PLAYER, PLAYERS[1], _OTHER_PLAYERS[0], _OTHER_PLAYERS[1], _OTHER_PLAYERS[2]],
    following: [MY_PLAYER, PLAYERS[0], _OTHER_PLAYERS[3]],
  },
  p4: {
    followers: [_OTHER_PLAYERS[0], _OTHER_PLAYERS[2]],
    following: [MY_PLAYER, PLAYERS[1], PLAYERS[2], _OTHER_PLAYERS[0], _OTHER_PLAYERS[1]],
  },
};

export function avatarSrc(player: Player): string {
  return player.avatarUrl ?? `https://i.pravatar.cc/64?u=${encodeURIComponent(player.id)}`;
}

const GAME_COVER_URLS: Record<string, string> = {
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

export function gameCoverSrc(game: string): string | undefined {
  return GAME_COVER_URLS[game];
}

export function playerHref(player: Player): string {
  return player.id === MY_PLAYER_ID ? "/hero" : `/player/${player.handle}`;
}

export type MockPendingSession = {
  id: string;
  game: string;
  coverColor: string;
  coverAccent: string;
  genres: string[];
  duration: string;
  endedAt: Date;
  exeName?: string;
  windowTitle?: string;
};

export type MockGameResult = {
  id: string;
  game: string;
  coverColor: string;
  coverAccent: string;
  genres: string[];
};

export const GAME_LIBRARY: MockGameResult[] = [
  { id: "g1", game: "Elden Ring", coverColor: "#3d2b1f", coverAccent: "#c9a84c", genres: ["RPG", "Soulslike", "Open World"] },
  { id: "g2", game: "Baldur's Gate 3", coverColor: "#1a1f3e", coverAccent: "#818cf8", genres: ["RPG", "Strategy", "Co-op"] },
  { id: "g3", game: "Hollow Knight", coverColor: "#1c1c2e", coverAccent: "#94a3b8", genres: ["Metroidvania", "Action", "Indie"] },
  { id: "g4", game: "Cyberpunk 2077", coverColor: "#0a0a12", coverAccent: "#eab308", genres: ["RPG", "Open World", "Sci-fi"] },
  { id: "g5", game: "Hades II", coverColor: "#2d0a0a", coverAccent: "#f97316", genres: ["Roguelite", "Action", "Indie"] },
  { id: "g6", game: "Dead Cells", coverColor: "#0f2a1e", coverAccent: "#22c55e", genres: ["Roguelike", "Action", "Platformer"] },
  { id: "g7", game: "Dark Souls III", coverColor: "#1a1a1a", coverAccent: "#d4af37", genres: ["RPG", "Soulslike", "Action"] },
  { id: "g8", game: "Sekiro", coverColor: "#1a0a0a", coverAccent: "#dc2626", genres: ["Action", "Soulslike"] },
  { id: "g9", game: "Celeste", coverColor: "#0d0d2b", coverAccent: "#60a5fa", genres: ["Platformer", "Indie"] },
  { id: "g10", game: "Disco Elysium", coverColor: "#1e1b2e", coverAccent: "#a78bfa", genres: ["RPG", "Adventure", "Narrative"] },
  { id: "g11", game: "Persona 5 Royal", coverColor: "#1a0000", coverAccent: "#ef4444", genres: ["RPG", "JRPG", "Turn-based"] },
  { id: "g12", game: "Monster Hunter: World", coverColor: "#0f1e0f", coverAccent: "#84cc16", genres: ["Action", "RPG", "Co-op"] },
];

export const MOCK_PENDING_SESSIONS: MockPendingSession[] = [
  {
    id: "ps1",
    game: "Cyberpunk 2077",
    coverColor: "#0a0a12",
    coverAccent: "#eab308",
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "1h 52m",
    endedAt: new Date(),
    exeName: "cyberpunk2077.exe",
    windowTitle: "Cyberpunk 2077",
  },
  {
    id: "ps2",
    game: "Dead Cells",
    coverColor: "#0f2a1e",
    coverAccent: "#22c55e",
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 18m",
    endedAt: hoursAgo(2),
    exeName: "deadcells.exe",
    windowTitle: "Dead Cells",
  },
  {
    id: "ps3",
    game: "",
    coverColor: "#1a1a1a",
    coverAccent: "#6b7280",
    genres: [],
    duration: "34m",
    endedAt: hoursAgo(5),
    exeName: "svb.exe",
    windowTitle: "SVB!",
  },
];

export type EchoKind = "comment" | "follower";

export type MockEcho = {
  id: string;
  kind: EchoKind;
  player: Player;
  occurredAt: Date;
  read: boolean;
  sessionId?: string;
  game?: string;
  commentPreview?: string;
};

export const MOCK_ECHOES: MockEcho[] = [
  {
    id: "e1",
    kind: "comment",
    player: PLAYERS[1],
    occurredAt: minsAgo(18),
    read: false,
    sessionId: "s1",
    game: "Elden Ring",
    commentPreview: "40 attempts is wild, respect. I gave up at 20.",
  },
  {
    id: "e2",
    kind: "follower",
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    occurredAt: minsAgo(45),
    read: false,
  },
  {
    id: "e3",
    kind: "comment",
    player: PLAYERS[2],
    occurredAt: hoursAgo(1),
    read: false,
    sessionId: "s1",
    game: "Elden Ring",
    commentPreview: "Which build were you running? I keep dying in phase 2.",
  },
  {
    id: "e4",
    kind: "follower",
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    occurredAt: hoursAgo(3),
    read: true,
  },
  {
    id: "e5",
    kind: "comment",
    player: PLAYERS[3],
    occurredAt: hoursAgo(5),
    read: true,
    sessionId: "s5",
    game: "Hades II",
    commentPreview: "New build is insane — Aspect of Melinoë with the moon staff.",
  },
  {
    id: "e6",
    kind: "follower",
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    occurredAt: daysAgo(1),
    read: true,
  },
  {
    id: "e7",
    kind: "comment",
    player: PLAYERS[1],
    occurredAt: daysAgo(2),
    read: true,
    sessionId: "s7",
    game: "Elden Ring",
    commentPreview: "Started a fresh Arcane build. Let's see how this goes.",
  },
];

export type MockJourneyEntry = {
  sessionId: string;
  player: Player;
  duration: string;
  playedAt: Date;
  log?: string;
};

export type MockGameActivity = {
  id: string;
  game: string;
  coverColor: string;
  coverAccent: string;
  genres: string[];
  entries: MockJourneyEntry[];
};

export const MOCK_GAME_ACTIVITY: MockGameActivity[] = [
  {
    id: "ga1",
    game: "Elden Ring",
    coverColor: "#3d2b1f",
    coverAccent: "#c9a84c",
    genres: ["RPG", "Soulslike", "Open World"],
    entries: [
      { sessionId: "s1", player: PLAYERS[0], duration: "3h 14m", playedAt: minsAgo(23), log: "Finally took down Malenia after 40 attempts. The muscle memory just clicked." },
      { sessionId: "s8", player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" }, duration: "3h 02m", playedAt: daysAgo(1) },
      { sessionId: "s7", player: PLAYERS[2], duration: "2h 44m", playedAt: daysAgo(2), log: "Started a fresh Arcane build. Let's see how this goes." },
    ],
  },
  {
    id: "ga2",
    game: "Cyberpunk 2077",
    coverColor: "#0a0a12",
    coverAccent: "#eab308",
    genres: ["RPG", "Open World", "Sci-fi"],
    entries: [
      { sessionId: "s4", player: PLAYERS[3], duration: "1h 52m", playedAt: new Date() },
      { sessionId: "s9", player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" }, duration: "55m", playedAt: daysAgo(3) },
    ],
  },
  {
    id: "ga3",
    game: "Hollow Knight",
    coverColor: "#1c1c2e",
    coverAccent: "#94a3b8",
    genres: ["Metroidvania", "Action", "Indie"],
    entries: [
      { sessionId: "s3", player: PLAYERS[2], duration: "2h 07m", playedAt: hoursAgo(3), log: "The Abyss section hit different today. Incredible atmosphere." },
      { sessionId: "s10", player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" }, duration: "2h 11m", playedAt: daysAgo(7) },
    ],
  },
  {
    id: "ga4",
    game: "Hades II",
    coverColor: "#2d0a0a",
    coverAccent: "#f97316",
    genres: ["Roguelite", "Action", "Indie"],
    entries: [
      { sessionId: "s5", player: PLAYERS[0], duration: "45m", playedAt: daysAgo(1), log: "New build is insane — Aspect of Melinoë with the moon staff." },
      { sessionId: "s11", player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" }, duration: "6h 18m", playedAt: daysAgo(3) },
    ],
  },
  {
    id: "ga5",
    game: "Baldur's Gate 3",
    coverColor: "#1a1f3e",
    coverAccent: "#818cf8",
    genres: ["RPG", "Strategy", "Co-op"],
    entries: [
      { sessionId: "s2", player: PLAYERS[1], duration: "4h 30m", playedAt: hoursAgo(1) },
    ],
  },
  {
    id: "ga6",
    game: "Dead Cells",
    coverColor: "#0f2a1e",
    coverAccent: "#22c55e",
    genres: ["Roguelike", "Action", "Platformer"],
    entries: [
      { sessionId: "s6", player: PLAYERS[1], duration: "1h 18m", playedAt: daysAgo(2) },
      { sessionId: "s12", player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" }, duration: "1h 10m", playedAt: daysAgo(5) },
    ],
  },
];

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
