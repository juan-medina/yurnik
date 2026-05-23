// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link } from "react-router";
import { MessageSquare, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEchoes, markAllRead } from "@/services/echoes";
import { avatarSrc } from "@/lib/display";
import { formatCommentAge } from "@/lib/time";
import type { Echo, Player } from "@/models";

type Filter = "all" | "comments" | "followers";

function PlayerAvatar({ player }: { player: Player }) {
  return (
    <img
      src={avatarSrc(player)}
      alt={player.name}
      className="h-8 w-8 shrink-0 rounded-full object-cover"
    />
  );
}

function EchoIcon({ kind }: { kind: Echo["kind"] }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {kind === "comment" ? <MessageSquare size={13} /> : <UserPlus size={13} />}
    </div>
  );
}

function EchoRow({ echo }: { echo: Echo }) {
  const to = echo.kind === "comment" ? `/journey/${echo.sessionId}` : `/player/${echo.player.handle}`;

  return (
    <Link
      to={to}
      className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/5 ${
        !echo.read ? "border-l-2 border-primary bg-primary/5" : "border-l-2 border-transparent"
      }`}
    >
      <EchoIcon kind={echo.kind} />
      <PlayerAvatar player={echo.player} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{echo.player.name}</span>
          {echo.kind === "comment" ? (
            <>
              {" "}
              commented on your{" "}
              <span className="font-medium">{echo.game}</span> journey
            </>
          ) : (
            <> started following you</>
          )}
        </p>
        {echo.commentPreview && (
          <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
            &ldquo;{echo.commentPreview}&rdquo;
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{formatCommentAge(echo.occurredAt)}</span>
    </Link>
  );
}

const FILTER_LABELS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "comments", label: "Comments" },
  { value: "followers", label: "Followers" },
];

export default function Echoes() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: echoes = [] } = useQuery({ queryKey: ["echoes"], queryFn: getEchoes });

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["echoes"] }),
  });

  const allRead = echoes.every((e) => e.read);

  const visible = echoes.filter((e) => {
    if (filter === "comments") return e.kind === "comment";
    if (filter === "followers") return e.kind === "follower";
    return true;
  });

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Echoes</h1>
        <button
          onClick={() => markAllReadMutation.mutate()}
          disabled={allRead}
          className="text-sm text-primary transition-opacity hover:underline disabled:pointer-events-none disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1">
        {FILTER_LABELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
              filter === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {label}
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
            No {filter === "all" ? "" : filter} echoes yet.
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}
