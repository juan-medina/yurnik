// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { getFeedItems } from "@/services/feed";
import { getCurrentPlayer } from "@/services/auth";
import ActivityFeed from "@/components/ActivityFeed";
import type { FeedItem } from "@/models/feed";

export default function Feed() {
  const { t } = useTranslation();
  const [extraItems, setExtraItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => getFeedItems(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const { data: currentPlayer } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });

  async function loadMore() {
    const cursor = nextCursor ?? data?.nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getFeedItems(cursor);
      setExtraItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (isLoading) return null;

  const items = [...(data?.items ?? []), ...extraItems];
  const hasMore = nextCursor !== undefined ? !!nextCursor : !!data?.nextCursor;

  const emptyState = (
    <div className="mx-auto max-w-2xl flex flex-col items-center justify-center py-24 gap-3 text-center">
      <p className="text-base">{t("feed_quiet")}</p>
      <p className="text-sm text-muted-foreground">{t("feed_follow_hint")}</p>
      <Link
        to="/explore"
        className="mt-2 text-sm border border-border rounded-lg px-4 py-2 hover:bg-muted transition-colors"
      >
        {t("feed_discover")}
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <ActivityFeed items={items} viewerId={currentPlayer?.id} showPlayer emptyState={emptyState} />
      {hasMore && (
        <div className="border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            {loadingMore ? t("loading") : t("load_more")}
          </button>
        </div>
      )}
    </div>
  );
}
