// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { getCurrentPlayer, signIn } from "@/services/auth";

export default function Profile() {
  const { t } = useTranslation();
  const { data: player, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  if (isLoading) return null;

  // Authenticated users have a real handle — send them to their actual profile.
  if (player) return <Navigate to={`/player/${player.handle}`} replace />;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
      <img src="/logo.png" alt="Yurnik" className="w-20" />
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("hero_anon_title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("hero_anon_hint")}</p>
      </div>
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
    </div>
  );
}
