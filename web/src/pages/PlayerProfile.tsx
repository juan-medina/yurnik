// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, Clock, Heart, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlayer, getPlayerSessions, getFollowers, getFollowing, toggleFollow } from "@/services/players";
import { toggleLike } from "@/services/sessions";
import { MY_PLAYER_ID } from "@/services/auth";
import { avatarSrc, initials } from "@/lib/display";
import FollowListModal from "@/components/FollowListModal";
import { formatSessionDate } from "@/lib/time";
import type { Player } from "@/models";

export default function PlayerProfile() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: player } = useQuery({
    queryKey: ["player", handle],
    queryFn: () => getPlayer(handle!),
    enabled: !!handle,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", "user", handle],
    queryFn: () => getPlayerSessions(handle!),
    enabled: !!handle,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ["follow-list", player?.id, "followers"],
    queryFn: () => getFollowers(player!.id),
    enabled: !!player,
  });

  const { data: following = [] } = useQuery({
    queryKey: ["follow-list", player?.id, "following"],
    queryFn: () => getFollowing(player!.id),
    enabled: !!player,
  });

  const { data: isFollowing = false } = useQuery({
    queryKey: ["following", handle],
    queryFn: async () => {
      const { isFollowingHandle } = await import("@/services/players");
      return isFollowingHandle(handle!);
    },
    enabled: !!handle,
  });

  const followMutation = useMutation({
    mutationFn: () => toggleFollow(handle!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["following", handle] });
      queryClient.invalidateQueries({ queryKey: ["follow-list"] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: toggleLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions", "user", handle] }),
  });

  const [followList, setFollowList] = useState<{ title: string; players: Player[] } | null>(null);

  if (!player) {
    return (
      <div className="mx-auto max-w-2xl pt-8 text-center text-muted-foreground">
        Player not found.
      </div>
    );
  }

  const showFollow = handle !== player.handle || player.id !== MY_PLAYER_ID;
  const isMe = player.id === MY_PLAYER_ID;

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
          {showFollow && !isMe && (
            <button
              onClick={() => followMutation.mutate()}
              aria-label={isFollowing ? "Unfollow" : "Follow"}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                isFollowing
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              }`}
            >
              {isFollowing ? (
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
            { label: "Journeys", value: sessions.length, onClick: undefined },
            {
              label: "Followers",
              value: player.followers ?? followers.length,
              onClick: () => setFollowList({ title: "Followers", players: followers }),
            },
            {
              label: "Following",
              value: player.following ?? following.length,
              onClick: () => setFollowList({ title: "Following", players: following }),
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

      {sessions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => {
            const likeCount = session.likes + (session.liked ? 1 : 0);
            return (
              <article
                key={session.id}
                className="flex cursor-pointer gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
                onClick={() => navigate(`/journey/${session.id}`)}
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-800">
                  {session.coverUrl
                    ? <img src={session.coverUrl} alt={session.game} className="absolute inset-0 h-full w-full object-cover" />
                    : <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-300">{session.game[0]}</span>
                  }
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
                    <span className="ml-1.5">{formatSessionDate(session.playedAt)}</span>
                  </div>
                  {session.log && (
                    <p className="mb-2 text-sm italic text-muted-foreground">
                      &ldquo;{session.log}&rdquo;
                    </p>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); likeMutation.mutate(session.id); }}
                    aria-label={session.liked ? "Unlike" : "Like"}
                    className="flex items-center gap-1.5 transition-colors"
                  >
                    <Heart
                      size={15}
                      className={
                        session.liked
                          ? "fill-rose-500 text-rose-500"
                          : "text-muted-foreground hover:text-rose-400"
                      }
                    />
                    {likeCount > 0 && (
                      <span
                        className={`text-xs ${session.liked ? "text-rose-500" : "text-muted-foreground"}`}
                      >
                        {likeCount}
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
