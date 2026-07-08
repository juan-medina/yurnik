// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AtSign, MessageSquare, UserPlus, CalendarDays } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { getNotifications, markAllRead } from "@/services/notifications";
import { getCurrentPlayer } from "@/services/auth";
import PlayerAvatar from "@/components/PlayerAvatar";
import { formatCommentAge } from "@/lib/time";
import FollowListModal from "@/components/FollowListModal";
import type { Notification, Player } from "@/models";

type Filter = "all" | "comments" | "followers";

function ActorAvatars({ actors }: { actors: Player[] }) {
  return (
    <div className="flex shrink-0 -space-x-2">
      {actors.slice(0, 3).map((a) => (
        <PlayerAvatar key={a.id} player={a} className="h-8 w-8 ring-2 ring-card" />
      ))}
    </div>
  );
}

function NotificationIcon({ type }: { type: Notification["type"] }) {
  const icon =
    type === "backlog_release" ? (
      <CalendarDays size={13} />
    ) : type === "new_mention" ? (
      <AtSign size={13} />
    ) : type === "new_comment" || type === "new_comment_reply" ? (
      <MessageSquare size={13} />
    ) : (
      <UserPlus size={13} />
    );
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {icon}
    </div>
  );
}

function formatActors(actors: Player[], actorCount: number, t: TFunction): string {
  if (actors.length === 0) return t("notifications_someone");
  const names = actors.map((a) => a.name);
  const extra = actorCount - names.length;
  if (extra > 0) return `${names.join(", ")} ${t("notifications_others", { count: extra })}`;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ${t("notifications_and")} ${names[names.length - 1]}`;
}

function NotificationRow({ notification }: { notification: Notification }) {
  const { t } = useTranslation();
  const [showActors, setShowActors] = useState(false);

  const isReleaseNotification = notification.type === "backlog_release";
  const isCommentNotification = notification.type === "new_comment" || notification.type === "new_comment_reply";
  const isMentionNotification = notification.type === "new_mention";
  const linksToJourney = isCommentNotification || isMentionNotification;
  const isFollowerBatch = notification.type === "new_follower" && notification.actorCount > 1;
  const journeyDeleted = linksToJourney && notification.subjectId === null;
  const to = isReleaseNotification
    ? `/game/${notification.subjectIgdbId}`
    : linksToJourney
    ? `/journey/${notification.subjectId}`
    : `/player/${notification.actors[0]?.handle}`;

  const actorLabel = isReleaseNotification ? "" : formatActors(notification.actors, notification.actorCount, t);

  const rowClass = `flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/5 ${
    !notification.read ? "border-l-2 border-primary bg-primary/5" : "border-l-2 border-transparent"
  }`;

  const body = (
    <>
      <NotificationIcon type={notification.type} />
      {!isReleaseNotification && <ActorAvatars actors={notification.actors} />}
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {isReleaseNotification ? (
            <>
              <span className="font-semibold">{notification.subjectTitle}</span>{" "}
              {t("notifications_releasing_soon")}
            </>
          ) : (
            <span className="font-semibold">{actorLabel} </span>
          )}
          {isMentionNotification ? (
            <>
              {t("notifications_mentioned")}
              <span className="font-medium">{notification.subjectTitle}</span>
              {t("notifications_mentioned_suffix")}
              {journeyDeleted && (
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                  {t("notifications_removed")}
                </span>
              )}
            </>
          ) : isCommentNotification ? (
            <>
              {notification.type === "new_comment" ? t("notifications_commented") : t("notifications_replied")}
              <span className="font-medium">{notification.subjectTitle}</span>
              {notification.type === "new_comment" ? t("notifications_commented_suffix") : t("notifications_replied_suffix")}
              {journeyDeleted && (
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                  {t("notifications_removed")}
                </span>
              )}
            </>
          ) : !isReleaseNotification ? (
            <>{t("notifications_followed")}</>
          ) : null}
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatCommentAge(notification.updatedAt)}
      </span>
    </>
  );

  return (
    <>
      {isFollowerBatch ? (
        <button className={rowClass} onClick={() => setShowActors(true)}>
          {body}
        </button>
      ) : journeyDeleted ? (
        <div className={`${rowClass} cursor-default opacity-60`}>
          {body}
        </div>
      ) : (
        <Link to={to} className={rowClass}>
          {body}
        </Link>
      )}
      {showActors && (
        <FollowListModal
          title={t("notifications_new_followers")}
          players={notification.actors}
          onClose={() => setShowActors(false)}
        />
      )}
    </>
  );
}

export default function Notifications() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: player } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  const { data: notificationsPage } = useQuery({
    queryKey: ["notifications", "page"],
    queryFn: () => getNotifications(),
    enabled: !!player,
  });

  useEffect(() => {
    if (notificationsPage) {
      setAllNotifications(notificationsPage.notifications);
      setNextCursor(notificationsPage.nextCursor);
    }
  }, [notificationsPage]);

  const queryClient = useQueryClient();
  const markReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setAllNotifications((prev) => prev.map((e) => ({ ...e, read: true })));
    },
  });

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getNotifications(nextCursor);
      setAllNotifications((prev) => [...prev, ...page.notifications]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  // Mark all read as soon as the panel opens (only when authenticated).
  useEffect(() => {
    if (player) markReadMutation.mutate();
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterLabels: { value: Filter; labelKey: string }[] = [
    { value: "all", labelKey: "notifications_filter_all" },
    { value: "comments", labelKey: "notifications_filter_comments" },
    { value: "followers", labelKey: "notifications_filter_followers" },
  ];

  const emptyKey: Record<Filter, string> = {
    all: "notifications_empty_all",
    comments: "notifications_empty_comments",
    followers: "notifications_empty_followers",
  };

  const visible = allNotifications.filter((e) => {
    if (filter === "comments") return e.type === "new_comment" || e.type === "new_comment_reply" || e.type === "new_mention";
    if (filter === "followers") return e.type === "new_follower";
    return true;
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{t("notifications_title")}</h1>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {filterLabels.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
              filter === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {visible.length > 0 ? (
          <div className="divide-y divide-border">
            {visible.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {t(emptyKey[filter])}
          </div>
        )}
        {nextCursor && (
          <div className="border-t border-border p-3">
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

      <div className="h-8" />
    </div>
  );
}
