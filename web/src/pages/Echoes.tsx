// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { MessageSquare, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { getEchoes, markAllRead } from "@/services/echoes";
import { getCurrentPlayer } from "@/services/auth";
import PlayerAvatar from "@/components/PlayerAvatar";
import { formatCommentAge } from "@/lib/time";
import FollowListModal from "@/components/FollowListModal";
import type { Echo, Player } from "@/models";

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

function EchoIcon({ type }: { type: Echo["type"] }) {
  const icon =
    type === "new_comment" ? <MessageSquare size={13} /> :
                             <UserPlus size={13} />;
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {icon}
    </div>
  );
}

function formatActors(actors: Player[], actorCount: number, t: TFunction): string {
  if (actors.length === 0) return t("echoes_someone");
  const names = actors.map((a) => a.name);
  const extra = actorCount - names.length;
  if (extra > 0) return `${names.join(", ")} ${t("echoes_others", { count: extra })}`;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ${t("echoes_and")} ${names[names.length - 1]}`;
}

function EchoRow({ echo }: { echo: Echo }) {
  const { t } = useTranslation();
  const [showActors, setShowActors] = useState(false);

  const isFollowerBatch = echo.type === "new_follower" && echo.actorCount > 1;
  const journeyDeleted = echo.type === "new_comment" && echo.subjectId === null;
  const to =
    echo.type === "new_comment"
      ? `/journey/${echo.subjectId}`
      : `/player/${echo.actors[0]?.handle}`;

  const actorLabel = formatActors(echo.actors, echo.actorCount, t);

  const rowClass = `flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/5 ${
    !echo.read ? "border-l-2 border-primary bg-primary/5" : "border-l-2 border-transparent"
  }`;

  const body = (
    <>
      <EchoIcon type={echo.type} />
      <ActorAvatars actors={echo.actors} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{actorLabel}</span>
          {echo.type === "new_comment" ? (
            <>
              {t("echoes_commented")}
              <span className="font-medium">{echo.subjectTitle}</span>
              {t("echoes_commented_suffix")}
              {journeyDeleted && (
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                  {t("echoes_removed")}
                </span>
              )}
            </>
          ) : (
            <>{t("echoes_followed")}</>
          )}
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatCommentAge(echo.updatedAt)}
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
          title={t("echoes_new_followers")}
          players={echo.actors}
          onClose={() => setShowActors(false)}
        />
      )}
    </>
  );
}

export default function Echoes() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: player } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  const { data: echoes = [] } = useQuery({ queryKey: ["echoes"], queryFn: getEchoes, enabled: !!player });

  const markReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["echoes"] }),
  });

  // Mark all read as soon as the panel opens (only when authenticated).
  useEffect(() => {
    if (player) markReadMutation.mutate();
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterLabels: { value: Filter; labelKey: string }[] = [
    { value: "all", labelKey: "echoes_filter_all" },
    { value: "comments", labelKey: "echoes_filter_comments" },
    { value: "followers", labelKey: "echoes_filter_followers" },
  ];

  const emptyKey: Record<Filter, string> = {
    all: "echoes_empty_all",
    comments: "echoes_empty_comments",
    followers: "echoes_empty_followers",
  };

  const visible = echoes.filter((e) => {
    if (filter === "comments") return e.type === "new_comment";
    if (filter === "followers") return e.type === "new_follower";
    return true;
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{t("echoes_title")}</h1>
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

      {/* Echo list */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {visible.length > 0 ? (
          <div className="divide-y divide-border">
            {visible.map((echo) => (
              <EchoRow key={echo.id} echo={echo} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {t(emptyKey[filter])}
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}
