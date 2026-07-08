// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer } from "@/services/auth";
import { withContactLink } from "@/components/layout/LegalLayout";
import Feed from "@/pages/Feed";
import { AboutContent } from "@/pages/About";

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
    <div className="-m-4 sm:-m-6">
      <AboutContent authenticated={false} />
    </div>
  );
}
