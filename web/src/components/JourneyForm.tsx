// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import type { ReactNode } from "react";
import { GameSelector } from "@/components/GameSelector";
import { DurationField, JourneyLogField, PlayedAtField } from "@/components/JourneyFormFields";
import { parseDuration } from "@/lib/duration";
import type { Game } from "@/models/game";

export type JourneyFormValue = {
  igdbId?: number;
  game: string;
  coverUrl?: string;
  genres: string[];
  durationSeconds: number;
  playedAt: Date;
  log?: string;
};

export type JourneyFormLabels = {
  durationLabel: string;
  durationPlaceholder: string;
  durationError: string;
  whenLabel: string;
  todayLabel: string;
  pickLabel: string;
  logLabel: string;
  logOptional?: string;
  logPlaceholder: string;
  cancel: string;
  submit: string;
  error: string;
};

type JourneyFormProps = {
  initialGame: Game | null;
  initialSearchQuery?: string;
  initialDuration?: string;
  initialDate?: Date;
  initialLog?: string;
  dateFormat: string;
  labels: JourneyFormLabels;
  onCancel: () => void;
  onSubmit: (value: JourneyFormValue) => void;
  submitting: boolean;
  submitError: boolean;
  /** Seconds remaining before the user may submit again, from a 429 Retry-After. */
  cooldownSeconds?: number;
  cooldownLabel?: (seconds: number) => string;
  extra?: ReactNode;
};

// JourneyForm is the single shared form for adding, editing, and confirming
// a journey — all three flows let the user set the game, duration, played
// date, and log; only what happens on submit differs (insert, update, or
// confirm a pending journey).
export function JourneyForm({
  initialGame,
  initialSearchQuery,
  initialDuration = "",
  initialDate,
  initialLog = "",
  dateFormat,
  labels,
  onCancel,
  onSubmit,
  submitting,
  submitError,
  cooldownSeconds = 0,
  cooldownLabel,
  extra,
}: JourneyFormProps) {
  const [game, setGame] = useState<Game | null>(initialGame);
  const [durationInput, setDurationInput] = useState(initialDuration);
  const [pickedDate, setPickedDate] = useState<Date>(initialDate ?? new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [log, setLog] = useState(initialLog);

  const parsedDuration = parseDuration(durationInput);
  const durationInvalid = durationInput.trim() !== "" && parsedDuration === null;
  const canSubmit = !!game?.game && parsedDuration !== null;

  function handleSubmit() {
    if (!game?.game || !parsedDuration) return;
    onSubmit({
      igdbId: game.id ? parseInt(game.id) : undefined,
      game: game.game,
      coverUrl: game.coverUrl,
      genres: game.genres,
      durationSeconds: (parsedDuration.hours * 3600) + (parsedDuration.minutes * 60),
      playedAt: pickedDate,
      log: log.trim() || undefined,
    });
  }

  return (
    <div>
      <div className="mb-4">
        <GameSelector value={game} onChange={setGame} initialQuery={initialSearchQuery} />
      </div>
      {extra}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DurationField
          value={durationInput}
          onChange={setDurationInput}
          invalid={durationInvalid}
          label={labels.durationLabel}
          placeholder={labels.durationPlaceholder}
          errorText={labels.durationError}
        />
        <PlayedAtField
          label={labels.whenLabel}
          pickedDate={pickedDate}
          onPickedDateChange={setPickedDate}
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
          todayLabel={labels.todayLabel}
          pickLabel={labels.pickLabel}
          dateFormat={dateFormat}
        />
      </div>
      <div className="mb-4">
        <JourneyLogField
          value={log}
          onChange={setLog}
          label={labels.logLabel}
          optionalLabel={labels.logOptional}
          placeholder={labels.logPlaceholder}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          {labels.cancel}
        </button>
        <button
          disabled={!canSubmit || submitting || cooldownSeconds > 0}
          onClick={handleSubmit}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {cooldownSeconds > 0 && cooldownLabel ? cooldownLabel(cooldownSeconds) : labels.submit}
        </button>
      </div>
      {submitError && (
        <p className="mt-2 text-xs text-destructive">{labels.error}</p>
      )}
    </div>
  );
}
