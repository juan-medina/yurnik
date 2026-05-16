// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, Clock, Heart, UserPlus } from "lucide-react";
import {
  MOCK_COMMENTS,
  MOCK_FRIENDS_ON_JOURNEY,
  MOCK_LIKERS,
  MOCK_OTHERS_ON_JOURNEY,
  SESSIONS,
  initials,
  type MockComment,
  type Player,
  type JourneyPlayer,
} from "@/lib/mock";

function PlayerAvatar({ player, size = "md" }: { player: Player; size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: player.color }}
    >
      {initials(player.name)}
    </div>
  );
}

function JourneyPlayerRow({ entry }: { entry: JourneyPlayer }) {
  const [following, setFollowing] = useState(false);

  return (
    <div className="flex items-center gap-3 py-2">
      <PlayerAvatar player={entry.player} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold">{entry.player.name}</span>
          <span className="truncate text-xs text-muted-foreground">@{entry.player.handle}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={11} />
          <span>{entry.duration}</span>
          <span className="mx-1 opacity-40">·</span>
          <span>{entry.timestamp}</span>
        </div>
      </div>
      {!entry.isFollowing && (
        <button
          onClick={() => setFollowing((f) => !f)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            following
              ? "border-border bg-muted text-muted-foreground"
              : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {following ? (
            <>
              <Check size={12} />
              Following
            </>
          ) : (
            <>
              <UserPlus size={12} />
              Follow
            </>
          )}
        </button>
      )}
    </div>
  );
}

function CommentRow({ comment }: { comment: MockComment }) {
  return (
    <div className="py-3">
      <div className="mb-1 flex items-center gap-2">
        <PlayerAvatar player={comment.player} size="sm" />
        <span className="text-sm font-semibold">{comment.player.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{comment.timestamp}</span>
      </div>
      <p className="pl-8 text-sm text-foreground/80">{comment.text}</p>
    </div>
  );
}

export default function JourneyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = SESSIONS.find((s) => s.id === id);

  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState("");
  const likeCount = (session?.likes ?? 0) + (liked ? 1 : 0);

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl pt-8 text-center text-muted-foreground">
        Journey not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <PlayerAvatar player={session.player} size="sm" />
        <span className="text-sm font-semibold">{session.player.name}</span>
        <span className="text-xs text-muted-foreground">@{session.player.handle}</span>
        <span className="ml-auto text-xs text-muted-foreground">{session.timestamp}</span>
      </div>

      {/* Hero */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex gap-4">
          <div
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md"
            style={{ backgroundColor: session.coverColor }}
          >
            <span
              className="absolute inset-0 flex items-center justify-center text-4xl font-bold"
              style={{ color: session.coverAccent }}
            >
              {session.game[0]}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="mb-1.5 text-xl font-bold">{session.game}</h1>
            <div className="mb-2 flex flex-wrap gap-1">
              {session.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock size={13} />
              <span>{session.duration}</span>
            </div>
          </div>
        </div>

        {session.log && (
          <blockquote className="mt-4 border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
            &ldquo;{session.log}&rdquo;
          </blockquote>
        )}
      </div>

      {/* Likes */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLiked((l) => !l)}
            className="flex items-center gap-2 transition-colors"
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart
              size={22}
              className={liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground hover:text-rose-400"}
            />
            <span className={`text-sm font-medium ${liked ? "text-rose-500" : "text-muted-foreground"}`}>
              {likeCount}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {MOCK_LIKERS.map((liker) => (
                <div
                  key={liker.id}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white"
                  style={{ backgroundColor: liker.color }}
                  title={liker.name}
                >
                  {initials(liker.name)}
                </div>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">+42 more</span>
          </div>
        </div>
      </div>

      {/* On this journey */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">On this journey</h2>
        </div>

        {MOCK_FRIENDS_ON_JOURNEY.length > 0 && (
          <div className="px-4">
            <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Friends
            </p>
            <div className="divide-y divide-border">
              {MOCK_FRIENDS_ON_JOURNEY.map((entry) => (
                <JourneyPlayerRow key={entry.player.id} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {MOCK_OTHERS_ON_JOURNEY.length > 0 && (
          <div className="px-4 pb-2">
            <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Others
            </p>
            <div className="divide-y divide-border">
              {MOCK_OTHERS_ON_JOURNEY.map((entry) => (
                <JourneyPlayerRow key={entry.player.id} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Comments</h2>
        </div>
        <div className="divide-y divide-border px-4">
          {MOCK_COMMENTS.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="flex gap-3">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              disabled={!comment.trim()}
              className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
