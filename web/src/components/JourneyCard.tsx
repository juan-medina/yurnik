// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link, useNavigate } from "react-router";
import { Clock, Info } from "lucide-react";
import { avatarSrc, playerHref } from "@/lib/display";
import { formatJourneyDate } from "@/lib/time";
import type { Journey } from "@/models";
import GenreChip from "@/components/GenreChip";

interface JourneyCardProps {
  journey: Journey;
  showPlayer?: boolean;
}

export default function JourneyCard({ journey, showPlayer = false }: JourneyCardProps) {
  const navigate = useNavigate();

  return (
    <article
      className="flex cursor-pointer gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
      onClick={() => navigate(`/journey/${journey.id}`)}
    >
      <Link
        to={`/game/${journey.igdbId}`}
        onClick={(e) => e.stopPropagation()}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-800 transition-opacity hover:opacity-80"
      >
        {journey.coverUrl
          ? <img src={journey.coverUrl} alt={journey.game} className="absolute inset-0 h-full w-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-300">{journey.game[0]}</span>
        }
      </Link>

      <div className="min-w-0 flex-1">
        {showPlayer && (
          <div className="mb-1.5 flex items-center gap-2">
            <Link
              to={playerHref(journey.player)}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2"
            >
              <img
                src={avatarSrc(journey.player)}
                alt={journey.player.name}
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
              <span className="text-sm font-semibold leading-none">{journey.player.name}</span>
            </Link>
            <span className="truncate text-xs text-muted-foreground">@{journey.player.handle}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatJourneyDate(journey.playedAt)}
            </span>
          </div>
        )}

        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link
            to={`/game/${journey.igdbId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-bold hover:underline"
          >
            {journey.game}
            <Info size={13} className="shrink-0 text-muted-foreground" />
          </Link>
          {journey.releaseYear && (
            <span className="text-xs text-muted-foreground">({journey.releaseYear})</span>
          )}
          <div className="flex flex-wrap gap-1">
            {journey.genres.map((g) => (
              <GenreChip key={g} genre={g} />
            ))}
          </div>
          {!showPlayer && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatJourneyDate(journey.playedAt)}
            </span>
          )}
        </div>

        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} />
          <span>{journey.duration}</span>
        </div>

        {journey.log && (
          <p className="mb-2 break-words whitespace-pre-wrap text-sm italic text-muted-foreground">&ldquo;{journey.log}&rdquo;</p>
        )}
      </div>
    </article>
  );
}
