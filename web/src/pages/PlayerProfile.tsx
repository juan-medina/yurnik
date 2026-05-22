// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, Clock, Heart, UserPlus } from "lucide-react";
import {
  MOCK_FOLLOW_LISTS,
  MOCK_FRIENDS_ON_JOURNEY,
  MOCK_GAME_ACTIVITY,
  MY_PLAYER_ID,
  PLAYERS,
  SESSIONS,
  avatarSrc,
  initials,
  type Player,
} from "@/lib/mock";
import FollowListModal from "@/components/FollowListModal";

function findPlayer(handle: string): Player | undefined {
  const fromPlayers = PLAYERS.find((p) => p.handle === handle);
  if (fromPlayers) return fromPlayers;
  const fromSessions = SESSIONS.find((s) => s.player.handle === handle)?.player;
  if (fromSessions) return fromSessions;
  return MOCK_GAME_ACTIVITY.flatMap((g) => g.entries)
    .find((e) => e.player.handle === handle)?.player;
}

function isMe(player: Player) {
  return player.id === MY_PLAYER_ID;
}

function initFollowing(handle: string) {
  return MOCK_FRIENDS_ON_JOURNEY.some((jp) => jp.player.handle === handle);
}

export default function PlayerProfile() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();

  const player = handle ? findPlayer(handle) : undefined;
  const playerSessions = SESSIONS.filter((s) => s.player.handle === handle);
  const journeyCount = playerSessions.length;

  const [following, setFollowing] = useState(() => (handle ? initFollowing(handle) : false));
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [followList, setFollowList] = useState<{ title: string; players: Player[] } | null>(null);

  if (!player) {
    return (
      <div className="mx-auto max-w-2xl pt-8 text-center text-muted-foreground">
        Player not found.
      </div>
    );
  }

  function toggleLike(id: string) {
    setLikedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const myHandle = PLAYERS.find((p) => p.id === MY_PLAYER_ID)?.handle;
  const showFollow = handle !== myHandle;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Profile card */}
      <div className="mb-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <img
            src={avatarSrc(player)}
            alt={player.name}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = document.createElement("div");
              fallback.className =
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white";
              fallback.style.backgroundColor = player.color;
              fallback.textContent = initials(player.name);
              target.parentNode?.insertBefore(fallback, target);
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold leading-tight">{player.name}</p>
            <p className="mb-2 text-sm text-muted-foreground">@{player.handle}</p>
            {player.bio && (
              <p className="text-sm text-muted-foreground">{player.bio}</p>
            )}
          </div>
          {showFollow && !isMe(player) && (
            <button
              onClick={() => setFollowing((f) => !f)}
              aria-label={following ? "Unfollow" : "Follow"}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                following
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              }`}
            >
              {following ? (
                <>
                  <Check size={14} />
                  Unfollow
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  Follow
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {(player.followers !== undefined || player.following !== undefined) && (
        <div className="mb-6 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
          {[
            { label: "Journeys", value: journeyCount, onClick: undefined },
            {
              label: "Followers",
              value: player.followers ?? 0,
              onClick: () => {
                const lists = MOCK_FOLLOW_LISTS[player.id];
                setFollowList({ title: "Followers", players: lists?.followers ?? [] });
              },
            },
            {
              label: "Following",
              value: player.following ?? 0,
              onClick: () => {
                const lists = MOCK_FOLLOW_LISTS[player.id];
                setFollowList({ title: "Following", players: lists?.following ?? [] });
              },
            },
          ].map(({ label, value, onClick }) =>
            onClick ? (
              <button
                key={label}
                onClick={onClick}
                className="flex flex-col items-center py-4 transition-colors hover:bg-accent/50"
              >
                <span className="text-lg font-bold">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </button>
            ) : (
              <div key={label} className="flex flex-col items-center py-4">
                <span className="text-lg font-bold">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ),
          )}
        </div>
      )}

      {/* Journeys */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Recent journeys
      </h2>

      {playerSessions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {playerSessions.map((session) => {
            const liked = likedIds.has(session.id);
            const count = session.likes + (liked ? 1 : 0);
            return (
              <article
                key={session.id}
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
                  <div className="mb-1 flex items-baseline gap-2">
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
                    <span className="ml-1.5">{session.timestamp}</span>
                  </div>
                  {session.log && (
                    <p className="mb-2 text-sm italic text-muted-foreground">
                      &ldquo;{session.log}&rdquo;
                    </p>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(session.id);
                    }}
                    aria-label={liked ? "Unlike" : "Like"}
                    className="flex items-center gap-1.5 transition-colors"
                  >
                    <Heart
                      size={15}
                      className={
                        liked
                          ? "fill-rose-500 text-rose-500"
                          : "text-muted-foreground hover:text-rose-400"
                      }
                    />
                    {count > 0 && (
                      <span
                        className={`text-xs ${liked ? "text-rose-500" : "text-muted-foreground"}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No journeys yet.
        </div>
      )}

      <div className="h-8" />

      {followList && (
        <FollowListModal
          title={followList.title}
          players={followList.players}
          onClose={() => setFollowList(null)}
        />
      )}
    </div>
  );
}
