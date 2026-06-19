// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { X } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { playerHref } from "@/lib/display";
import PlayerAvatar from "@/components/PlayerAvatar";
import type { Player } from "@/models";

type Props = {
  title: string;
  players: Player[];
  onClose: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

export default function FollowListModal({ title, players, onClose, hasMore, loadingMore, onLoadMore }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t("modal_close")}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <ul className="max-h-96 overflow-y-auto py-2">
          {players.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("modal_no_players")}
            </li>
          ) : (
            players.map((player) => (
              <li key={player.id}>
                <Link
                  to={playerHref(player)}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <PlayerAvatar player={player} className="h-9 w-9 shrink-0 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{player.name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{player.handle}</p>
                  </div>
                </Link>
              </li>
            ))
          )}
          {hasMore && (
            <li className="border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {loadingMore ? t("loading") : t("load_more")}
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
