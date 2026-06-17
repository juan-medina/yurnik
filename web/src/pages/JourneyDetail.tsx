// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router";
import GenreChip from "@/components/GenreChip";
import { Check, ChevronLeft, Clock, Flag, Pencil, Trash2, UserPlus } from "lucide-react";
import { Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getJourney, getComments, getJourneyPlayers, postComment, deleteJourney, deleteComment, updateJourney } from "@/services/journeys";
import { followPlayer, unfollowPlayer, getIsFollowing } from "@/services/players";
import { getCurrentPlayer } from "@/services/auth";
import { avatarSrc, playerHref } from "@/lib/display";
import SignInPromptModal from "@/components/SignInPromptModal";
import ReportModal from "@/components/ReportModal";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCooldown } from "@/hooks/useCooldown";
import { RateLimitedError } from "@/lib/api";
import { JourneyForm } from "@/components/JourneyForm";
import { LimitedTextarea } from "@/components/LimitedTextarea";
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

function JourneyPlayerRow({ entry, currentPlayerId }: { entry: JourneyPlayer; currentPlayerId?: string }) {
  const { t } = useTranslation();
  const isMe = entry.player.id === currentPlayerId;
  const [following, setFollowing] = useState(entry.isFollowing);
  const [showSignIn, setShowSignIn] = useState(false);
  const followMutation = useMutation({
    mutationFn: (follow: boolean) => follow ? followPlayer(entry.player.handle) : unfollowPlayer(entry.player.handle),
    onSuccess: (_data, follow) => setFollowing(follow),
  });

  return (
    <div className="flex items-center gap-3 py-2">
      <Link to={playerHref(entry.player)} className="flex items-center gap-3 min-w-0 flex-1">
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
      {isMe ? (
        <span className="shrink-0 text-xs text-muted-foreground">{t("journey_you")}</span>
      ) : (
        <button
          onClick={() => { if (!currentPlayerId) { setShowSignIn(true); return; } followMutation.mutate(!following); }}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            following
              ? "border-border bg-muted text-muted-foreground"
              : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {following ? (
            <>
              <Check size={12} />
              {t("journey_following")}
            </>
          ) : (
            <>
              <UserPlus size={12} />
              {t("journey_follow")}
            </>
          )}
        </button>
      )}
      {showSignIn && <SignInPromptModal onClose={() => setShowSignIn(false)} />}
    </div>
  );
}

