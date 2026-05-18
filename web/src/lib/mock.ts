// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

export type Player = {
  id: string;
  name: string;
  handle: string;
  color: string;
};

export type MockSession = {
  id: string;
  player: Player;
  game: string;
  coverColor: string;
  coverAccent: string;
  genres: string[];
  duration: string;
  timestamp: string;
  log?: string;
  likes: number;
};

export type MockComment = {
  id: string;
  player: Player;
  text: string;
  timestamp: string;
};

export type JourneyPlayer = {
  player: Player;
  duration: string;
  timestamp: string;
  isFollowing: boolean;
};

export const PLAYERS: Player[] = [
  { id: "p1", name: "Maria Chen", handle: "maria.bsky.social", color: "#7c3aed" },
  { id: "p2", name: "Alex Torres", handle: "alextorres.bsky.social", color: "#059669" },
  { id: "p3", name: "Sam Okafor", handle: "samokafor.bsky.social", color: "#d97706" },
  { id: "p4", name: "Rin Nakamura", handle: "rin.bsky.social", color: "#e11d48" },
];

export const SESSIONS: MockSession[] = [
  {
    id: "s1",
    player: PLAYERS[0],
    game: "Elden Ring",
    coverColor: "#3d2b1f",
    coverAccent: "#c9a84c",
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "3h 14m",
    timestamp: "23m ago",
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
    timestamp: "1h ago",
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
    timestamp: "3h ago",
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
    timestamp: "just now",
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
    timestamp: "yesterday",
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
    timestamp: "2d ago",
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
    timestamp: "2d ago",
    log: "Started a fresh Arcane build. Let's see how this goes.",
    likes: 31,
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
    timestamp: "18m ago",
  },
  {
    id: "c2",
    player: PLAYERS[2],
    text: "Which build were you running? I keep dying in phase 2.",
    timestamp: "15m ago",
  },
  {
    id: "c3",
    player: PLAYERS[0],
    text: "Bleed build, Rivers of Blood. Phase 2 just takes patience — stop panic rolling.",
    timestamp: "12m ago",
  },
  {
    id: "c4",
    player: PLAYERS[3],
    text: "She's the hardest optional boss in the game. Congrats fr",
    timestamp: "5m ago",
  },
];

export const MOCK_FRIENDS_ON_JOURNEY: JourneyPlayer[] = [
  { player: PLAYERS[1], duration: "2h 44m", timestamp: "2d ago", isFollowing: true },
  { player: PLAYERS[2], duration: "1h 30m", timestamp: "5d ago", isFollowing: true },
  { player: PLAYERS[3], duration: "4h 10m", timestamp: "1w ago", isFollowing: true },
];

export const MOCK_OTHERS_ON_JOURNEY: JourneyPlayer[] = [
  {
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    duration: "3h 02m",
    timestamp: "1d ago",
    isFollowing: false,
  },
  {
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    duration: "55m",
    timestamp: "3d ago",
    isFollowing: false,
  },
  {
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    duration: "6h 18m",
    timestamp: "4d ago",
    isFollowing: false,
  },
  {
    player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
    duration: "2h 11m",
    timestamp: "1w ago",
    isFollowing: false,
  },
];

export const MY_PLAYER_ID = "p1"; // Maria Chen is "me" in the mockup

export type MockPendingSession = {
  id: string;
  game: string;
  coverColor: string;
  coverAccent: string;
  genres: string[];
  duration: string;
  timestamp: string;
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
    timestamp: "just now",
  },
  {
    id: "ps2",
    game: "Dead Cells",
    coverColor: "#0f2a1e",
    coverAccent: "#22c55e",
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 18m",
    timestamp: "2h ago",
  },
];

export type EchoKind = "comment" | "follower";

export type MockEcho = {
  id: string;
  kind: EchoKind;
  player: Player;
  timestamp: string;
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
    timestamp: "18m ago",
    read: false,
    sessionId: "s1",
    game: "Elden Ring",
    commentPreview: "40 attempts is wild, respect. I gave up at 20.",
  },
  {
    id: "e2",
    kind: "follower",
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    timestamp: "45m ago",
    read: false,
  },
  {
    id: "e3",
    kind: "comment",
    player: PLAYERS[2],
    timestamp: "1h ago",
    read: false,
    sessionId: "s1",
    game: "Elden Ring",
    commentPreview: "Which build were you running? I keep dying in phase 2.",
  },
  {
    id: "e4",
    kind: "follower",
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    timestamp: "3h ago",
    read: true,
  },
  {
    id: "e5",
    kind: "comment",
    player: PLAYERS[3],
    timestamp: "5h ago",
    read: true,
    sessionId: "s5",
    game: "Hades II",
    commentPreview: "New build is insane — Aspect of Melinoë with the moon staff.",
  },
  {
    id: "e6",
    kind: "follower",
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    timestamp: "yesterday",
    read: true,
  },
  {
    id: "e7",
    kind: "comment",
    player: PLAYERS[1],
    timestamp: "2d ago",
    read: true,
    sessionId: "s7",
    game: "Elden Ring",
    commentPreview: "Started a fresh Arcane build. Let's see how this goes.",
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
