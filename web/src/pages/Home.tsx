// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Fragment } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer, signIn } from "@/services/auth";
import { withContactLink } from "@/components/layout/LegalLayout";
import Feed from "@/pages/Feed";

export default function Home() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { data: player, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  if (isLoading) return null;
  if (player) return <Feed />;

  if (searchParams.get("error") === "suspended") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">{t("account_suspended_title")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{withContactLink(t("account_suspended_body"))}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-10 px-4 py-20 text-center">
      {/* Logo + tagline */}
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="Yurnik" className="w-24" />
        <h1 className="bg-gradient-to-r from-blue-400 via-primary to-orange-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">yurnik</h1>
        <p className="max-w-sm text-base text-muted-foreground">{t("lore_tagline")}</p>
      </div>

      {/* How it works — three steps */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        {[t("lore_step_play"), t("lore_step_confirm"), t("lore_step_share")].map((label, i) => (
          <Fragment key={label}>
            {i > 0 && <div className="hidden h-px w-12 self-center border-t border-dashed border-primary/30 sm:block" />}
            <div className="flex flex-col items-center gap-2 text-center sm:w-28">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </div>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </Fragment>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => signIn()}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("lore_cta_primary")}
        </button>
        <Link
          to="/explore"
          className="rounded-md border border-border px-6 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
        >
          {t("home_explore_cta")}
        </Link>
      </div>

      {/* Learn more */}
      <Link to="/lore" className="text-xs text-muted-foreground/60 underline-offset-4 transition-colors hover:text-muted-foreground hover:underline">
        {t("home_learn_more")}
      </Link>
    </div>
  );
}
