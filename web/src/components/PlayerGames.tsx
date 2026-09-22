// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPlayerGames } from "@/services/players";
import { genreColor } from "@/lib/genres";
import { cn } from "@/lib/utils";
import type { ProfileGame } from "@/models/player";

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface PlayerGamesProps {
  playerHandle: string;
  genres: string[];
}

export default function PlayerGames({ playerHandle, genres }: PlayerGamesProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState("");

  const [games, setGames] = useState<ProfileGame[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["player-games", playerHandle, debouncedSearch, activeGenre],
    queryFn: () => getPlayerGames(playerHandle, 20, undefined, debouncedSearch, activeGenre),
  });

  useEffect(() => {
    if (data) {
      setGames(data.games);
      setNextCursor(data.nextCursor);
    }
  }, [data]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getPlayerGames(playerHandle, 20, nextCursor, debouncedSearch, activeGenre);
      setGames((prev) => [...prev, ...page.games]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder={t("explore_search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-card py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveGenre("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeGenre === ""
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {t("explore_all")}
          </button>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre((prev) => (prev === g ? "" : g))}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-opacity",
                activeGenre === g
                  ? "bg-primary text-primary-foreground"
                  : cn(genreColor(g), "hover:opacity-80"),
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{t("loading")}</div>
      ) : games.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          {t("profile_games_empty")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
            {games.map((g: ProfileGame) => (
              <Link key={g.igdbId} to={`/game/${g.igdbId}`} className="group block">
                <div className="relative mb-2 aspect-[3/4] w-full">
                  {g.coverUrl ? (
                    <img
                      src={g.coverUrl}
                      alt={g.name}
                      className="h-full w-full rounded-md object-cover transition-opacity group-hover:opacity-80"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-md bg-muted transition-opacity group-hover:opacity-80">
                      <span className="px-1 text-center text-xs text-muted-foreground">{g.name}</span>
                    </div>
                  )}
                  {g.secondsPlayed > 0 && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {formatSeconds(g.secondsPlayed)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs font-medium group-hover:underline" title={g.name}>
                  {g.name}
                </p>
                {g.releaseYear && (
                  <p className="text-[10px] text-muted-foreground">{g.releaseYear}</p>
                )}
              </Link>
            ))}
          </div>
          {nextCursor && (
            <div className="mt-6 flex justify-center border-t border-border pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border border-border bg-card px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {loadingMore ? t("loading") : t("load_more")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
