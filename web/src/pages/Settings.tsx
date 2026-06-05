// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { MonitorDown, Search, ShieldCheck } from "lucide-react";
import AvatarEditor from "@/components/AvatarEditor";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer, signOut } from "@/services/auth";
import { listAdminUsers, impersonateUser } from "@/services/admin";
import { getExclusions, removeExclusion, getGameHints, removeGameHint, updateGameHint } from "@/services/settings";
import { searchGames } from "@/services/games";
import { avatarSrc, initials } from "@/lib/display";
import { useLocale, SUPPORTED_LOCALES } from "@/hooks/useLocale";
import type { Player } from "@/models/player";

const LOCALE_LABEL_KEYS: Record<string, string> = {
  en: "settings_language_en",
  es: "settings_language_es",
};

export default function Settings() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: player } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });
  const { data: adminUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: listAdminUsers,
    enabled: player?.isAdmin === true,
  });
  const { data: exclusions = [] } = useQuery({ queryKey: ["settings", "exclusions"], queryFn: getExclusions });
  const { data: hints = [] } = useQuery({ queryKey: ["settings", "hints"], queryFn: getGameHints });

  const [confirmingExe, setConfirmingExe] = useState<string | null>(null);
  const [confirmingHintExe, setConfirmingHintExe] = useState<string | null>(null);
  const [editingHintExe, setEditingHintExe] = useState<string | null>(null);
  const [editQuery, setEditQuery] = useState("");
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

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

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => impersonateUser(userId),
    onSuccess: () => { window.location.href = "/"; },
  });

  if (!player) return null;

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
                  {player.isAdmin && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <ShieldCheck size={11} />
                      {t("settings_admin_badge")}
                    </span>
                  )}
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
                <p className="text-sm text-muted-foreground">
                  {t("settings_agent_desc")}
                </p>
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

        </div>
      </section>

      {/* Admin — impersonation */}
      {player.isAdmin && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("settings_admin_section")}
          </h2>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold">{t("settings_impersonate")}</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {t("settings_impersonate_desc")}
            </p>
            {!adminUsers || adminUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("settings_no_users")}</p>
            ) : (
              <ul className="space-y-2">
                {adminUsers
                  .filter((u: Player) => u.id !== player.id)
                  .map((u: Player) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={avatarSrc(u)}
                          alt={u.name}
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            target.nextElementSibling?.removeAttribute("hidden");
                          }}
                        />
                        <div
                          hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: u.color }}
                        >
                          {initials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{u.name}</span>
                            {u.isAdmin && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                <ShieldCheck size={10} />
                                {t("settings_admin_badge")}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">@{u.handle}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => impersonateMutation.mutate(u.id)}
                        disabled={impersonateMutation.isPending}
                        className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                      >
                        {t("settings_impersonate_btn")}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