function CommentRow({ comment, journeyId, currentPlayerId, isAdmin, highlighted }: { comment: Comment; journeyId: string; currentPlayerId?: string; isAdmin?: boolean; highlighted?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlighted || !ref.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    const el = ref.current;
    el.classList.add("bg-primary/10");
    const timer = setTimeout(() => el.classList.remove("bg-primary/10"), 2000);
    return () => clearTimeout(timer);
  }, [highlighted]);
  const deleteCommentMutation = useMutation({
    mutationFn: () => deleteComment(journeyId, comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journey", journeyId, "comments"] }),
  });

  const isOwn = comment.player.id === currentPlayerId;

  return (
    <div ref={ref} id={`comment-${comment.id}`} className="rounded py-3 transition-colors duration-1000">
      <div className="mb-1 flex items-center gap-2">
        <Link to={playerHref(comment.player)} className="flex items-center gap-2">
          <PlayerAvatar player={comment.player} size="sm" />
          <span className="text-sm font-semibold">{comment.player.name}</span>
        </Link>
        {confirming ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("journey_delete_comment_confirm")}</span>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t("journey_cancel")}
            </button>
            <button
              onClick={() => { setConfirming(false); deleteCommentMutation.mutate(); }}
              className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              {t("journey_delete_comment")}
            </button>
          </div>
        ) : (
          <>
            <span className="ml-auto text-xs text-muted-foreground">{formatCommentAge(comment.commentedAt)}</span>
            {isOwn ? (
              <button
                onClick={() => setConfirming(true)}
                aria-label={t("journey_delete_comment_label")}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 size={14} />
              </button>
            ) : (
              <>
                {currentPlayerId && (
                  <button
                    onClick={() => setReporting(true)}
                    title={t("report_comment_tooltip")}
                    aria-label={t("report_comment_tooltip")}
                    className="text-muted-foreground/40 transition-colors hover:text-destructive"
                  >
                    <Flag size={14} />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => navigate(`/admin?confirm_delete_comment=${comment.id}&from_journey=${journeyId}`)}
                    title={t("admin_delete_comment_tooltip")}
                    aria-label={t("admin_delete_comment_tooltip")}
                    className="text-destructive transition-colors hover:text-destructive/70"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
      <p className="pl-8 break-words whitespace-pre-wrap text-sm text-foreground/80">{comment.text}</p>
      {reporting && (
        <ReportModal
          targetType="comment"
          targetId={comment.id}
          contextId={journeyId}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}

export default function JourneyDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const highlightedCommentId = hash.startsWith("#comment-") ? hash.slice("#comment-".length) : undefined;
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [showSignIn, setShowSignIn] = useState(false);
  const [confirmDeleteJourney, setConfirmDeleteJourney] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [reportingLog, setReportingLog] = useState(false);

  const { data: currentPlayer } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });

  const { data: journey } = useQuery({
    queryKey: ["journey", id],
    queryFn: () => getJourney(id!),
    enabled: !!id,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["journey", id, "comments"],
    queryFn: () => getComments(id!),
    enabled: !!id,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const { data: journeyPlayers } = useQuery({
    queryKey: ["journey", id, "players"],
    queryFn: () => getJourneyPlayers(id!),
    enabled: !!id,
  });

  usePageTitle(journey ? `${journey.player.name}'s journey in ${journey.game}` : undefined);

  const isOwner = !!currentPlayer && journey?.player.id === currentPlayer.id;
  const isAdmin = !!currentPlayer?.isAdmin && !isOwner;

  const { data: ownerIsFollowed = false } = useQuery({
    queryKey: ["following", journey?.player.id],
    queryFn: () => getIsFollowing(journey!.player.handle),
    enabled: !!journey && !isOwner,
  });

  const followOwnerMutation = useMutation({
    mutationFn: (follow: boolean) => follow ? followPlayer(journey!.player.handle) : unfollowPlayer(journey!.player.handle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["following", journey?.player.id] }),
  });

  const commentCooldown = useCooldown();
  const postCommentMutation = useMutation({
    mutationFn: (text: string) => postComment(id!, text),
    onSuccess: (newComment) => {
      queryClient.setQueryData<Comment[]>(["journey", id, "comments"], (old = []) => [...old, newComment]);
      setCommentText("");
    },
    onError: (err) => {
      if (err instanceof RateLimitedError) commentCooldown.start(err.retryAfterSeconds);
    },
  });

  const deleteJourneyMutation = useMutation({
    mutationFn: () => deleteJourney(id!),
    onSuccess: () => navigate("/journeys"),
  });

  const updateCooldown = useCooldown();
  const updateJourneyMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateJourney>[1]) => updateJourney(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey", id] });
      setIsEditing(false);
    },
    onError: (err) => {
      if (err instanceof RateLimitedError) updateCooldown.start(err.retryAfterSeconds);
    },
  });

  function startEditing() {
    setIsEditing(true);
  }

  if (!journey) {
    return (
      <div className="mx-auto max-w-2xl pt-8 text-center text-muted-foreground">
        {t("journey_not_found")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* Player info */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t("journey_back")}
          >
            <ChevronLeft size={20} />
          </button>
          <Link
            to={playerHref(journey.player)}
            className="flex min-w-0 items-center gap-2"
          >
            <PlayerAvatar player={journey.player} size="sm" />
            <span className="truncate text-sm font-semibold">{journey.player.name}</span>
          </Link>
          <span className="shrink-0 text-xs text-muted-foreground">@{journey.player.handle}</span>
        </div>
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {!isOwner && (
            <button
              onClick={() => { if (!currentPlayer) { setShowSignIn(true); return; } followOwnerMutation.mutate(!ownerIsFollowed); }}
              aria-label={ownerIsFollowed ? t("journey_unfollow") : t("journey_follow")}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                ownerIsFollowed
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              }`}
            >
              {ownerIsFollowed ? (
                <>
                  <Check size={12} />
                  {t("journey_unfollow")}
                </>
              ) : (
                <>
                  <UserPlus size={12} />
                  {t("journey_follow")}
                </>
              )}
            </button>
          )}
          {confirmDeleteJourney ? (
            <>
              <span className="text-sm text-muted-foreground">{t("journey_delete_confirm")}</span>
              <button
                onClick={() => setConfirmDeleteJourney(false)}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {t("journey_cancel")}
              </button>
              <button
                onClick={() => { setConfirmDeleteJourney(false); deleteJourneyMutation.mutate(); }}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                {t("journey_delete")}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">{formatJourneyDate(journey.playedAt)}</span>
              {isOwner && (
                <button
                  onClick={() => setConfirmDeleteJourney(true)}
                  aria-label={t("journey_delete_label")}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-lg border border-border bg-card p-4">
        {isEditing ? (
          <JourneyForm
            initialGame={{
              id: journey.igdbId.toString(),
              game: journey.game,
              coverUrl: journey.coverUrl,
              genres: journey.genres,
            }}
            initialDuration={journey.duration}
            initialDate={journey.playedAt}
            initialLog={journey.log ?? ""}
            dateFormat="MMM d, yyyy"
            labels={{
              durationLabel: t("journey_duration_label"),
              durationPlaceholder: t("journey_duration_placeholder"),
              durationError: t("journey_duration_error"),
              whenLabel: t("journey_when_label"),
              todayLabel: t("time_today"),
              pickLabel: t("journey_pick_date"),
              logLabel: t("journey_log_label"),
              logOptional: t("journey_log_optional"),
              logPlaceholder: t("journey_log_placeholder"),
              cancel: t("journey_cancel"),
              submit: t("journey_save"),
              error: t("journey_error"),
            }}
            onCancel={() => setIsEditing(false)}
            onSubmit={(value) => updateJourneyMutation.mutate({
              igdbId: value.igdbId ?? journey.igdbId,
              durationSeconds: value.durationSeconds,
              playedAt: value.playedAt,
              log: value.log,
            })}
            submitting={updateJourneyMutation.isPending}
            submitError={updateJourneyMutation.isError}
            cooldownSeconds={updateCooldown.remaining}
            cooldownLabel={(seconds) => t("journey_slow_down", { seconds })}
          />
        ) : (
          <>
            <div className="flex gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-slate-800">
                {journey.coverUrl
                  ? <img src={journey.coverUrl} alt={journey.game} className="absolute inset-0 h-full w-full object-cover" />
                  : <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-300">{journey.game[0]}</span>
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between">
                  <h1 className="mb-1.5 text-xl font-bold">
                    <Link to={`/game/${journey.igdbId}`} className="inline-flex items-center gap-1.5 hover:underline">
                      {journey.game}
                      <Info size={14} className="shrink-0 text-muted-foreground" />
                    </Link>
                    {journey.releaseYear && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">({journey.releaseYear})</span>
                    )}
                  </h1>
                  {isOwner && (
                    <button
                      onClick={startEditing}
                      aria-label={t("journey_edit_label")}
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {journey.genres.map((g) => (
                    <GenreChip key={g} genre={g} />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock size={13} />
                  <span>{journey.duration}</span>
                </div>
              </div>
            </div>

            {journey.log && (
              <div className="mt-4 flex items-start gap-2">
                <blockquote className="min-w-0 flex-1 break-words whitespace-pre-wrap border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
                  &ldquo;{journey.log}&rdquo;
                </blockquote>
                {!isOwner && currentPlayer && (
                  <button
                    onClick={() => setReportingLog(true)}
                    title={t("report_journey_log_tooltip")}
                    aria-label={t("report_journey_log_tooltip")}
                    className="mt-0.5 shrink-0 text-muted-foreground/40 transition-colors hover:text-destructive"
                  >
                    <Flag size={13} />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => navigate(`/admin?confirm_delete_journey_log=${id}`)}
                    title={t("admin_delete_journey_log_tooltip")}
                    aria-label={t("admin_delete_journey_log_tooltip")}
                    className="mt-0.5 shrink-0 text-destructive transition-colors hover:text-destructive/70"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
            {reportingLog && (
              <ReportModal
                targetType="journey_log"
                targetId={id!}
                onClose={() => setReportingLog(false)}
              />
            )}
          </>
        )}
      </div>

      {/* Comments */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{t("journey_comments")}</h2>
        </div>
        <div className="divide-y divide-border px-4">
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} journeyId={id!} currentPlayerId={currentPlayer?.id} isAdmin={isAdmin} highlighted={c.id === highlightedCommentId} />
          ))}
        </div>
        <div className="border-t border-border p-4">
          {(commentCooldown.remaining > 0 || postCommentMutation.isError) && (
            <p className="mb-2 text-xs text-destructive">
              {commentCooldown.remaining > 0
                ? t("journey_slow_down_message", { seconds: commentCooldown.remaining })
                : t("journey_error")}
            </p>
          )}
          <LimitedTextarea
            value={commentText}
            onChange={setCommentText}
            placeholder={t("journey_comment_placeholder")}
            rows={2}
            toolbarRight={
              <button
                disabled={!commentText.trim() || postCommentMutation.isPending || commentCooldown.remaining > 0}
                onClick={() => { if (!currentPlayer) { setShowSignIn(true); return; } postCommentMutation.mutate(commentText); }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {commentCooldown.remaining > 0 ? t("journey_slow_down", { seconds: commentCooldown.remaining }) : t("journey_post")}
              </button>
            }
          />
        </div>
      </div>

      {/* On this journey */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{t("journey_on_this")}</h2>
        </div>

        {(journeyPlayers?.following ?? []).length > 0 && (
          <div className="px-4">
            <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("journey_following_section")}
            </p>
            <div className="divide-y divide-border">
              {(journeyPlayers?.following ?? []).map((entry) => (
                <JourneyPlayerRow key={entry.player.id} entry={entry} currentPlayerId={currentPlayer?.id} />
              ))}
            </div>
          </div>
        )}

        {(journeyPlayers?.others ?? []).length > 0 && (
          <div className="px-4 pb-2">
            <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("journey_others_section")}
            </p>
            <div className="divide-y divide-border">
              {(journeyPlayers?.others ?? []).map((entry) => (
                <JourneyPlayerRow key={entry.player.id} entry={entry} currentPlayerId={currentPlayer?.id} />
              ))}
            </div>
          </div>
        )}

        {journeyPlayers && (journeyPlayers.following.length + journeyPlayers.others.length === 0) && (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            {t("journey_no_others")}
          </p>
        )}
      </div>

      <div className="h-8" />

      {showSignIn && <SignInPromptModal onClose={() => setShowSignIn(false)} />}

    </div>
  );
}
