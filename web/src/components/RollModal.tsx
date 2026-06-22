// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Dices, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GameCover } from "@/components/GameSelector";
import type { HorizonEntry } from "@/models/player";

type Props = { entries: HorizonEntry[]; onClose: () => void };

const SPIN_INTERVAL_MS = 80;
const SPIN_DURATION_MS = 1200;

export default function RollModal({ entries, onClose }: Props) {
  const { t } = useTranslation();
  const [shownIndex, setShownIndex] = useState(0);
  const [settled, setSettled] = useState(false);
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    setSettled(false);
    const finalIndex = Math.floor(Math.random() * entries.length);
    const startedAt = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= SPIN_DURATION_MS) {
        clearInterval(interval);
        setShownIndex(finalIndex);
        setSettled(true);
        return;
      }
      setShownIndex(Math.floor(Math.random() * entries.length));
    }, SPIN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [entries.length, spin]);

  const entry = entries[shownIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t("modal_close")}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={18} />
        </button>
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="font-semibold text-foreground">
            {settled ? t("horizon_roll_result") : t("horizon_roll_rolling")}
          </h2>
          <div className={settled ? undefined : "opacity-70"}>
            <GameCover game={entry.name} coverUrl={entry.coverUrl} size="lg" />
          </div>
          <span className="text-lg font-bold">{entry.name}</span>
          {settled && (
            <div className="flex w-full flex-col gap-2">
              <Link
                to={`/game/${entry.igdbId}`}
                onClick={onClose}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("horizon_roll_view")}
              </Link>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSpin((s) => s + 1)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Dices size={15} />
                  {t("horizon_roll_again")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
