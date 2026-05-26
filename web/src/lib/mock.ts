// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Player } from "@/models/player";
import type { Session, PendingSession } from "@/models/session";
import type { Echo } from "@/models/echo";
import type { Game, GameActivity, Comment, JourneyPlayer } from "@/models/game";
import type { Exclusion, GameHint } from "@/models/settings";

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

export const SESSIONS: Session[] = [
  {
    id: "s1", player: PLAYERS[0], game: "Elden Ring",
    coverUrl: coverUrl("Elden Ring"),
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "3h 14m", playedAt: minsAgo(23),
    log: "Finally took down Malenia after 40 attempts. The muscle memory just clicked.",
    likes: 47, liked: false,
  },
  {
    id: "s2", player: PLAYERS[1], game: "Baldur's Gate 3",
    coverUrl: coverUrl("Baldur's Gate 3"),
    genres: ["RPG", "Strategy", "Co-op"],
    duration: "4h 30m", playedAt: hoursAgo(1),
    likes: 12, liked: false,
  },
  {
    id: "s3", player: PLAYERS[2], game: "Hollow Knight",
    coverUrl: coverUrl("Hollow Knight"),
    genres: ["Metroidvania", "Action", "Indie"],
    duration: "2h 07m", playedAt: hoursAgo(3),
    log: "The Abyss section hit different today. Incredible atmosphere.",
    likes: 8, liked: false,
  },
  {
    id: "s4", player: PLAYERS[3], game: "Cyberpunk 2077",
    coverUrl: coverUrl("Cyberpunk 2077"),
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "1h 52m", playedAt: new Date(),
    likes: 0, liked: false,
  },
  {
    id: "s5", player: PLAYERS[0], game: "Hades II",
    coverUrl: coverUrl("Hades II"),
    genres: ["Roguelite", "Action", "Indie"],
    duration: "45m", playedAt: daysAgo(1),
    log: "New build is insane — Aspect of Melinoë with the moon staff.",
    likes: 23, liked: false,
  },
  {
    id: "s6", player: PLAYERS[1], game: "Dead Cells",
    coverUrl: coverUrl("Dead Cells"),
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 18m", playedAt: daysAgo(2),
    likes: 5, liked: false,
  },
  {
    id: "s7", player: PLAYERS[2], game: "Elden Ring",
    coverUrl: coverUrl("Elden Ring"),
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "2h 44m", playedAt: daysAgo(2),
    log: "Started a fresh Arcane build. Let's see how this goes.",
    likes: 31, liked: false,
  },
  {
    id: "s8",
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    game: "Elden Ring", coverUrl: coverUrl("Elden Ring"),
    genres: ["RPG", "Soulslike", "Open World"],
    duration: "3h 02m", playedAt: daysAgo(1),
    likes: 4, liked: false,
  },
  {
    id: "s9",
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    game: "Cyberpunk 2077", coverUrl: coverUrl("Cyberpunk 2077"),
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "55m", playedAt: daysAgo(3),
    likes: 2, liked: false,
  },
  {
    id: "s10",
    player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
    game: "Hollow Knight", coverUrl: coverUrl("Hollow Knight"),
    genres: ["Metroidvania", "Action", "Indie"],
    duration: "2h 11m", playedAt: daysAgo(7),
    likes: 7, liked: false,
  },
  {
    id: "s11",
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    game: "Hades II", coverUrl: coverUrl("Hades II"),
    genres: ["Roguelite", "Action", "Indie"],
    duration: "6h 18m", playedAt: daysAgo(3),
    likes: 15, liked: false,
  },
  {
    id: "s12",
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    game: "Dead Cells", coverUrl: coverUrl("Dead Cells"),
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 10m", playedAt: daysAgo(5),
    likes: 1, liked: false,
  },
];

