// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { MonitorDown, Search } from "lucide-react";
import AvatarEditor from "@/components/AvatarEditor";
import { useNavigate, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer, signIn, signOut, deleteAccount, updateNotificationPreferences } from "@/services/auth";
import { getExclusions, removeExclusion, getGameHints, removeGameHint, updateGameHint, getInclusions, addInclusion, removeInclusion } from "@/services/settings";
import { searchGames } from "@/services/games";
import { useLocale, SUPPORTED_LOCALES } from "@/hooks/useLocale";

const LOCALE_LABEL_KEYS: Record<string, string> = {
  en: "settings_language_en",
  es: "settings_language_es",
};

export default function Settings() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: player, isLoading: playerLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });
  const { data: exclusions = [] } = useQuery({ queryKey: ["settings", "exclusions"], queryFn: getExclusions });
  const { data: hints = [] } = useQuery({ queryKey: ["settings", "hints"], queryFn: getGameHints });
  const { data: inclusions = [] } = useQuery({ queryKey: ["settings", "inclusions"], queryFn: getInclusions });

  const [confirmingExe, setConfirmingExe] = useState<string | null>(null);
  const [confirmingHintExe, setConfirmingHintExe] = useState<string | null>(null);
  const [editingHintExe, setEditingHintExe] = useState<string | null>(null);
  const [editQuery, setEditQuery] = useState("");
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteHandleInput, setDeleteHandleInput] = useState("");
  const [addInclusionInput, setAddInclusionInput] = useState("");
  const [confirmingInclusionExe, setConfirmingInclusionExe] = useState<string | null>(null);

  const { data: editGameResults = [] } = useQuery({
    queryKey: ["games", "search", editQuery],
    queryFn: () => searchGames(editQuery),
    enabled: editingHintExe !== null && editQuery.length >= 2,
  });

  const removeExclusionMutation = useMutation({
    mutationFn: removeExclusion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "exclusions"] });
      setConfirmingExe(null);
    },
  });

  const addInclusionMutation = useMutation({
    mutationFn: addInclusion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "inclusions"] });
      setAddInclusionInput("");
    },
  });

  const removeInclusionMutation = useMutation({
    mutationFn: removeInclusion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "inclusions"] });
      setConfirmingInclusionExe(null);
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
    mutationFn: ({ exeName, igdbId }: { exeName: string; igdbId: number }) =>
      updateGameHint(exeName, igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "hints"] });
      setEditingHintExe(null);
      setEditQuery("");
    },
  });

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => navigate("/login", { replace: true }),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
  });

  const updatePrefsMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  if (playerLoading) return null;

  if (!player) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
        <img src="/logo.png" alt="Yurnik" className="w-20" />
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("settings_title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("settings_signin_hint")}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => signIn()}
            className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("about_cta_primary")}
          </button>
          <Link
            to="/explore"
            className="rounded-md border border-border px-6 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            {t("home_explore_cta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("settings_title")}</h1>

      {/* Account */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings_account")}
        </h2>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarEditor
                player={player}
                size="sm"
                onChanged={() => queryClient.invalidateQueries({ queryKey: ["auth", "me"] })}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{player.name}</span>
                </div>
                <div className="truncate text-sm text-muted-foreground">@{player.handle}</div>
              </div>
            </div>
            {confirmingSignOut ? (
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <span className="text-sm text-muted-foreground">{t("settings_signout_confirm")}</span>
                <button
                  onClick={() => setConfirmingSignOut(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {t("settings_cancel")}
                </button>
                <button
                  onClick={() => { signOutMutation.mutate(); setConfirmingSignOut(false); }}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  {t("settings_signout")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingSignOut(true)}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10 sm:ml-auto"
              >
                {t("settings_signout")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Language */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings_language")}
        </h2>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setLocale(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                locale === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {t("settings_language_auto")}
            </button>
            {SUPPORTED_LOCALES.map((lang) => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  locale === lang
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {t(LOCALE_LABEL_KEYS[lang])}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings_notifications")}
        </h2>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{t("settings_updates_notifications")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("settings_updates_notifications_desc")}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={player?.notificationPreferences?.updates ?? true}
                aria-label={t("settings_updates_notifications")}
                onClick={() => updatePrefsMutation.mutate({ 
                  updates: !(player?.notificationPreferences?.updates ?? true), 
                  notifications: player?.notificationPreferences?.notifications ?? true 
                })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  (player?.notificationPreferences?.updates ?? true) ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
                    (player?.notificationPreferences?.updates ?? true) ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{t("settings_notifications_notifications")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("settings_notifications_notifications_desc")}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={player?.notificationPreferences?.notifications ?? true}
                aria-label={t("settings_notifications_notifications")}
                onClick={() => updatePrefsMutation.mutate({ 
                  updates: player?.notificationPreferences?.updates ?? true, 
                  notifications: !(player?.notificationPreferences?.notifications ?? true) 
                })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  (player?.notificationPreferences?.notifications ?? true) ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
                    (player?.notificationPreferences?.notifications ?? true) ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Windows Agent */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings_windows_agent")}
        </h2>
        <div className="space-y-3">

          {/* Download */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <MonitorDown size={18} className="shrink-0 text-muted-foreground" />
                <div className="flex flex-col">
                  <p className="text-sm text-muted-foreground">
                    {t("settings_agent_desc")}
                  </p>
                  <p className="text-xs text-muted-foreground opacity-80 mt-1">
                    {t("settings_agent_sync_desc")}
                  </p>
                </div>
              </div>
              <a
                href="https://github.com/juan-medina/yurnik/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:ml-auto"
              >
                {t("settings_download")}
              </a>
            </div>
          </div>

          {/* Game hints */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold">{t("settings_game_hints")}</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {t("settings_hints_desc")}
            </p>
            {hints.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("settings_no_hints")}</p>
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
                          placeholder={t("settings_search_game")}
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
                              onClick={() => updateHintMutation.mutate({ exeName: hint.exeName, igdbId: parseInt(g.id) })}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10"
                            >
                              {g.game}
                              {g.releaseYear && (
                                <span className="text-xs text-muted-foreground">({g.releaseYear})</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {editQuery.length >= 2 && editGameResults.length === 0 && (
                        <p className="mb-1 text-xs text-muted-foreground">
                          {t("settings_no_games", { query: editQuery })}
                        </p>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={() => { setEditingHintExe(null); setEditQuery(""); }}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {t("settings_cancel")}
                        </button>
                      </div>
                    </li>
                  ) : confirmingHintExe === hint.exeName ? (
                    <li
                      key={hint.exeName}
                      className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {t("settings_remove_hint", { exe: hint.exeName })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmingHintExe(null)}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {t("settings_cancel")}
                        </button>
                        <button
                          onClick={() => removeHintMutation.mutate(hint.exeName)}
                          className="rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                        >
                          {t("settings_remove")}
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
                          aria-label={t("settings_edit_hint_label", { exe: hint.exeName })}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {t("settings_edit")}
                        </button>
                        <button
                          onClick={() => setConfirmingHintExe(hint.exeName)}
                          aria-label={t("settings_remove_hint_label", { exe: hint.exeName })}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {t("settings_remove")}
                        </button>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          {/* Exclusions */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold">{t("settings_excluded_exes")}</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {t("settings_excluded_desc")}
            </p>
            {exclusions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("settings_no_exclusions")}</p>
            ) : (
              <ul className="space-y-2">
                {exclusions.map((exc) =>
                  confirmingExe === exc.exeName ? (
                    <li
                      key={exc.exeName}
                      className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {t("settings_remove_exe", { exe: exc.exeName })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmingExe(null)}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {t("settings_cancel")}
                        </button>
                        <button
                          onClick={() => removeExclusionMutation.mutate(exc.exeName)}
                          className="rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                        >
                          {t("settings_remove")}
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
                        aria-label={t("settings_remove_label", { exe: exc.exeName })}
                        className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {t("settings_remove")}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          {/* Inclusions */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold">{t("settings_included_exes")}</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {t("settings_included_desc")}
            </p>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (addInclusionInput.trim()) {
                  addInclusionMutation.mutate(addInclusionInput.trim());
                }
              }}
              className="mb-4 flex gap-2"
            >
              <input
                type="text"
                value={addInclusionInput}
                onChange={(e) => setAddInclusionInput(e.target.value)}
                placeholder={t("settings_add_inclusion_placeholder")}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!addInclusionInput.trim() || addInclusionMutation.isPending}
                className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("settings_add_inclusion")}
              </button>
            </form>

            {inclusions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("settings_no_inclusions")}</p>
            ) : (
              <ul className="space-y-2">
                {inclusions.map((inc) =>
                  confirmingInclusionExe === inc.exeName ? (
                    <li
                      key={inc.exeName}
                      className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {t("settings_remove_exe", { exe: inc.exeName })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmingInclusionExe(null)}
                          className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {t("settings_cancel")}
                        </button>
                        <button
                          onClick={() => removeInclusionMutation.mutate(inc.exeName)}
                          className="rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                        >
                          {t("settings_remove")}
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={inc.exeName}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span className="font-mono text-sm">{inc.exeName}</span>
                      <button
                        onClick={() => setConfirmingInclusionExe(inc.exeName)}
                        aria-label={t("settings_remove_label", { exe: inc.exeName })}
                        className="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {t("settings_remove")}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings_danger_zone")}
        </h2>
        <div className="rounded-lg border border-destructive/30 bg-card p-5">
          <h3 className="font-semibold">{t("settings_delete_account")}</h3>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            {t("settings_delete_account_desc")}
          </p>
          {confirmingDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("settings_delete_account_confirm", { handle: player.handle })}
              </p>
              <input
                type="text"
                value={deleteHandleInput}
                onChange={(e) => setDeleteHandleInput(e.target.value)}
                placeholder={player.handle}
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setConfirmingDelete(false); setDeleteHandleInput(""); }}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {t("settings_cancel")}
                </button>
                <button
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteHandleInput !== player.handle || deleteAccountMutation.isPending}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("settings_delete_account_button")}
                </button>
              </div>
              {deleteAccountMutation.isError && (
                <p className="text-sm text-destructive">{t("settings_delete_account_error")}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              {t("settings_delete_account_button")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
