// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import {
  MOCK_EXCLUSIONS,
  MOCK_GAME_HINTS,
  MY_PLAYER,
  avatarSrc,
  initials,
  type MockExclusion,
  type MockGameHint,
} from "@/lib/mock";

export default function Settings() {
  const [exclusions, setExclusions] = useState<MockExclusion[]>([...MOCK_EXCLUSIONS]);
  const [hints, setHints] = useState<MockGameHint[]>([...MOCK_GAME_HINTS]);
  const [confirmingExe, setConfirmingExe] = useState<string | null>(null);
  const [confirmingHintExe, setConfirmingHintExe] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  function removeExclusion(exeName: string) {
    setExclusions((prev) => prev.filter((e) => e.exeName !== exeName));
    setConfirmingExe(null);
  }

  function removeHint(exeName: string) {
    setHints((prev) => prev.filter((h) => h.exeName !== exeName));
    setConfirmingHintExe(null);
  }

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
                src={avatarSrc(MY_PLAYER)}
                alt={MY_PLAYER.name}
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
                style={{ backgroundColor: MY_PLAYER.color }}
              >
                {initials(MY_PLAYER.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{MY_PLAYER.name}</div>
                <div className="truncate text-sm text-muted-foreground">@{MY_PLAYER.handle}</div>
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
                  onClick={() => setConfirmingSignOut(false)}
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
                          onClick={() => removeExclusion(exc.exeName)}
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
                  confirmingHintExe === hint.exeName ? (
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
                          onClick={() => removeHint(hint.exeName)}
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
                      <button
                        onClick={() => setConfirmingHintExe(hint.exeName)}
                        aria-label={`Remove hint for ${hint.exeName}`}
                        className="ml-2 shrink-0 rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Remove
                      </button>
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
