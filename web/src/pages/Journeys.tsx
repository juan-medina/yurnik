// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Check, Clock, MonitorDown, Plus, Trash2, X } from "lucide-react";
import GenreChip from "@/components/GenreChip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer } from "@/services/auth";
import SignInPromptModal from "@/components/SignInPromptModal";
import { getUserJourneys, getPendingJourneys, addJourney, confirmPendingJourney, dismissPendingJourney, excludePendingJourney } from "@/services/journeys";
import { formatJourneyDate } from "@/lib/time";
import JourneyCard from "@/components/JourneyCard";
import { GameCover } from "@/components/GameSelector";
import { JourneyForm } from "@/components/JourneyForm";
import type { JourneyFormValue } from "@/components/JourneyForm";
import type { PendingJourney } from "@/models/journey";
import type { Game } from "@/models/game";

function ClientHint() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <MonitorDown size={15} className="mt-0.5 shrink-0" />
      <p className="flex-1">
        {t("journeys_hint_pre")}
        <a
          href="https://github.com/juan-medina/yurnik/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {t("journeys_hint_link")}
        </a>
        {t("journeys_hint_post")}
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t("journeys_dismiss")}
        className="shrink-0 rounded-md p-0.5 transition-colors hover:bg-accent hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function AddJourneyForm({ onAdd, onCancel }: { onAdd: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: addJourney,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys", "user"] });
      onAdd();
    },
    onError: () => {
      // form stays open — user can retry
    },
  });

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-semibold">{t("journeys_log_title")}</h2>
        <button onClick={onCancel} aria-label={t("journeys_close")} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <X size={15} />
        </button>
      </div>

      <JourneyForm
        initialGame={null}
        dateFormat="MMM d"
        labels={{
          durationLabel: t("journeys_duration_label"),
          durationPlaceholder: t("journeys_duration_placeholder"),
          durationError: t("journeys_duration_error"),
          whenLabel: t("journeys_when_label"),
          todayLabel: t("time_today"),
          pickLabel: t("journeys_pick_date"),
          logLabel: t("journeys_log_label"),
          logOptional: t("journeys_log_optional"),
          logPlaceholder: t("journeys_log_placeholder"),
          cancel: t("journeys_cancel"),
          submit: t("journeys_submit"),
          error: t("journeys_error"),
        }}
        onCancel={onCancel}
        onSubmit={(value) => addMutation.mutate(value)}
        submitting={addMutation.isPending}
        submitError={addMutation.isError}
      />
    </div>
  );
}

function gameToGame(journey: PendingJourney): Game {
  return {
    id: journey.igdbId?.toString() ?? "",
    game: journey.game,
    coverUrl: journey.coverUrl,
    genres: journey.genres,
  };
}

