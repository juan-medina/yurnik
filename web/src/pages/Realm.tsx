// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { getFeedItems } from "@/services/feed";
import { getCurrentPlayer } from "@/services/auth";
import JourneyCard from "@/components/JourneyCard";
import ActivityItem from "@/components/ActivityItem";

export default function Realm() {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: getFeedItems,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const { data: currentPlayer } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });

  if (isLoading) return null;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl flex flex-col items-center justify-center py-24 gap-3 text-center">
        <p className="text-base">{t("realm_quiet")}</p>
        <p className="text-sm text-muted-foreground">{t("realm_follow_hint")}</p>
        <Link
          to="/players"
          className="mt-2 text-sm border border-border rounded-lg px-4 py-2 hover:bg-muted transition-colors"
        >
          {t("realm_discover")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-3">
        {items.map((item) =>
          item.kind === "journey" ? (
            <JourneyCard key={`journey-${item.journey.id}`} journey={item.journey} showPlayer />
          ) : (
            <ActivityItem
              key={`activity-${item.activity.type}-${item.activity.actor.id}-${item.activity.createdAt.toISOString()}`}
              activity={item.activity}
              viewerId={currentPlayer?.id}
            />
          ),
        )}
      </div>
    </div>
  );
}
