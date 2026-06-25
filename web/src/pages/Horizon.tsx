// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Telescope, Trash2, GripVertical, Sparkles, Dices, ChevronDown } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { genreBarColor } from "@/lib/genres";
import { formatReleaseDate } from "@/lib/time";
import type { Game } from "@/models/game";
import type { HorizonEntry } from "@/models/player";

// A game counts as upcoming if it has a confirmed future release date, or if
// it has no confirmed date at all (TBA) and isn't already known to be out —
// i.e. its release year, if any, isn't in the past.
export function isUpcoming(entry: HorizonEntry): boolean {
  if (entry.releaseDate) {
    const todayMs = new Date(new Date().toDateString()).getTime();
    return entry.releaseDate.getTime() >= todayMs;
  }
  if (entry.releaseYear) return entry.releaseYear >= new Date().getFullYear();
  return true;
}

// Sort key for the upcoming list: dated entries sort by their exact date,
// year-only entries sort after all dated ones (by year), and fully TBA
// entries (no date, no year) sort last of all.
export function upcomingSortKey(entry: HorizonEntry): number {
  if (entry.releaseDate) return entry.releaseDate.getTime();
  if (entry.releaseYear) return new Date(entry.releaseYear, 11, 31).getTime();
  return Infinity;
}

function ReleaseLabel({ entry, className }: { entry: HorizonEntry; className: string }) {
  if (entry.releaseDate) return <span className={className}>({formatReleaseDate(entry.releaseDate)})</span>;
  if (entry.releaseYear) return <span className={className}>({entry.releaseYear})</span>;
  return null;
}

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
              <ReleaseLabel entry={entry} className="shrink-0 text-sm font-normal text-muted-foreground" />
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
            <ReleaseLabel entry={entry} className="shrink-0 text-xs font-normal text-muted-foreground" />
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

function FilterDropdown({
  label, allLabel, value, options, onChange, colorFor, labelFor,
}: { label: string; allLabel: string; value: string | null; options: string[]; onChange: (value: string | null) => void; colorFor?: (option: string) => string; labelFor?: (option: string) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            (value || open) && "bg-accent text-foreground",
          )}
        >
          {value && colorFor && (
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorFor(value) }} />
          )}
          {value ? (labelFor ? labelFor(value) : value) : label}
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        <button
          type="button"
          onClick={() => { onChange(null); setOpen(false); }}
          className={cn(
            "block w-full rounded-sm px-2 py-1.5 text-left text-sm",
            value === null ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => { onChange(value === option ? null : option); setOpen(false); }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
              value === option ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {colorFor && (
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorFor(option) }} />
            )}
            {labelFor ? labelFor(option) : option}
          </button>
        ))}
      </PopoverContent>
    </Popover>
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
            <ReleaseLabel entry={entry} className="shrink-0 text-xs font-normal text-muted-foreground" />
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
  const [activeYear, setActiveYear] = useState<string | null>(null);
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

  const hasUpcoming = useMemo(() => entries.some(isUpcoming), [entries]);

  const allYears = useMemo(() => {
    const years = Array.from(new Set(entries.flatMap((e) => (e.releaseYear ? [String(e.releaseYear)] : []))))
      .sort((a, b) => Number(b) - Number(a));
    return hasUpcoming ? ["upcoming", ...years] : years;
  }, [entries, hasUpcoming]);

  const genreFiltered = entries.filter((e) => !activeGenre || e.genres.includes(activeGenre));

  let filtered = genreFiltered;
  if (activeYear === "upcoming") {
    filtered = genreFiltered.filter(isUpcoming).sort((a, b) => upcomingSortKey(a) - upcomingSortKey(b));
  } else if (activeYear) {
    filtered = genreFiltered.filter((e) => String(e.releaseYear) === activeYear);
  }
  const isFiltered = !!activeGenre || !!activeYear;

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
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {allGenres.length > 1 && (
                    <FilterDropdown
                      label={t("horizon_filter_genre")}
                      allLabel={t("players_all")}
                      value={activeGenre}
                      options={allGenres}
                      onChange={setActiveGenre}
                      colorFor={genreBarColor}
                    />
                  )}
                  {allYears.length > 1 && (
                    <FilterDropdown
                      label={t("horizon_filter_year")}
                      allLabel={t("players_all")}
                      value={activeYear}
                      options={allYears}
                      onChange={setActiveYear}
                      labelFor={(option) => (option === "upcoming" ? t("horizon_filter_upcoming") : option)}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setRolling(true)}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Dices size={14} />
                  {t("horizon_roll")}
                </button>
              </div>

              {isFiltered ? (
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
