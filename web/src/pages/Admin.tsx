// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { listReports } from "@/services/reports";
import { usePageTitle } from "@/hooks/usePageTitle";
import { initials } from "@/lib/display";
import type { AdminReport, ReportReason, ReportTargetType } from "@/models";

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

export default function Admin() {
  const { t } = useTranslation();
  usePageTitle(t("admin_title"));

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: listReports,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-bold">{t("admin_title")}</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("admin_reports_title")}
        </h2>

        {isLoading ? null : reports.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
            {t("admin_reports_empty")}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {reports.map((rep) => (
              <div key={rep.id} className="flex items-start gap-3 px-4 py-3">
                  <Link to={`/player/${rep.reporterHandle}`} className="shrink-0">
                    <img
                      src={rep.reporterAvatar ?? `https://i.pravatar.cc/64?u=${encodeURIComponent(rep.reporterHandle)}`}
                      alt={rep.reporterName}
                      className="h-8 w-8 rounded-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        el.nextElementSibling?.removeAttribute("hidden");
                      }}
                    />
                    <div
                      hidden
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: rep.reporterColor }}
                    >
                      {initials(rep.reporterName)}
                    </div>
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
          </div>
        )}
      </section>
    </div>
  );
}