function PendingCard({ journey }: { journey: PendingJourney }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [cardState, setCardState] = useState<"collapsed" | "confirming" | "excluding">("collapsed");
  const [initialGame, setInitialGame] = useState<Game | null>(gameToGame(journey));
  const [initialSearchQuery, setInitialSearchQuery] = useState("");

  const dismissMutation = useMutation({
    mutationFn: () => dismissPendingJourney(journey.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-journeys"] }),
  });

  const excludeMutation = useMutation({
    mutationFn: () => excludePendingJourney(journey.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-journeys"] }),
  });

  const confirmMutation = useMutation({
    mutationFn: (input: JourneyFormValue) => confirmPendingJourney(journey.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-journeys"] });
      queryClient.invalidateQueries({ queryKey: ["journeys", "user"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-journeys"] });
    },
  });

  const hintQuery = journey.windowTitle || journey.exeName?.replace(/\.exe$/i, "") || "";

  function openConfirm(searchMode = false) {
    const hasGame = !!journey.game;
    if (searchMode || !hasGame) {
      setInitialGame(null);
      setInitialSearchQuery(hintQuery);
    } else {
      setInitialGame(gameToGame(journey));
      setInitialSearchQuery("");
    }
    setCardState("confirming");
  }

  if (cardState === "confirming") {
    return (
      <div className="rounded-lg border border-primary/30 bg-card p-4">
        <JourneyForm
          initialGame={initialGame}
          initialSearchQuery={initialSearchQuery}
          initialDuration={journey.duration}
          initialDate={journey.startedAt}
          dateFormat="MMM d, yyyy"
          labels={{
            durationLabel: t("journeys_duration_label"),
            durationPlaceholder: t("journeys_duration_placeholder"),
            durationError: t("journeys_duration_error"),
            whenLabel: t("journeys_when_label"),
            todayLabel: t("time_today"),
            pickLabel: t("journeys_pick_date"),
            logLabel: t("journeys_log_label"),
            logOptional: t("journeys_log_optional"),
            logPlaceholder: t("journeys_add_log_placeholder"),
            cancel: t("journeys_cancel"),
            submit: t("journeys_publish"),
            error: t("journeys_error"),
          }}
          onCancel={() => setCardState("collapsed")}
          onSubmit={(value) => confirmMutation.mutate(value)}
          submitting={confirmMutation.isPending}
          submitError={confirmMutation.isError}
          extra={
            <div className="mb-4 text-xs text-muted-foreground">
              {(journey.exeName || journey.windowTitle) && (
                <div className="mb-1">
                  {journey.exeName}
                  {journey.exeName && journey.windowTitle && " · "}
                  {journey.windowTitle && `"${journey.windowTitle}"`}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>{t("journeys_ended", { time: formatJourneyDate(journey.endedAt) })}</span>
              </div>
            </div>
          }
        />
      </div>
    );
  }

  if (cardState === "excluding") {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">{t("journeys_exclude_title", { exe: journey.exeName })}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("journeys_exclude_desc")}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={() => setCardState("collapsed")} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            {t("journeys_cancel")}
          </button>
          <button
            onClick={() => excludeMutation.mutate()}
            className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            {t("journeys_exclude_btn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex gap-4">
        <GameCover game={journey.game} coverUrl={journey.coverUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {journey.game ? (
              <span className="font-bold">
                {journey.game}
                {journey.releaseYear && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">({journey.releaseYear})</span>
                )}
              </span>
            ) : (
              <span className="italic text-muted-foreground">{t("journeys_unknown_game")}</span>
            )}
            <button onClick={() => openConfirm(true)} className="text-xs text-primary underline-offset-2 hover:underline">
              {t("journeys_change")}
            </button>
            {journey.game && (
              <div className="flex flex-wrap gap-1">
                {journey.genres.map((g) => (
                  <GenreChip key={g} genre={g} />
                ))}
              </div>
            )}
          </div>
          {(journey.exeName || journey.windowTitle) && (
            <div className="mb-1 text-xs text-muted-foreground">
              {journey.exeName}
              {journey.exeName && journey.windowTitle && " · "}
              {journey.windowTitle && `"${journey.windowTitle}"`}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>{journey.duration}</span>
            <span className="mx-1 opacity-40">·</span>
            <span>{t("journeys_ended", { time: formatJourneyDate(journey.endedAt) })}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
        {journey.exeName && (
          <button onClick={() => setCardState("excluding")} className="rounded-md px-2 py-1.5 text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground">
            {t("journeys_never_detect")}
          </button>
        )}
        <button onClick={() => dismissMutation.mutate()} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Trash2 size={14} />
          {t("journeys_discard")}
        </button>
        <button onClick={() => openConfirm(false)} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
          <Check size={14} />
          {t("journeys_confirm")}
        </button>
      </div>
    </div>
  );
}


export default function Journeys() {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const { data: currentPlayer } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-journeys"],
    queryFn: getPendingJourneys,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const { data: history = [] } = useQuery({ queryKey: ["journeys", "user"], queryFn: getUserJourneys });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("journeys_title")}</h1>
        {!adding && (
          <button
            onClick={() => currentPlayer ? setAdding(true) : setShowSignIn(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={14} />
            {t("journeys_add")}
          </button>
        )}
      </div>

      <ClientHint />

      {adding && <AddJourneyForm onAdd={() => setAdding(false)} onCancel={() => setAdding(false)} />}

      {pending.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("journeys_pending")}
            </h2>
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pending.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {pending.map((j) => (
              <PendingCard key={j.id} journey={j} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("journeys_history")}
        </h2>
        {history.length > 0 ? (
          <div className="flex flex-col gap-3">
            {history.map((j) => <JourneyCard key={j.id} journey={j} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("journeys_empty")}</p>
        )}
      </section>

      <div className="h-8" />
      {showSignIn && <SignInPromptModal onClose={() => setShowSignIn(false)} />}
    </div>
  );
}
