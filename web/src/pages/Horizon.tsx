// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link } from "react-router";
import { Telescope, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer, signIn } from "@/services/auth";
import { getHorizon, addToHorizon, removeFromHorizon } from "@/services/horizon";
import { GameSelector, GameCover } from "@/components/GameSelector";
import GenreChip from "@/components/GenreChip";
import type { Game } from "@/models/game";
import type { HorizonEntry } from "@/models/player";

function HorizonRow({ entry, onRemove, removing }: { entry: HorizonEntry; onRemove: () => void; removing: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 py-2">
      <Link to={`/game/${entry.igdbId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <GameCover game={entry.name} coverUrl={entry.coverUrl} size="sm" />
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 text-sm font-medium">
            <span className="truncate">{entry.name}</span>
            {entry.releaseYear && (
              <span className="shrink-0 text-xs font-normal text-muted-foreground">({entry.releaseYear})</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {entry.genres.map((g) => <GenreChip key={g} genre={g} size="sm" />)}
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label={t("horizon_remove")}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:opacity-40"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function Horizon() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectorKey, setSelectorKey] = useState(0);

  const { data: currentPlayer, isLoading: loadingPlayer } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["horizon", currentPlayer?.handle],
    queryFn: () => getHorizon(currentPlayer!.handle),
    enabled: !!currentPlayer,
  });

  const addMutation = useMutation({
    mutationFn: (igdbId: number) => addToHorizon(igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["horizon", currentPlayer?.handle] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (igdbId: number) => removeFromHorizon(igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["horizon", currentPlayer?.handle] });
    },
  });

  function handleSelect(game: Game) {
    const igdbId = parseInt(game.id, 10);
    if (!isNaN(igdbId)) addMutation.mutate(igdbId);
    setSelectorKey((k) => k + 1);
  }

  if (loadingPlayer) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">{t("horizon_title")}</h1>

      {!currentPlayer ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-4 py-12 text-center">
          <Telescope size={28} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("signin_prompt_sub")}</p>
          <button
            onClick={() => signIn()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("lore_cta_primary")}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <GameSelector key={selectorKey} value={null} onChange={handleSelect} />
          </div>

          {entries.length > 0 ? (
            <div className="divide-y divide-border rounded-lg border border-border bg-card px-4">
              {entries.map((entry) => (
                <HorizonRow
                  key={entry.igdbId}
                  entry={entry}
                  onRemove={() => removeMutation.mutate(entry.igdbId)}
                  removing={removeMutation.isPending && removeMutation.variables === entry.igdbId}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-4 py-12 text-center">
              <Telescope size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("horizon_empty")}</p>
            </div>
          )}
        </>
      )}

      <div className="h-8" />
    </div>
  );
}
