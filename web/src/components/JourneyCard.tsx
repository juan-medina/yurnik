// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link, useNavigate } from "react-router";
import { Clock, Heart } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toggleLike } from "@/services/journeys";
import { getCurrentPlayer, MY_PLAYER_ID } from "@/services/auth";
import { avatarSrc, playerHref } from "@/lib/display";
import { formatJourneyDate } from "@/lib/time";
import type { Journey } from "@/models";

interface JourneyCardProps {
  journey: Journey;
  queryKey: unknown[];
  showPlayer?: boolean;
}

export default function JourneyCard({ journey, queryKey, showPlayer = false }: JourneyCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentPlayer } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });
  const isOwn = currentPlayer?.id === journey.player.id;

  const likeMutation = useMutation({
    mutationFn: toggleLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const likeCount = journey.likes + (journey.liked ? 1 : 0);

  return (
    <article
      className="flex cursor-pointer gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
      onClick={() => navigate(`/journey/${journey.id}`)}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-800">
        {journey.coverUrl
          ? <img src={journey.coverUrl} alt={journey.game} className="absolute inset-0 h-full w-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-300">{journey.game[0]}</span>
        }
      </div>

      <div className="min-w-0 flex-1">
        {showPlayer && (
          <div className="mb-1.5 flex items-center gap-2">
            <Link
              to={playerHref(journey.player, MY_PLAYER_ID)}
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
          <span className="font-bold">{journey.game}</span>
          <div className="flex flex-wrap gap-1">
            {journey.genres.map((g) => (
              <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {g}
              </span>
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
          <p className="mb-2 text-sm italic text-muted-foreground">&ldquo;{journey.log}&rdquo;</p>
        )}

        {isOwn ? (
          <div className="flex items-center gap-1.5">
            <Heart size={15} className="text-muted-foreground/40" />
            {likeCount > 0 && (
              <span className="text-xs text-muted-foreground">{likeCount}</span>
            )}
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); likeMutation.mutate(journey.id); }}
            className="flex items-center gap-1.5 transition-colors"
            aria-label={journey.liked ? "Unlike" : "Like"}
          >
            <Heart
              size={15}
              className={journey.liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground hover:text-rose-400"}
            />
            {likeCount > 0 && (
              <span className={`text-xs ${journey.liked ? "text-rose-500" : "text-muted-foreground"}`}>
                {likeCount}
              </span>
            )}
          </button>
        )}
      </div>
    </article>
  );
}
