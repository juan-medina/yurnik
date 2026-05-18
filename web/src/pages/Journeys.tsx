// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Clock, Heart, MonitorDown, Plus, Search, Trash2, X } from "lucide-react";
import {
  GAME_LIBRARY,
  MOCK_PENDING_SESSIONS,
  MY_PLAYER_ID,
  PLAYERS,
  SESSIONS,
  type MockGameResult,
  type MockPendingSession,
  type MockSession,
} from "@/lib/mock";

function GameCover({
  coverColor,
  coverAccent,
  game,
  size,
}: {
  coverColor: string;
  coverAccent: string;
  game: string;
  size: "sm" | "md";
}) {
  const dims = size === "sm" ? "h-10 w-10 text-lg" : "h-16 w-16 text-2xl";
  return (
    <div
      className={`relative ${dims} shrink-0 overflow-hidden rounded-md`}
      style={{ backgroundColor: coverColor }}
    >
      <span
        className="absolute inset-0 flex items-center justify-center font-bold"
        style={{ color: coverAccent }}
      >
        {game[0]}
      </span>
    </div>
  );
}

function GameSelector({
  value,
  onChange,
}: {
  value: MockGameResult | null;
  onChange: (game: MockGameResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(value === null);

  const results =
    searching && query.length >= 2
      ? GAME_LIBRARY.filter((g) => g.game.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
      : [];

  if (!searching && value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
        <GameCover
          coverColor={value.coverColor}
          coverAccent={value.coverAccent}
          game={value.game}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{value.game}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {value.genres.map((g) => (
              <span
                key={g}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            setSearching(true);
            setQuery("");
          }}
          className="shrink-0 text-xs text-primary underline-offset-2 hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a game…"
          autoFocus
          className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-1 divide-y divide-border overflow-hidden rounded-md border border-border">
          {results.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onChange(g);
                setSearching(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/10"
            >
              <GameCover
                coverColor={g.coverColor}
                coverAccent={g.coverAccent}
                game={g.game}
                size="sm"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium">{g.game}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {g.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && results.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No games found for &ldquo;{query}&rdquo;
        </p>
      )}
    </div>
  );
}

function ClientHint() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <MonitorDown size={15} className="mt-0.5 shrink-0" />
      <p className="flex-1">
        Automatically record your game sessions by{" "}
        <a href="#" className="font-medium text-foreground underline-offset-2 hover:underline">
          installing the Windows client
        </a>
        . Sessions will appear here for you to confirm.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-0.5 transition-colors hover:bg-accent hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function AddJourneyForm({
  onAdd,
  onCancel,
}: {
  onAdd: (s: MockSession) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<MockGameResult | null>(null);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [log, setLog] = useState("");

  const durationSet = hours > 0 || minutes > 0;
  const canSubmit = selected !== null && durationSet;

  function formatDuration(): string {
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  function handleAdd() {
    if (!selected) return;
    const me = PLAYERS.find((p) => p.id === MY_PLAYER_ID)!;
    onAdd({
      id: `m-${Date.now()}`,
      player: me,
      game: selected.game,
      coverColor: selected.coverColor,
      coverAccent: selected.coverAccent,
      genres: selected.genres,
      duration: formatDuration(),
      timestamp: "just now",
      log: log.trim() || undefined,
      likes: 0,
    });
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Log a journey</h2>
        <button
          onClick={onCancel}
          aria-label="Close"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mb-4">
        <GameSelector value={selected} onChange={setSelected} />
      </div>

      <div className="mb-3">
        <label className="mb-2 block text-xs font-medium text-muted-foreground">Duration</label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <input
              aria-label="Hours"
              type="number"
              min={0}
              max={99}
              value={hours}
              onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-14 rounded-md border border-border bg-background px-2 py-2 text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              aria-label="Minutes"
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) =>
                setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))
              }
              className="w-14 rounded-md border border-border bg-background px-2 py-2 text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">m</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Log <span className="font-normal">(optional)</span>
        </label>
        <textarea
          value={log}
          onChange={(e) => setLog(e.target.value)}
          placeholder="How did it go?"
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
        <button
          disabled={!canSubmit}
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
        >
          Log journey
        </button>
      </div>
    </div>
  );
}

function sessionToGameResult(session: MockPendingSession): MockGameResult {
  return {
    id: session.game,
    game: session.game,
    coverColor: session.coverColor,
    coverAccent: session.coverAccent,
    genres: session.genres,
  };
}

function PendingCard({
  session,
  onDismiss,
}: {
  session: MockPendingSession;
  onDismiss: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [game, setGame] = useState<MockGameResult | null>(sessionToGameResult(session));
  const [log, setLog] = useState("");

  function openConfirm(searchMode = false) {
    setGame(searchMode ? null : sessionToGameResult(session));
    setConfirming(true);
  }

  function cancelConfirm() {
    setConfirming(false);
    setGame(sessionToGameResult(session));
    setLog("");
  }

  if (confirming) {
    return (
      <div className="rounded-lg border border-primary/30 bg-card p-4">
        <div className="mb-3">
          <GameSelector value={game} onChange={setGame} />
        </div>
        <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} />
          <span>{session.duration}</span>
          <span className="mx-1 opacity-40">·</span>
          <span>ended {session.timestamp}</span>
        </div>
        <textarea
          value={log}
          onChange={(e) => setLog(e.target.value)}
          placeholder="Add a log entry… (optional)"
          rows={3}
          className="mt-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={cancelConfirm}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Check size={14} />
            Publish journey
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex gap-4">
        <GameCover
          coverColor={session.coverColor}
          coverAccent={session.coverAccent}
          game={session.game}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-bold">{session.game}</span>
            <button
              onClick={() => openConfirm(true)}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Change
            </button>
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
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>{session.duration}</span>
            <span className="mx-1 opacity-40">·</span>
            <span>ended {session.timestamp}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Trash2 size={14} />
          Discard
        </button>
        <button
          onClick={() => openConfirm(false)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Check size={14} />
          Confirm
        </button>
      </div>
    </div>
  );
}

function HistoryCard({ session }: { session: MockSession }) {
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
      <GameCover
        coverColor={session.coverColor}
        coverAccent={session.coverAccent}
        game={session.game}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1">
          <span className="text-xs text-muted-foreground">{session.timestamp}</span>
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

export default function Journeys() {
  const [pending, setPending] = useState(MOCK_PENDING_SESSIONS);
  const [history, setHistory] = useState<MockSession[]>(
    SESSIONS.filter((s) => s.player.id === MY_PLAYER_ID),
  );
  const [adding, setAdding] = useState(false);

  function dismiss(id: string) {
    setPending((prev) => prev.filter((s) => s.id !== id));
  }

  function handleAdd(session: MockSession) {
    setHistory((prev) => [session, ...prev]);
    setAdding(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journeys</h1>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={14} />
            Add journey
          </button>
        )}
      </div>

      <ClientHint />

      {adding && <AddJourneyForm onAdd={handleAdd} onCancel={() => setAdding(false)} />}

      {pending.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pending
            </h2>
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pending.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {pending.map((s) => (
              <PendingCard key={s.id} session={s} onDismiss={() => dismiss(s.id)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          History
        </h2>
        {history.length > 0 ? (
          <div className="flex flex-col gap-3">
            {history.map((s) => (
              <HistoryCard key={s.id} session={s} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No confirmed journeys yet.</p>
        )}
      </section>

      <div className="h-8" />
    </div>
  );
}
