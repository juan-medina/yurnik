// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, Clock, Heart, Trash2, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getJourney, getComments, getLikers, getJourneyPlayers, postComment, deleteJourney, deleteComment } from "@/services/journeys";
import { toggleLike } from "@/services/journeys";
import { toggleFollow, isFollowingHandle } from "@/services/players";
import { getCurrentPlayer, MY_PLAYER_ID } from "@/services/auth";
import { avatarSrc, playerHref } from "@/lib/display";
import FollowListModal from "@/components/FollowListModal";
import { formatCommentAge, formatJourneyDate } from "@/lib/time";
import type { Comment, JourneyPlayer, Player } from "@/models";

function PlayerAvatar({ player, size = "md" }: { player: Player; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  return (
    <img
      src={avatarSrc(player)}
      alt={player.name}
      className={`${dims} shrink-0 rounded-full object-cover`}
    />
  );
}

function JourneyPlayerRow({ entry, journeyId }: { entry: JourneyPlayer; journeyId: string }) {
  const queryClient = useQueryClient();
  const followMutation = useMutation({
    mutationFn: () => toggleFollow(entry.player.handle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journey", journeyId, "players"] }),
  });
  const following = entry.isFollowing;

  return (
    <div className="flex items-center gap-3 py-2">
      <Link to={playerHref(entry.player, MY_PLAYER_ID)} className="flex items-center gap-3 min-w-0 flex-1">
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
            <span>{formatJourneyDate(entry.playedAt)}</span>
          </div>
        </div>
      </Link>
      {!entry.isFollowing && (
        <button
          onClick={() => followMutation.mutate()}
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

function CommentRow({ comment, journeyId }: { comment: Comment; journeyId: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const deleteCommentMutation = useMutation({
    mutationFn: () => deleteComment(journeyId, comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journey", journeyId, "comments"] }),
  });

  return (
    <div className="py-3">
      <div className="mb-1 flex items-center gap-2">
        <Link to={playerHref(comment.player, MY_PLAYER_ID)} className="flex items-center gap-2">
          <PlayerAvatar player={comment.player} size="sm" />
          <span className="text-sm font-semibold">{comment.player.name}</span>
        </Link>
        {confirming ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">Delete comment?</span>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirming(false); deleteCommentMutation.mutate(); }}
              className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            <span className="ml-auto text-xs text-muted-foreground">{formatCommentAge(comment.commentedAt)}</span>
            {comment.player.id === currentPlayer?.id && (
              <button
                onClick={() => setConfirming(true)}
                aria-label="Delete comment"
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </div>
      <p className="pl-8 text-sm text-foreground/80">{comment.text}</p>
    </div>
  );
}

export default function JourneyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [showLikers, setShowLikers] = useState(false);
  const [confirmDeleteJourney, setConfirmDeleteJourney] = useState(false);

  const { data: currentPlayer } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });

  const { data: journey } = useQuery({
    queryKey: ["journey", id],
    queryFn: () => getJourney(id!),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["journey", id, "comments"],
    queryFn: () => getComments(id!),
    enabled: !!id,
  });

  const { data: likers = [] } = useQuery({
    queryKey: ["journey", id, "likers"],
    queryFn: () => getLikers(id!),
    enabled: !!id,
  });

  const { data: journeyPlayers } = useQuery({
    queryKey: ["journey", id, "players"],
    queryFn: () => getJourneyPlayers(id!),
    enabled: !!id,
  });

  const isOwner = !!currentPlayer && journey?.player.id === currentPlayer.id;

  const { data: ownerIsFollowed = false } = useQuery({
    queryKey: ["following", journey?.player.handle],
    queryFn: () => isFollowingHandle(journey!.player.handle),
    enabled: !!journey && !isOwner,
  });

  const likeMutation = useMutation({
    mutationFn: toggleLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journey", id] }),
  });

  const followOwnerMutation = useMutation({
    mutationFn: () => toggleFollow(journey!.player.handle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["following", journey?.player.handle] }),
  });

  const postCommentMutation = useMutation({
    mutationFn: (text: string) => postComment(id!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey", id, "comments"] });
      setCommentText("");
    },
  });

  const deleteJourneyMutation = useMutation({
    mutationFn: () => deleteJourney(id!),
    onSuccess: () => navigate("/journeys"),
  });

  if (!journey) {
    return (
      <div className="mx-auto max-w-2xl pt-8 text-center text-muted-foreground">
        Journey not found.
      </div>
    );
  }

  const likeCount = journey.likes + (journey.liked ? 1 : 0);

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
        <Link
          to={playerHref(journey.player, MY_PLAYER_ID)}
          className="flex items-center gap-2"
        >
          <PlayerAvatar player={journey.player} size="sm" />
          <span className="text-sm font-semibold">{journey.player.name}</span>
        </Link>
        <span className="text-xs text-muted-foreground">@{journey.player.handle}</span>
        {!isOwner && (
          <button
            onClick={() => followOwnerMutation.mutate()}
            aria-label={ownerIsFollowed ? "Unfollow" : "Follow"}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              ownerIsFollowed
                ? "border-border bg-muted text-muted-foreground"
                : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            {ownerIsFollowed ? (
              <>
                <Check size={12} />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus size={12} />
                Follow
              </>
            )}
          </button>
        )}
        {confirmDeleteJourney ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-sm text-muted-foreground">Delete journey?</span>
            <button
              onClick={() => setConfirmDeleteJourney(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirmDeleteJourney(false); deleteJourneyMutation.mutate(); }}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            <span className="ml-auto text-xs text-muted-foreground">{formatJourneyDate(journey.playedAt)}</span>
            {isOwner && (
              <button
                onClick={() => setConfirmDeleteJourney(true)}
                aria-label="Delete journey"
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Hero */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-slate-800">
            {journey.coverUrl
              ? <img src={journey.coverUrl} alt={journey.game} className="absolute inset-0 h-full w-full object-cover" />
              : <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-300">{journey.game[0]}</span>
            }
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="mb-1.5 text-xl font-bold">{journey.game}</h1>
            <div className="mb-2 flex flex-wrap gap-1">
              {journey.genres.map((g) => (
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
              <span>{journey.duration}</span>
            </div>
          </div>
        </div>

        {journey.log && (
          <blockquote className="mt-4 border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
            &ldquo;{journey.log}&rdquo;
          </blockquote>
        )}
      </div>

      {/* Likes */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => likeMutation.mutate(journey.id)}
            className="flex items-center gap-2 transition-colors"
            aria-label={journey.liked ? "Unlike" : "Like"}
          >
            <Heart
              size={22}
              className={journey.liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground hover:text-rose-400"}
            />
            <span className={`text-sm font-medium ${journey.liked ? "text-rose-500" : "text-muted-foreground"}`}>
              {likeCount}
            </span>
          </button>
          <button
            onClick={() => setShowLikers(true)}
            className="flex items-center gap-2 transition-opacity hover:opacity-75"
            aria-label="See who liked this"
          >
            <div className="flex -space-x-2">
              {likers.map((liker) => (
                <img
                  key={liker.id}
                  src={avatarSrc(liker)}
                  alt={liker.name}
                  title={liker.name}
                  className="h-7 w-7 rounded-full border-2 border-card object-cover"
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">+42 more</span>
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Comments</h2>
        </div>
        <div className="divide-y divide-border px-4">
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} journeyId={id!} />
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="flex gap-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              disabled={!commentText.trim()}
              onClick={() => postCommentMutation.mutate(commentText)}
              className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      </div>

      {/* On this journey */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">On this journey</h2>
        </div>

        {(journeyPlayers?.friends ?? []).length > 0 && (
          <div className="px-4">
            <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Friends
            </p>
            <div className="divide-y divide-border">
              {(journeyPlayers?.friends ?? []).map((entry) => (
                <JourneyPlayerRow key={entry.player.id} entry={entry} journeyId={id!} />
              ))}
            </div>
          </div>
        )}

        {(journeyPlayers?.others ?? []).length > 0 && (
          <div className="px-4 pb-2">
            <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Others
            </p>
            <div className="divide-y divide-border">
              {(journeyPlayers?.others ?? []).map((entry) => (
                <JourneyPlayerRow key={entry.player.id} entry={entry} journeyId={id!} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-8" />

      {showLikers && (
        <FollowListModal
          title="Liked by"
          players={likers}
          onClose={() => setShowLikers(false)}
        />
      )}

    </div>
  );
}