export const MOCK_LIKERS: Player[] = [
  { id: "l1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
  { id: "l2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
  { id: "l3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
  { id: "l4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
  { id: "l5", name: "Alex Torres", handle: "alextorres.bsky.social", color: "#059669" },
];

export const MOCK_COMMENTS: Comment[] = [
  {
    id: "c1", player: PLAYERS[1],
    text: "40 attempts is wild, respect. I gave up at 20.",
    commentedAt: minsAgo(18),
  },
  {
    id: "c2", player: PLAYERS[2],
    text: "Which build were you running? I keep dying in phase 2.",
    commentedAt: minsAgo(15),
  },
  {
    id: "c3", player: PLAYERS[0],
    text: "Bleed build, Rivers of Blood. Phase 2 just takes patience — stop panic rolling.",
    commentedAt: minsAgo(12),
  },
  {
    id: "c4", player: PLAYERS[3],
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
    duration: "3h 02m", playedAt: daysAgo(1), isFollowing: false,
  },
  {
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    duration: "55m", playedAt: daysAgo(3), isFollowing: false,
  },
  {
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    duration: "6h 18m", playedAt: daysAgo(4), isFollowing: false,
  },
  {
    player: { id: "o4", name: "Fen Wu", handle: "fenwu.bsky.social", color: "#db2777" },
    duration: "2h 11m", playedAt: daysAgo(7), isFollowing: false,
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

export const MOCK_PENDING_SESSIONS: PendingSession[] = [
  {
    id: "ps1", game: "Cyberpunk 2077",
    coverUrl: coverUrl("Cyberpunk 2077"),
    genres: ["RPG", "Open World", "Sci-fi"],
    duration: "1h 52m", endedAt: new Date(),
    exeName: "cyberpunk2077.exe", windowTitle: "Cyberpunk 2077",
  },
  {
    id: "ps2", game: "Dead Cells",
    coverUrl: coverUrl("Dead Cells"),
    genres: ["Roguelike", "Action", "Platformer"],
    duration: "1h 18m", endedAt: hoursAgo(2),
    exeName: "deadcells.exe", windowTitle: "Dead Cells",
  },
  {
    id: "ps3", game: "",
    genres: [], duration: "34m", endedAt: hoursAgo(5),
    exeName: "svb.exe", windowTitle: "SVB!",
  },
];

export const MOCK_ECHOES: Echo[] = [
  {
    id: "e1", kind: "comment", player: PLAYERS[1],
    occurredAt: minsAgo(18), read: false,
    sessionId: "s1", game: "Elden Ring",
    commentPreview: "40 attempts is wild, respect. I gave up at 20.",
  },
  {
    id: "e2", kind: "follower",
    player: { id: "o1", name: "Jordan Park", handle: "jordanp.bsky.social", color: "#0284c7" },
    occurredAt: minsAgo(45), read: false,
  },
  {
    id: "e3", kind: "comment", player: PLAYERS[2],
    occurredAt: hoursAgo(1), read: false,
    sessionId: "s1", game: "Elden Ring",
    commentPreview: "Which build were you running? I keep dying in phase 2.",
  },
  {
    id: "e4", kind: "follower",
    player: { id: "o2", name: "Priya Nair", handle: "priyanair.bsky.social", color: "#7c3aed" },
    occurredAt: hoursAgo(3), read: true,
  },
  {
    id: "e5", kind: "comment", player: PLAYERS[3],
    occurredAt: hoursAgo(5), read: true,
    sessionId: "s5", game: "Hades II",
    commentPreview: "New build is insane — Aspect of Melinoë with the moon staff.",
  },
  {
    id: "e6", kind: "follower",
    player: { id: "o3", name: "Luca Rossi", handle: "lucarossi.bsky.social", color: "#059669" },
    occurredAt: daysAgo(1), read: true,
  },
  {
    id: "e7", kind: "comment", player: PLAYERS[1],
    occurredAt: daysAgo(2), read: true,
    sessionId: "s7", game: "Elden Ring",
    commentPreview: "Started a fresh Arcane build. Let's see how this goes.",
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

export const MOCK_EXCLUSIONS: Exclusion[] = [
  { exeName: "cyberpunk2077.exe" },
  { exeName: "svb.exe" },
  { exeName: "launcher.exe" },
];

export const MOCK_GAME_HINTS: GameHint[] = [
  { exeName: "eldenring.exe", game: "Elden Ring" },
  { exeName: "bg3.exe", game: "Baldur's Gate 3" },
  { exeName: "hollowknight.exe", game: "Hollow Knight" },
];
