// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Clock, Info, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getGameActivity } from "@/services/games";
import { avatarSrc, playerHref } from "@/lib/display";
import { MY_PLAYER_ID } from "@/services/auth";
import { cn } from "@/lib/utils";
import { genreColor } from "@/lib/genres";
import GenreChip from "@/components/GenreChip";
import { formatJourneyDate } from "@/lib/time";
import type { GameActivity, JourneyEntry } from "@/models";

function GameCover({ id, game, coverUrl }: { id: string; game: string; coverUrl?: string }) {
  return (
    <Link
      to={`/game/${id}`}
      className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md bg-slate-800 transition-opacity hover:opacity-80"
    >
      {coverUrl
        ? <img src={coverUrl} alt={game} className="absolute inset-0 h-full w-full object-cover" />
        : <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-300">{game[0]}</span>
      }
    </Link>
  );
}

function JourneyRow({ entry }: { entry: JourneyEntry }) {
  const navigate = useNavigate();
  return (
    <div
      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/5"
      onClick={() => navigate(`/journey/${entry.sessionId}`)}
    >
      <Link
        to={playerHref(entry.player, MY_PLAYER_ID)}
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
        <span className="ml-1.5">{formatJourneyDate(entry.playedAt)}</span>
      </div>
    </div>
  );
}

function GameCard({ activity }: { activity: GameActivity }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <GameCover id={activity.id} game={activity.game} coverUrl={activity.coverUrl} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            <Link
              to={`/game/${activity.id}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              {activity.game}
              <Info size={13} className="shrink-0 text-muted-foreground" />
            </Link>
            {activity.releaseYear && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">({activity.releaseYear})</span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {activity.genres.map((g) => (
              <GenreChip key={g} genre={g} />
            ))}
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("players_journey_count", { count: activity.entries.length })}
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

export default function Players() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  const { data: activities = [] } = useQuery({ queryKey: ["game-activity"], queryFn: getGameActivity });

  const allGenres = useMemo(
    () => Array.from(new Set(activities.flatMap((g) => g.genres))).sort(),
    [activities],
  );

  const q = search.toLowerCase().trim();
  const visible = activities.filter((g) => {
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
      <h1 className="mb-4 text-2xl font-bold">{t("players_title")}</h1>

      {/* Search */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <input
          type="text"
          placeholder={t("players_search_placeholder")}
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
          {t("players_all")}
        </button>
        {allGenres.map((genre) => (
          <button
            key={genre}
            onClick={() => setActiveGenre(activeGenre === genre ? null : genre)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-opacity",
              activeGenre === genre
                ? "bg-primary text-primary-foreground"
                : cn(genreColor(genre), "hover:opacity-80"),
            )}
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
            {t("players_no_results")}
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}
