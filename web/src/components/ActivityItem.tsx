// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link } from "react-router";
import { MessageSquare, Telescope, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { playerHref } from "@/lib/display";
import PlayerAvatar from "@/components/PlayerAvatar";
import { formatCommentAge } from "@/lib/time";
import type { Activity } from "@/models";

interface ActivityItemProps {
  activity: Activity;
  viewerId?: string;
}

export default function ActivityItem({ activity, viewerId }: ActivityItemProps) {
  const { t } = useTranslation();
  const { type, actor, recipient, subjectId, subjectTitle, subjectIgdbId, createdAt } = activity;
  const aboutViewer = recipient.id === viewerId;
  const viewerIsActor = actor.id === viewerId;
  const isSelfComment = type === "comment" && actor.id === recipient.id;

  const to =
    type === "comment" ? `/journey/${subjectId}` :
    type === "backlog_add" ? `/game/${subjectIgdbId}` :
    playerHref(aboutViewer ? actor : recipient);
  const icon =
    type === "comment" ? <MessageSquare size={13} /> :
    type === "backlog_add" ? <Telescope size={13} /> :
    <UserPlus size={13} />;

  const text =
    type === "backlog_add"
      ? viewerIsActor
        ? t("feed_activity_backlog_added_you", { game: subjectTitle })
        : t("feed_activity_backlog_added", { game: subjectTitle })
      : isSelfComment
        ? viewerIsActor
          ? t("feed_activity_commented_own_you", { game: subjectTitle })
          : t("feed_activity_commented_own", { game: subjectTitle })
        : aboutViewer
          ? type === "comment"
            ? t("feed_activity_commented_you", { game: subjectTitle })
            : t("feed_activity_followed_you")
          : viewerIsActor
            ? type === "comment"
              ? t("feed_activity_commented_by_you", { recipient: recipient.name, game: subjectTitle })
              : t("feed_activity_followed_by_you", { recipient: recipient.name })
            : type === "comment"
              ? t("feed_activity_commented", { recipient: recipient.name, game: subjectTitle })
              : t("feed_activity_followed", { recipient: recipient.name });

  return (
    <Link
      to={to}
      className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <PlayerAvatar player={actor} className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {viewerIsActor ? text : (
            <>
              <span className="font-semibold">{actor.name}</span> {text}
            </>
          )}
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatCommentAge(createdAt)}
      </span>
    </Link>
  );
}
