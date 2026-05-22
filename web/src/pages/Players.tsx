// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Clock, Search } from "lucide-react";
import { MOCK_GAME_ACTIVITY, avatarSrc, playerHref, type MockGameActivity, type MockJourneyEntry } from "@/lib/mock";

function GameCover({ coverColor, coverAccent, game }: { coverColor: string; coverAccent: string; game: string }) {
  return (
    <div
      className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md"
      style={{ backgroundColor: coverColor }}
    >
      <span
        className="absolute inset-0 flex items-center justify-center text-2xl font-bold"
        style={{ color: coverAccent }}
      >
        {game[0]}
      </span>
    </div>
  );
}

function JourneyRow({ entry }: { entry: MockJourneyEntry }) {
  const navigate = useNavigate();
  return (
    <div
      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/5"
      onClick={() => navigate(`/journey/${entry.sessionId}`)}
    >
      <Link
        to={playerHref(entry.player)}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-3 min-w-0"
      >
        <img
          src={avatarSrc(entry.player)}
          alt={entry.player.name}
          className="h-7 w-7 shrink-0 rounded-full object-cover"
        />
        <p className="text-sm font-medium leading-tight">{entry.player.name}</p>
      </Link>
      {entry.log && (
        <p className="min-w-0 flex-1 truncate text-xs italic text-muted-foreground">
          &ldquo;{entry.log}&rdquo;
        </p>
      )}
      {!entry.log && <div className="flex-1" />}
      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Clock size={11} />
        <span>{entry.duration}</span>
        <span className="ml-1.5">{entry.timestamp}</span>
      </div>
    </div>
  );
}

function GameCard({ activity }: { activity: MockGameActivity }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <GameCover
          coverColor={activity.coverColor}
          coverAccent={activity.coverAccent}
          game={activity.game}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{activity.game}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {activity.genres.map((g) => (
              <span
                key={g}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {activity.entries.length} {activity.entries.length === 1 ? "journey" : "journeys"}
        </span>
      </div>
      <div className="divide-y divide-border border-t border-border">
        {activity.entries.map((entry) => (
          <JourneyRow key={entry.sessionId} entry={entry} />
        ))}
      </div>
    </div>
  );
}

const ALL_GENRES = Array.from(
  new Set(MOCK_GAME_ACTIVITY.flatMap((g) => g.genres)),
).sort();

export default function Players() {
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  const q = search.toLowerCase().trim();
  const visible = MOCK_GAME_ACTIVITY.filter((g) => {
    if (activeGenre && !g.genres.includes(activeGenre)) return false;
    if (q) {
      const matchesGame = g.game.toLowerCase().includes(q);
      const matchesGenre = g.genres.some((genre) => genre.toLowerCase().includes(q));
      if (!matchesGame && !matchesGenre) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Players</h1>

      {/* Search */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by game or genre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Genre chips */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveGenre(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeGenre === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          All
        </button>
        {ALL_GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => setActiveGenre(activeGenre === genre ? null : genre)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeGenre === genre
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Game activity cards */}
      <div className="flex flex-col gap-3">
        {visible.length > 0 ? (
          visible.map((activity) => <GameCard key={activity.id} activity={activity} />)
        ) : (
          <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
            No games match your search.
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}
