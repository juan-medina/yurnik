// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import GenreChip from "@/components/GenreChip";
import { CalendarDays, Check, ChevronLeft, Clock, Pencil, Trash2, UserPlus } from "lucide-react";
import { Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getJourney, getComments, getJourneyPlayers, postComment, deleteJourney, deleteComment, updateJourney } from "@/services/journeys";
import { followPlayer, unfollowPlayer, getIsFollowing } from "@/services/players";
import { getCurrentPlayer } from "@/services/auth";
import { avatarSrc, playerHref } from "@/lib/display";
import SignInPromptModal from "@/components/SignInPromptModal";
import { GameSelector } from "@/components/GameSelector";
import { parseDuration } from "@/lib/duration";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatCommentAge, formatJourneyDate } from "@/lib/time";
import type { Comment, JourneyPlayer, Player } from "@/models";
import type { Game } from "@/models/game";

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

function CommentRow({ comment, journeyId, currentPlayerId }: { comment: Comment; journeyId: string; currentPlayerId?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const deleteCommentMutation = useMutation({
    mutationFn: () => deleteComment(journeyId, comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journey", journeyId, "comments"] }),
  });

  return (
    <div className="py-3">
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
            {comment.player.id === currentPlayerId && (
              <button
                onClick={() => setConfirming(true)}
                aria-label={t("journey_delete_comment_label")}
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
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [showSignIn, setShowSignIn] = useState(false);
  const [confirmDeleteJourney, setConfirmDeleteJourney] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editGame, setEditGame] = useState<Game | null>(null);
  const [editDuration, setEditDuration] = useState("");
  const [editPickedDate, setEditPickedDate] = useState<Date | undefined>(undefined);
  const [editCalendarOpen, setEditCalendarOpen] = useState(false);
  const [editLog, setEditLog] = useState("");

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

  const { data: ownerIsFollowed = false } = useQuery({
    queryKey: ["following", journey?.player.id],
    queryFn: () => getIsFollowing(journey!.player.handle),
    enabled: !!journey && !isOwner,
  });

  const followOwnerMutation = useMutation({
    mutationFn: (follow: boolean) => follow ? followPlayer(journey!.player.handle) : unfollowPlayer(journey!.player.handle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["following", journey?.player.id] }),
  });

  const postCommentMutation = useMutation({
    mutationFn: (text: string) => postComment(id!, text),
    onSuccess: (newComment) => {
      queryClient.setQueryData<Comment[]>(["journey", id, "comments"], (old = []) => [...old, newComment]);
      setCommentText("");
    },
  });

  const deleteJourneyMutation = useMutation({
    mutationFn: () => deleteJourney(id!),
    onSuccess: () => navigate("/journeys"),
  });

  const updateJourneyMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateJourney>[1]) => updateJourney(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey", id] });
      setIsEditing(false);
    },
  });

  function startEditing() {
    if (!journey) return;
    setEditGame({
      id: journey.igdbId.toString(),
      game: journey.game,
      coverUrl: journey.coverUrl,
      genres: journey.genres,
    });
    setEditDuration(journey.duration);
    setEditPickedDate(journey.playedAt);
    setEditLog(journey.log ?? "");
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
        {isEditing ? (() => {
          const editParsed = parseDuration(editDuration);
          const durationInvalid = editDuration.trim() !== "" && editParsed === null;
          const canSave = editGame !== null && editParsed !== null && editPickedDate !== undefined;
          return (
            <div>
              <div className="mb-4">
                <GameSelector value={editGame} onChange={setEditGame} />
              </div>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("journey_duration_label")}
                  </label>
                  <input
                    type="text"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    placeholder={t("journey_duration_placeholder")}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary ${durationInvalid ? "border-destructive" : "border-border"}`}
                  />
                  {durationInvalid && <p className="mt-1 text-xs text-destructive">{t("journey_duration_error")}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("journey_when_label")}
                  </label>
                  <Popover open={editCalendarOpen} onOpenChange={setEditCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start gap-1.5">
                        <CalendarDays size={14} />
                        {editPickedDate ? format(editPickedDate, "MMM d, yyyy") : t("journey_pick_date")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto">
                      <Calendar
                        mode="single"
                        selected={editPickedDate}
                        onSelect={(date) => {
                          setEditPickedDate(date);
                          setEditCalendarOpen(false);
                        }}
                        disabled={{ after: new Date() }}
                        defaultMonth={editPickedDate ?? new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("journey_log_label")}{" "}
                  <span className="font-normal text-muted-foreground/60">{t("journey_log_optional")}</span>
                </label>
                <textarea
                  value={editLog}
                  onChange={(e) => setEditLog(e.target.value)}
                  placeholder={t("journey_log_placeholder")}
                  rows={3}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {t("journey_cancel")}
                </button>
                <button
                  disabled={!canSave || updateJourneyMutation.isPending}
                  onClick={() => {
                    if (!editGame || !editParsed || !editPickedDate) return;
                    const durationSeconds = (editParsed.hours * 3600) + (editParsed.minutes * 60);
                    updateJourneyMutation.mutate({ igdbId: parseInt(editGame.id), durationSeconds, playedAt: editPickedDate, log: editLog.trim() || undefined });
                  }}
                  className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
                >
                  {t("journey_save")}
                </button>
              </div>
              {updateJourneyMutation.isError && (
                <p className="mt-2 text-xs text-destructive">{t("journey_error")}</p>
              )}
            </div>
          );
        })() : (
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
              <blockquote className="mt-4 border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
                &ldquo;{journey.log}&rdquo;
              </blockquote>
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
            <CommentRow key={c.id} comment={c} journeyId={id!} currentPlayerId={currentPlayer?.id} />
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="flex gap-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("journey_comment_placeholder")}
              rows={2}
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              disabled={!commentText.trim() || postCommentMutation.isPending}
              onClick={() => { if (!currentPlayer) { setShowSignIn(true); return; } postCommentMutation.mutate(commentText); }}
              className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {t("journey_post")}
            </button>
          </div>
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
