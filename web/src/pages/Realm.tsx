// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link, useNavigate } from "react-router";
import { Clock, Heart } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFeedSessions } from "@/services/feed";
import { toggleLike } from "@/services/sessions";
import { avatarSrc, playerHref } from "@/lib/display";
import { MY_PLAYER_ID } from "@/services/auth";
import { formatSessionDate } from "@/lib/time";
import type { Session } from "@/models";

function SessionCard({ session }: { session: Session }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: toggleLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });

  return (
    <article
      className="flex cursor-pointer gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
      onClick={() => navigate(`/journey/${session.id}`)}
    >
      <div
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md"
        style={{ backgroundColor: session.coverColor }}
      >
        {session.coverUrl
          ? <img src={session.coverUrl} alt={session.game} className="absolute inset-0 h-full w-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold" style={{ color: session.coverAccent }}>{session.game[0]}</span>
        }
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <Link
            to={playerHref(session.player, MY_PLAYER_ID)}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2"
          >
            <img
              src={avatarSrc(session.player)}
              alt={session.player.name}
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
            <span className="text-sm font-semibold leading-none">{session.player.name}</span>
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            @{session.player.handle}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {formatSessionDate(session.playedAt)}
          </span>
        </div>

        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-bold">{session.game}</span>
          <div className="flex flex-wrap gap-1">
            {session.genres.map((g) => (
              <span
                key={g}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} />
          <span>{session.duration}</span>
        </div>

        {session.log && (
          <p className="mb-2 text-sm italic text-muted-foreground">&ldquo;{session.log}&rdquo;</p>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); likeMutation.mutate(session.id); }}
          className="flex items-center gap-1.5 transition-colors"
          aria-label={session.liked ? "Unlike" : "Like"}
        >
          <Heart
            size={15}
            className={
              session.liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground hover:text-rose-400"
            }
          />
          {(session.likes + (session.liked ? 1 : 0)) > 0 && (
            <span className={`text-xs ${session.liked ? "text-rose-500" : "text-muted-foreground"}`}>
              {session.likes + (session.liked ? 1 : 0)}
            </span>
          )}
        </button>
      </div>
    </article>
  );
}

export default function Realm() {
  const { data: sessions = [] } = useQuery({ queryKey: ["feed"], queryFn: getFeedSessions });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-3">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
