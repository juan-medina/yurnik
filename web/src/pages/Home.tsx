// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer, signIn } from "@/services/auth";
import Realm from "@/pages/Realm";

export default function Home() {
  const { t } = useTranslation();
  const { data: player, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  if (isLoading) return null;
  if (player) return <Realm />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-10 px-4 py-20 text-center">
      {/* Logo + tagline */}
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="Yurnik" className="h-16 w-16 object-contain" />
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">yurnik</h1>
        <p className="max-w-sm text-base text-muted-foreground">{t("lore_tagline")}</p>
      </div>

      {/* How it works — three steps */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        {[t("lore_step_play"), t("lore_step_confirm"), t("lore_step_share")].map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-2 text-center sm:w-28">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-muted-foreground">
              {i + 1}
            </div>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
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
          to="/players"
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
