// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentPlayer, signOut } from "@/services/auth";
import { getExclusions, removeExclusion, getGameHints, removeGameHint, updateGameHint } from "@/services/settings";
import { getGameLibrary } from "@/services/games";
import { avatarSrc, initials } from "@/lib/display";

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: player } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });
  const { data: exclusions = [] } = useQuery({ queryKey: ["settings", "exclusions"], queryFn: getExclusions });
  const { data: hints = [] } = useQuery({ queryKey: ["settings", "hints"], queryFn: getGameHints });
  const { data: games = [] } = useQuery({ queryKey: ["games"], queryFn: getGameLibrary });

  const [confirmingExe, setConfirmingExe] = useState<string | null>(null);
  const [confirmingHintExe, setConfirmingHintExe] = useState<string | null>(null);
  const [editingHintExe, setEditingHintExe] = useState<string | null>(null);
  const [editQuery, setEditQuery] = useState("");
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const removeExclusionMutation = useMutation({
    mutationFn: removeExclusion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "exclusions"] });
      setConfirmingExe(null);
    },
  });

  const removeHintMutation = useMutation({
    mutationFn: removeGameHint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "hints"] });
      setConfirmingHintExe(null);
    },
  });

  const updateHintMutation = useMutation({
    mutationFn: ({ exeName, game }: { exeName: string; game: string }) => updateGameHint(exeName, game),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "hints"] });
      setEditingHintExe(null);
      setEditQuery("");
    },
  });

  const signOutMutation = useMutation({ mutationFn: signOut });

  const editGameResults =
    editingHintExe !== null && editQuery.length >= 2
      ? games.filter((g) => g.game.toLowerCase().includes(editQuery.toLowerCase())).slice(0, 5)
      : [];

  if (!player) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Account */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h2>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={avatarSrc(player)}
                alt={player.name}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  target.nextElementSibling?.removeAttribute("hidden");
                }}
              />
              <div
                hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: player.color }}
              >
                {initials(player.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{player.name}</div>
                <div className="truncate text-sm text-muted-foreground">@{player.handle}</div>
              </div>
            </div>
            {confirmingSignOut ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-muted-foreground">Sign out?</span>
                <button
                  onClick={() => setConfirmingSignOut(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { signOutMutation.mutate(); setConfirmingSignOut(false); }}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingSignOut(true)}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Windows Agent */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Windows Agent
        </h2>
        <div className="space-y-3">

          {/* Exclusions */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold">Excluded executables</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              These executables will never trigger a session.
            </p>
            {exclusions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exclusions yet.</p>
            ) : (
              <ul className="space-y-2">
                {exclusions.map((exc) =>
                  confirmingExe === exc.exeName ? (
                    <li
                      key={exc.exeName}
                      className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        Remove <span className="font-mono">{exc.exeName}</span>?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmingExe(null)}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => removeExclusionMutation.mutate(exc.exeName)}
                          className="rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={exc.exeName}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span className="font-mono text-sm">{exc.exeName}</span>
                      <button
                        onClick={() => setConfirmingExe(exc.exeName)}
                        aria-label={`Remove ${exc.exeName}`}
                        className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Remove
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          {/* Game hints */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold">Game hints</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Learned matches between executables and games. Remove a hint to let the agent
              re-detect from the window title.
            </p>
            {hints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hints yet.</p>
            ) : (
              <ul className="space-y-2">
                {hints.map((hint) =>
                  editingHintExe === hint.exeName ? (
                    <li
                      key={hint.exeName}
                      className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
                    >
                      <div className="mb-2 flex items-center gap-1.5 text-sm">
                        <span className="font-mono">{hint.exeName}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="truncate text-muted-foreground">{hint.game}</span>
                      </div>
                      <div className="relative mb-1">
                        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={editQuery}
                          onChange={(e) => setEditQuery(e.target.value)}
                          placeholder="Search for a game…"
                          autoFocus
                          className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      {editGameResults.length > 0 && (
                        <div className="mb-1 divide-y divide-border overflow-hidden rounded-md border border-border">
                          {editGameResults.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => updateHintMutation.mutate({ exeName: hint.exeName, game: g.game })}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10"
                            >
                              {g.game}
                            </button>
                          ))}
                        </div>
                      )}
                      {editQuery.length >= 2 && editGameResults.length === 0 && (
                        <p className="mb-1 text-xs text-muted-foreground">
                          No games found for &ldquo;{editQuery}&rdquo;
                        </p>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={() => { setEditingHintExe(null); setEditQuery(""); }}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  ) : confirmingHintExe === hint.exeName ? (
                    <li
                      key={hint.exeName}
                      className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        Remove hint for <span className="font-mono">{hint.exeName}</span>?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmingHintExe(null)}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => removeHintMutation.mutate(hint.exeName)}
                          className="rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={hint.exeName}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="font-mono">{hint.exeName}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="truncate">{hint.game}</span>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => { setConfirmingHintExe(null); setEditingHintExe(hint.exeName); setEditQuery(""); }}
                          aria-label={`Edit hint for ${hint.exeName}`}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmingHintExe(hint.exeName)}
                          aria-label={`Remove hint for ${hint.exeName}`}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

        </div>
      </section>
    </div>
  );
}
