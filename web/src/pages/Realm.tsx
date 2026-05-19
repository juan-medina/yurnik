// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Clock, Heart } from "lucide-react";
import { type MockSession, SESSIONS, initials } from "@/lib/mock";

type SessionCardProps = { session: MockSession };

function SessionCard({ session }: SessionCardProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const likeCount = session.likes + (liked ? 1 : 0);

  function toggleLike(e: React.MouseEvent) {
    e.stopPropagation();
    setLiked((prev) => !prev);
  }

  return (
    <article
      className="flex cursor-pointer gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
      onClick={() => navigate(`/journey/${session.id}`)}
    >
      <div
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md"
        style={{ backgroundColor: session.coverColor }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center text-2xl font-bold"
          style={{ color: session.coverAccent }}
        >
          {session.game[0]}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <Link
            to={`/player/${session.player.handle}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2"
          >
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: session.player.color }}
            >
              {initials(session.player.name)}
            </div>
            <span className="text-sm font-semibold leading-none">{session.player.name}</span>
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            @{session.player.handle}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {session.timestamp}
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
          onClick={toggleLike}
          className="flex items-center gap-1.5 transition-colors"
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart
            size={15}
            className={
              liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground hover:text-rose-400"
            }
          />
          {likeCount > 0 && (
            <span className={`text-xs ${liked ? "text-rose-500" : "text-muted-foreground"}`}>
              {likeCount}
            </span>
          )}
        </button>
      </div>
    </article>
  );
}

export default function Realm() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-3">
        {SESSIONS.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
