// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Telescope, Trash2, GripVertical, Sparkles, Dices } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentPlayer, signIn } from "@/services/auth";
import { getHorizon, addToHorizon, removeFromHorizon, reorderHorizon } from "@/services/horizon";
import { GameSelector, GameCover } from "@/components/GameSelector";
import GenreChip from "@/components/GenreChip";
import RollModal from "@/components/RollModal";
import { cn } from "@/lib/utils";
import { genreColor } from "@/lib/genres";
import type { Game } from "@/models/game";
import type { HorizonEntry } from "@/models/player";

function HorizonRow({
  entry, hero, onRemove, removing,
}: { entry: HorizonEntry; hero: boolean; onRemove: () => void; removing: boolean }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.igdbId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={t("horizon_drag_handle")}
      className="shrink-0 cursor-grab touch-none rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical size={15} />
    </button>
  );

  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      disabled={removing}
      aria-label={t("horizon_remove")}
      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:opacity-40"
    >
      <Trash2 size={15} />
    </button>
  );

  if (hero) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "mb-6 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4",
          isDragging && "opacity-40",
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles size={14} />
            {t("horizon_next_up")}
          </div>
          {dragHandle}
        </div>
        <div className="flex items-center gap-4">
          <Link to={`/game/${entry.igdbId}`} className="shrink-0">
            <GameCover game={entry.name} coverUrl={entry.coverUrl} size="lg" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={`/game/${entry.igdbId}`} className="flex items-baseline gap-1.5">
              <span className="truncate text-lg font-bold">{entry.name}</span>
              {entry.releaseYear && (
                <span className="shrink-0 text-sm font-normal text-muted-foreground">({entry.releaseYear})</span>
              )}
            </Link>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {entry.genres.map((g) => <GenreChip key={g} genre={g} size="sm" />)}
            </div>
          </div>
          {removeButton}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2 py-2", isDragging && "opacity-40")}
    >
      {dragHandle}
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
      {removeButton}
    </div>
  );
}

function DragPreview({ entry }: { entry: HorizonEntry }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-lg">
      <GameCover game={entry.name} coverUrl={entry.coverUrl} size="sm" />
      <span className="truncate text-sm font-medium">{entry.name}</span>
    </div>
  );
}

function FilteredRow({ entry, onRemove, removing }: { entry: HorizonEntry; onRemove: () => void; removing: boolean }) {
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
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  const { data: currentPlayer, isLoading: loadingPlayer } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  const queryKey = ["horizon", currentPlayer?.handle];

  const { data: entries = [] } = useQuery({
    queryKey,
    queryFn: () => getHorizon(currentPlayer!.handle),
    enabled: !!currentPlayer,
  });

  const addMutation = useMutation({
    mutationFn: (igdbId: number) => addToHorizon(igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (igdbId: number) => removeFromHorizon(igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (igdbIds: number[]) => reorderHorizon(igdbIds),
    onError: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const allGenres = useMemo(
    () => Array.from(new Set(entries.flatMap((e) => e.genres))).sort(),
    [entries],
  );

  const filtered = activeGenre ? entries.filter((e) => e.genres.includes(activeGenre)) : entries;

  function handleSelect(game: Game) {
    const igdbId = parseInt(game.id, 10);
    if (!isNaN(igdbId)) addMutation.mutate(igdbId);
    setSelectorKey((k) => k + 1);
  }

  const [activeEntry, setActiveEntry] = useState<HorizonEntry | null>(null);

  function handleDragStart(event: DragStartEvent) {
    setActiveEntry(entries.find((e) => e.igdbId === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveEntry(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = entries.findIndex((e) => e.igdbId === active.id);
    const newIndex = entries.findIndex((e) => e.igdbId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(entries, oldIndex, newIndex);
    queryClient.setQueryData(queryKey, reordered);
    reorderMutation.mutate(reordered.map((e) => e.igdbId));
  }

  if (loadingPlayer) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">{t("horizon_title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("horizon_subtitle")}</p>

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
            <>
              <div className="mb-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setRolling(true)}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Dices size={14} />
                  {t("horizon_roll")}
                </button>
              </div>

              {allGenres.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveGenre(null)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      activeGenre === null
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {t("players_all")}
                  </button>
                  {allGenres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => setActiveGenre(activeGenre === genre ? null : genre)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-opacity",
                        activeGenre === genre
                          ? "bg-primary text-primary-foreground"
                          : cn(genreColor(genre), "hover:opacity-80"),
                      )}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              )}

              {activeGenre ? (
                <div className="divide-y divide-border rounded-lg border border-border bg-card px-4">
                  {filtered.map((entry) => (
                    <FilteredRow
                      key={entry.igdbId}
                      entry={entry}
                      onRemove={() => removeMutation.mutate(entry.igdbId)}
                      removing={removeMutation.isPending && removeMutation.variables === entry.igdbId}
                    />
                  ))}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={entries.map((e) => e.igdbId)} strategy={verticalListSortingStrategy}>
                    <HorizonRow
                      entry={entries[0]}
                      hero
                      onRemove={() => removeMutation.mutate(entries[0].igdbId)}
                      removing={removeMutation.isPending && removeMutation.variables === entries[0].igdbId}
                    />
                    {entries.length > 1 && (
                      <div className="divide-y divide-border rounded-lg border border-border bg-card px-4">
                        {entries.slice(1).map((entry) => (
                          <HorizonRow
                            key={entry.igdbId}
                            entry={entry}
                            hero={false}
                            onRemove={() => removeMutation.mutate(entry.igdbId)}
                            removing={removeMutation.isPending && removeMutation.variables === entry.igdbId}
                          />
                        ))}
                      </div>
                    )}
                  </SortableContext>
                  <DragOverlay>{activeEntry && <DragPreview entry={activeEntry} />}</DragOverlay>
                </DndContext>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-4 py-12 text-center">
              <Telescope size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("horizon_empty")}</p>
            </div>
          )}
        </>
      )}

      {rolling && filtered.length > 0 && (
        <RollModal entries={filtered} onClose={() => setRolling(false)} />
      )}

      <div className="h-8" />
    </div>
  );
}
