// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link } from "react-router";
import { MessageSquare, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { avatarSrc, playerHref } from "@/lib/display";
import { formatCommentAge } from "@/lib/time";
import type { Activity } from "@/models";

interface ActivityItemProps {
  activity: Activity;
  viewerId?: string;
}

export default function ActivityItem({ activity, viewerId }: ActivityItemProps) {
  const { t } = useTranslation();
  const { type, actor, recipient, subjectId, subjectTitle, createdAt } = activity;
  const aboutViewer = recipient.id === viewerId;
  const viewerIsActor = actor.id === viewerId;
  const isSelfComment = type === "comment" && actor.id === recipient.id;

  const to =
    type === "comment" ? `/journey/${subjectId}` : playerHref(aboutViewer ? actor : recipient);
  const icon = type === "comment" ? <MessageSquare size={13} /> : <UserPlus size={13} />;

  const text = isSelfComment
    ? viewerIsActor
      ? t("realm_activity_commented_own_you", { game: subjectTitle })
      : t("realm_activity_commented_own", { game: subjectTitle })
    : aboutViewer
      ? type === "comment"
        ? t("realm_activity_commented_you", { game: subjectTitle })
        : t("realm_activity_followed_you")
      : viewerIsActor
        ? type === "comment"
          ? t("realm_activity_commented_by_you", { recipient: recipient.name, game: subjectTitle })
          : t("realm_activity_followed_by_you", { recipient: recipient.name })
        : type === "comment"
          ? t("realm_activity_commented", { recipient: recipient.name, game: subjectTitle })
          : t("realm_activity_followed", { recipient: recipient.name });

  return (
    <Link
      to={to}
      className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <img
        src={avatarSrc(actor)}
        alt={actor.name}
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
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
