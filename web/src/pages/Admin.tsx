// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { listReports } from "@/services/reports";
import { suspendUser, unsuspendUser, listSuspendedUsers, resetProfile, adminDeleteJourneyLog, adminDeleteComment, getUserStats, listRecentUsers } from "@/services/admin";
import { getCurrentPlayer } from "@/services/auth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { initials } from "@/lib/display";
import NotFound from "@/pages/NotFound";
import type { AdminReport, ReportReason, ReportTargetType, SuspendedUser, RecentUser } from "@/models";

const REASON_KEYS: Record<ReportReason, string> = {
  spam: "admin_report_reason_spam",
  harassment: "admin_report_reason_harassment",
  hate_speech: "admin_report_reason_hate_speech",
  explicit: "admin_report_reason_explicit",
  impersonation: "admin_report_reason_impersonation",
  private_info: "admin_report_reason_private_info",
  other: "admin_report_reason_other",
};

const TARGET_KEYS: Record<ReportTargetType, string> = {
  journey_log: "admin_target_journey_log",
  comment: "admin_target_comment",
  profile: "admin_target_profile",
};

function targetHref(report: AdminReport): string {
  switch (report.targetType) {
    case "journey_log":
      return `/journey/${report.targetId}`;
    case "comment":
      return `/journey/${report.contextId}#comment-${report.targetId}`;
    case "profile":
      return `/player/${report.targetHandle ?? report.targetId}`;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ src, name, color, size = 8 }: { src?: string; name: string; color: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const cls = `h-${size} w-${size} rounded-full`;
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        className={`${cls} object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={`${cls} flex items-center justify-center text-xs font-bold text-white`}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </div>
  );
}

function ReportsTab() {
  const { t } = useTranslation();
  const [allReports, setAllReports] = useState<AdminReport[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: reportsPage, isLoading } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: () => listReports(),
  });

  useEffect(() => {
    if (reportsPage) {
      setAllReports(reportsPage.reports);
      setNextCursor(reportsPage.nextCursor);
    }
  }, [reportsPage]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listReports(nextCursor);
      setAllReports((prev) => [...prev, ...page.reports]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (isLoading) return null;
  if (allReports.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        {t("admin_reports_empty")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border">
      {allReports.map((rep) => (
        <div key={rep.id} className="flex items-start gap-3 px-4 py-3">
          <Link to={`/player/${rep.reporterHandle}`} className="shrink-0">
            <Avatar src={rep.reporterAvatar} name={rep.reporterName} color={rep.reporterColor} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link to={`/player/${rep.reporterHandle}`} className="text-sm font-semibold hover:underline">
                {rep.reporterName}
              </Link>
              <span className="text-xs text-muted-foreground">@{rep.reporterHandle}</span>
              <span className="text-xs text-muted-foreground">→</span>
              <span className="text-sm font-medium">{t(TARGET_KEYS[rep.targetType])}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                {t(REASON_KEYS[rep.reason])}
              </span>
            </div>
            {rep.note && (
              <p className="mt-1 text-xs text-muted-foreground break-words">"{rep.note}"</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground/60">{formatDate(rep.createdAt)}</p>
          </div>
          <Link
            to={targetHref(rep)}
            aria-label={t("admin_view_target")}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink size={15} />
          </Link>
        </div>
      ))}
      {nextCursor && (
        <div className="px-4 py-3">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            {loadingMore ? t("loading") : t("load_more")}
          </button>
        </div>
      )}
    </div>
  );
}

function SuspendedTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "suspended"],
    queryFn: listSuspendedUsers,
  });

  const unsuspend = useMutation({
    mutationFn: unsuspendUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "suspended"] });
    },
  });

  if (isLoading) return null;
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        {t("admin_suspended_empty")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border">
      {users.map((u: SuspendedUser) => (
        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
          <Link to={`/player/${u.handle}`} className="shrink-0">
            <Avatar src={u.avatarUrl} name={u.name} color={u.color} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link to={`/player/${u.handle}`} className="text-sm font-semibold hover:underline">
                {u.name}
              </Link>
              <span className="text-xs text-muted-foreground">@{u.handle}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground/60">{t("admin_suspended_since")} {formatDate(u.suspendedAt)}</p>
          </div>
          <button
            onClick={() => unsuspend.mutate(u.id)}
            disabled={unsuspend.isPending}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("admin_unsuspend")}
          </button>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const { t } = useTranslation();
  const [allUsers, setAllUsers] = useState<RecentUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["admin", "user-stats"],
    queryFn: getUserStats,
  });

  const { data: usersPage, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listRecentUsers(),
  });

  useEffect(() => {
    if (usersPage) {
      setAllUsers(usersPage.users);
      setNextCursor(usersPage.nextCursor);
    }
  }, [usersPage]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listRecentUsers(nextCursor);
      setAllUsers((prev) => [...prev, ...page.users]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <div className="text-lg font-bold">{stats.today}</div>
            <div className="text-xs text-muted-foreground">{t("admin_users_today")}</div>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <div className="text-lg font-bold">{stats.week}</div>
            <div className="text-xs text-muted-foreground">{t("admin_users_week")}</div>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">{t("admin_users_total")}</div>
          </div>
        </div>
      )}

      {isLoading ? null : allUsers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          {t("admin_users_empty")}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {allUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Link to={`/player/${u.handle}`} className="shrink-0">
                <Avatar src={u.avatarUrl} name={u.name} color={u.color} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Link to={`/player/${u.handle}`} className="text-sm font-semibold hover:underline">
                    {u.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">@{u.handle}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground/60">{t("admin_users_joined")} {formatDate(u.createdAt)}</p>
              </div>
            </div>
          ))}
          {nextCursor && (
            <div className="px-4 py-3">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                {loadingMore ? t("loading") : t("load_more")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Tab = "reports" | "suspended" | "users";

export default function Admin() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("reports");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  usePageTitle(t("admin_title"));

  const { data: currentPlayer, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  const suspendMutation = useMutation({
    mutationFn: suspendUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "suspended"] });
      void queryClient.invalidateQueries({ queryKey: ["player-profile"] });
      void navigate("/admin", { replace: true });
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["player-profile"] });
      void navigate("/admin", { replace: true });
    },
  });

  const deleteJourneyLogMutation = useMutation({
    mutationFn: adminDeleteJourneyLog,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journey", confirmDeleteJourneyLogId] });
      void navigate("/admin", { replace: true });
    },
  });

  const confirmSuspendId = searchParams.get("confirm_suspend");
  const confirmSuspendName = searchParams.get("suspend_name") ?? "";
  const confirmResetId = searchParams.get("confirm_reset");
  const confirmResetName = searchParams.get("reset_name") ?? "";
  const confirmDeleteJourneyLogId = searchParams.get("confirm_delete_journey_log");
  const confirmDeleteCommentId = searchParams.get("confirm_delete_comment");
  const fromJourneyId = searchParams.get("from_journey");

  const deleteCommentMutation = useMutation({
    mutationFn: adminDeleteComment,
    onSuccess: () => {
      if (fromJourneyId) {
        void queryClient.invalidateQueries({ queryKey: ["journey", fromJourneyId, "comments"] });
      }
      void navigate(fromJourneyId ? `/journey/${fromJourneyId}` : "/admin", { replace: true });
    },
  });

  if (isLoading) return null;
  if (!currentPlayer?.isAdmin) return <NotFound />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "reports", label: t("admin_tab_reports") },
    { id: "suspended", label: t("admin_tab_suspended") },
    { id: "users", label: t("admin_tab_users") },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-bold">{t("admin_title")}</h1>

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-muted p-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "reports" ? <ReportsTab /> : tab === "suspended" ? <SuspendedTab /> : <UsersTab />}

      {confirmSuspendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-base font-semibold">{t("admin_confirm_suspend_title")}</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              {t("admin_confirm_suspend_body", { name: confirmSuspendName })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSearchParams({})}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t("admin_cancel")}
              </button>
              <button
                onClick={() => suspendMutation.mutate(confirmSuspendId)}
                disabled={suspendMutation.isPending}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {t("admin_suspend")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmResetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-base font-semibold">{t("admin_confirm_reset_title")}</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              {t("admin_confirm_reset_body", { name: confirmResetName })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSearchParams({})}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t("admin_cancel")}
              </button>
              <button
                onClick={() => resetMutation.mutate(confirmResetId)}
                disabled={resetMutation.isPending}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {t("admin_reset_profile")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteJourneyLogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-base font-semibold">{t("admin_confirm_delete_journey_log_title")}</h2>
            <p className="mb-6 text-sm text-muted-foreground">{t("admin_confirm_delete_journey_log_body")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSearchParams({})}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t("admin_cancel")}
              </button>
              <button
                onClick={() => deleteJourneyLogMutation.mutate(confirmDeleteJourneyLogId)}
                disabled={deleteJourneyLogMutation.isPending}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {t("admin_delete_journey_log")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteCommentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-base font-semibold">{t("admin_confirm_delete_comment_title")}</h2>
            <p className="mb-6 text-sm text-muted-foreground">{t("admin_confirm_delete_comment_body")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSearchParams({})}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t("admin_cancel")}
              </button>
              <button
                onClick={() => deleteCommentMutation.mutate(confirmDeleteCommentId)}
                disabled={deleteCommentMutation.isPending}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {t("admin_delete_comment")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
