// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Clock, Heart, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentPlayer, updateProfile } from "@/services/auth";
import { getUserJourneys, toggleLike } from "@/services/journeys";
import { getFollowers, getFollowing } from "@/services/players";
import { MY_PLAYER_ID } from "@/services/auth";
import { avatarSrc, initials } from "@/lib/display";
import FollowListModal from "@/components/FollowListModal";
import { formatJourneyDate } from "@/lib/time";
import type { Journey, Player } from "@/models";

function totalHours(journeys: Journey[]): string {
  const mins = journeys.reduce((acc, j) => {
    const h = parseInt(j.duration.match(/(\d+)h/)?.[1] ?? "0");
    const m = parseInt(j.duration.match(/(\d+)m/)?.[1] ?? "0");
    return acc + h * 60 + m;
  }, 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function Hero() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: player } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });
  const { data: journeys = [] } = useQuery({ queryKey: ["journeys", "user"], queryFn: getUserJourneys });
  const { data: followers = [] } = useQuery({
    queryKey: ["follow-list", MY_PLAYER_ID, "followers"],
    queryFn: () => getFollowers(MY_PLAYER_ID),
  });
  const { data: following = [] } = useQuery({
    queryKey: ["follow-list", MY_PLAYER_ID, "following"],
    queryFn: () => getFollowing(MY_PLAYER_ID),
  });

  const [editingBio, setEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState("");
  const [followList, setFollowList] = useState<{ title: string; players: Player[] } | null>(null);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
  });

  const likeMutation = useMutation({
    mutationFn: toggleLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journeys", "user"] }),
  });

  if (!player) return null;

  const displayName = player.name;
  const bio = player.bio ?? "";

  function saveBio() {
    updateProfileMutation.mutate({ bio: draftBio.trim() });
    setEditingBio(false);
  }

  function cancelBio() {
    setEditingBio(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Profile card */}
      <div className="mb-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="h-16 w-16 shrink-0">
            <img
              src={avatarSrc(player)}
              alt={displayName}
              className="h-full w-full rounded-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                target.nextElementSibling?.removeAttribute("hidden");
              }}
            />
            <div
              hidden
              className="flex h-full w-full items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: player.color }}
            >
              {initials(displayName)}
            </div>
          </div>

          {/* Name, handle, bio */}
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xl font-bold leading-tight">{displayName}</p>

            <div className="mb-3 text-sm text-muted-foreground">
              <span>@{player.handle}</span>
              <p className="text-xs text-muted-foreground/60">Username and avatar provided by Discord</p>
            </div>

            {editingBio ? (
              <div>
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={2}
                  aria-label="Bio"
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={saveBio}
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  >
                    <Check size={12} />
                    Save
                  </button>
                  <button
                    onClick={cancelBio}
                    className="rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-sm text-muted-foreground">{bio}</p>
                <button
                  onClick={() => {
                    setDraftBio(bio);
                    setEditingBio(true);
                  }}
                  aria-label="Edit bio"
                  className="shrink-0 rounded-md p-0.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 divide-x divide-border rounded-lg border border-border bg-card">
        {[
          { label: "Journeys", value: journeys.length, onClick: undefined },
          { label: "Hours", value: totalHours(journeys), onClick: undefined },
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

      {/* Journeys */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Your journeys
      </h2>

      {journeys.length > 0 ? (
        <div className="flex flex-col gap-3">
          {journeys.map((journey) => {
            const likeCount = journey.likes + (journey.liked ? 1 : 0);
            return (
              <article
                key={journey.id}
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
                  <div className="mb-1">
                    <span className="text-xs text-muted-foreground">{formatJourneyDate(journey.playedAt)}</span>
                  </div>
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-bold">{journey.game}</span>
                    <div className="flex flex-wrap gap-1">
                      {journey.genres.map((g) => (
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
                    <span>{journey.duration}</span>
                  </div>
                  {journey.log && (
                    <p className="mb-2 text-sm italic text-muted-foreground">
                      &ldquo;{journey.log}&rdquo;
                    </p>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); likeMutation.mutate(journey.id); }}
                    aria-label={journey.liked ? "Unlike" : "Like"}
                    className="flex items-center gap-1.5 transition-colors"
                  >
                    <Heart
                      size={15}
                      className={
                        journey.liked
                          ? "fill-rose-500 text-rose-500"
                          : "text-muted-foreground hover:text-rose-400"
                      }
                    />
                    {likeCount > 0 && (
                      <span
                        className={`text-xs ${journey.liked ? "text-rose-500" : "text-muted-foreground"}`}
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
