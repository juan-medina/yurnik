// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronLeft, Check, UserPlus, ExternalLink, Monitor, Gamepad2, Smartphone } from "lucide-react";
import { siPlaystation, siSteam, siAndroid, siApple, siLinux } from "simple-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getGameDetail, getGameJourneys } from "@/services/games";
import { followPlayer, unfollowPlayer } from "@/services/players";
import { getCurrentPlayer } from "@/services/auth";
import { avatarSrc, playerHref } from "@/lib/display";
import { formatJourneyDate } from "@/lib/time";
import GenreChip from "@/components/GenreChip";
import SignInPromptModal from "@/components/SignInPromptModal";
import type { JourneyPlayer } from "@/models/game";

// Renders an SVG from a simple-icons path string at a given size.
function SiIcon({ path, size = 11 }: { path: string; size?: number }) {
  return (
    <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={path} />
    </svg>
  );
}

type PlatformKey = "playstation" | "xbox" | "nintendo" | "pc" | "mac" | "ios" | "steam" | "android" | "linux" | "other";

const PLATFORM_CONFIG: Record<PlatformKey, {
  color: string;
  bg: string;
  icon: React.ReactNode;
  label: (name: string) => string;
}> = {
  playstation: {
    color: "#0070D1",
    bg: "rgba(0,112,209,0.12)",
    icon: <SiIcon path={siPlaystation.path} />,
    label: (n) => n.replace("PlayStation 5", "PS5").replace("PlayStation 4", "PS4").replace("PlayStation 3", "PS3").replace("PlayStation", "PlayStation"),
  },
  xbox: {
    color: "#107C10",
    bg: "rgba(16,124,16,0.12)",
    icon: <Gamepad2 size={11} />,
    label: (n) => n.replace("Xbox Series X|S", "Xbox Series").replace("Xbox Series X", "Xbox Series X").replace("Xbox One", "Xbox One"),
  },
  nintendo: {
    color: "#E4000F",
    bg: "rgba(228,0,15,0.12)",
    icon: <Gamepad2 size={11} />,
    label: (n) => n.replace("Nintendo Switch 2", "Switch 2").replace("Nintendo Switch", "Switch").replace("Nintendo 3DS", "3DS").replace("Nintendo DS", "DS"),
  },
  pc: {
    color: "#0078D4",
    bg: "rgba(0,120,212,0.12)",
    icon: <Monitor size={11} />,
    label: (n) => n.replace("PC (Microsoft Windows)", "PC").replace("Microsoft Windows", "PC"),
  },
  mac: {
    color: "#8E8E93",
    bg: "rgba(142,142,147,0.12)",
    icon: <SiIcon path={siApple.path} />,
    label: (n) => n.replace("Mac", "macOS"),
  },
  ios: {
    color: "#8E8E93",
    bg: "rgba(142,142,147,0.12)",
    icon: <Smartphone size={11} />,
    label: () => "iOS",
  },
  steam: {
    color: "#c7d5e0",
    bg: "rgba(199,213,224,0.08)",
    icon: <SiIcon path={siSteam.path} />,
    label: () => "Steam",
  },
  android: {
    color: "#3DDC84",
    bg: "rgba(61,220,132,0.12)",
    icon: <SiIcon path={siAndroid.path} />,
    label: () => "Android",
  },
  linux: {
    color: "#FCC624",
    bg: "rgba(252,198,36,0.12)",
    icon: <SiIcon path={siLinux.path} />,
    label: (n) => n,
  },
  other: {
    color: "#888",
    bg: "rgba(128,128,128,0.10)",
    icon: <Gamepad2 size={11} />,
    label: (n) => n,
  },
};

function matchPlatform(name: string): PlatformKey {
  const n = name.toLowerCase();
  if (n.includes("playstation")) return "playstation";
  if (n.includes("xbox")) return "xbox";
  if (n.includes("nintendo") || n.includes("switch") || n.includes("3ds") || n.includes("wii")) return "nintendo";
  if (n.includes("pc") || n.includes("windows")) return "pc";
  if (n.includes("ios") || n.includes("iphone") || n.includes("ipad")) return "ios";
  if (n.includes("mac") || n.includes("macos")) return "mac";
  if (n.includes("steam")) return "steam";
  if (n.includes("android")) return "android";
  if (n.includes("linux")) return "linux";
  return "other";
}

function PlatformBadge({ name }: { name: string }) {
  const key = matchPlatform(name);
  const cfg = PLATFORM_CONFIG[key];
  return (
    <span
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}44` }}
      className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
    >
      {cfg.icon}
      {cfg.label(name)}
    </span>
  );
}

const STORE_LABELS: { key: string; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { key: "steam",       label: "Steam",       color: "#c7d5e0", bg: "rgba(199,213,224,0.08)", icon: <SiIcon path={siSteam.path} size={12} /> },
  { key: "epic",        label: "Epic Games",  color: "#ffffff", bg: "rgba(255,255,255,0.08)", icon: <Gamepad2 size={12} /> },
  { key: "playstation", label: "PlayStation", color: "#0070D1", bg: "rgba(0,112,209,0.12)",   icon: <SiIcon path={siPlaystation.path} size={12} /> },
  { key: "xbox",        label: "Xbox",        color: "#107C10", bg: "rgba(16,124,16,0.12)",   icon: <Gamepad2 size={12} /> },
  { key: "gog",         label: "GOG",         color: "#9933CC", bg: "rgba(153,51,204,0.12)",  icon: <Gamepad2 size={12} /> },
  { key: "nintendo",    label: "Nintendo",    color: "#E4000F", bg: "rgba(228,0,15,0.12)",    icon: <Gamepad2 size={12} /> },
];

function igdbSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function JourneyPlayerRow({ entry }: { entry: JourneyPlayer }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(entry.isFollowing);
  const [showSignIn, setShowSignIn] = useState(false);
  const { data: currentPlayer } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer, retry: false });
  const followMutation = useMutation({
    mutationFn: (follow: boolean) => follow ? followPlayer(entry.player.handle) : unfollowPlayer(entry.player.handle),
    onSuccess: (_data, follow) => setFollowing(follow),
  });

  return (
    <div
      className="flex cursor-pointer items-center gap-3 py-2 transition-colors hover:bg-accent/5 -mx-4 px-4"
      onClick={() => navigate(`/journey/${entry.journeyId}`)}
    >
      <Link
        to={playerHref(entry.player)}
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center gap-2"
      >
        <img
          src={avatarSrc(entry.player)}
          alt={entry.player.name}
          className="h-8 w-8 shrink-0 rounded-full object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <Link
            to={playerHref(entry.player)}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold hover:underline"
          >
            {entry.player.name}
          </Link>
          <span className="truncate text-xs text-muted-foreground">@{entry.player.handle}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {entry.duration} · {formatJourneyDate(entry.playedAt)}
        </div>
      </div>
      {entry.isSelf ? (
        <span className="shrink-0 text-xs text-muted-foreground">{t("journey_you")}</span>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); if (!currentPlayer) { setShowSignIn(true); return; } followMutation.mutate(!following); }}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            following
              ? "border-border bg-muted text-muted-foreground"
              : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {following ? (
            <><Check size={12} />{t("journey_following")}</>
          ) : (
            <><UserPlus size={12} />{t("journey_follow")}</>
          )}
        </button>
      )}
      {showSignIn && <SignInPromptModal onClose={() => setShowSignIn(false)} />}
    </div>
  );
}

function GameDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex gap-4">
          <div className="h-28 w-20 shrink-0 rounded-md bg-muted" />
          <div className="min-w-0 flex-1 pt-1">
            <div className="mb-2 h-6 w-2/3 rounded bg-muted" />
            <div className="mb-3 flex gap-1.5">
              <div className="h-5 w-14 rounded-full bg-muted" />
              <div className="h-5 w-18 rounded-full bg-muted" />
              <div className="h-5 w-12 rounded-full bg-muted" />
            </div>
            <div className="h-3.5 w-1/2 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <div className="h-7 w-14 rounded-md bg-muted" />
          <div className="h-7 w-20 rounded-md bg-muted" />
          <div className="h-7 w-12 rounded-md bg-muted" />
          <div className="h-7 w-16 rounded-md bg-muted" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3.5 w-full rounded bg-muted" />
          <div className="h-3.5 w-11/12 rounded bg-muted" />
          <div className="h-3.5 w-4/5 rounded bg-muted" />
          <div className="h-3.5 w-3/4 rounded bg-muted" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-28 w-48 shrink-0 rounded-md bg-muted" />
          <div className="h-28 w-48 shrink-0 rounded-md bg-muted" />
          <div className="h-28 w-48 shrink-0 rounded-md bg-muted" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-28 rounded-md bg-muted" />
          <div className="h-8 w-20 rounded-md bg-muted" />
          <div className="h-8 w-16 rounded-md bg-muted" />
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="h-4 w-20 rounded bg-muted" />
        </div>
        <div className="divide-y divide-border px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
              <div className="h-7 w-20 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RatingBadge({ value, label }: { value: number; label: string }) {
  const score = Math.round(value);
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        style={{ color, borderColor: `${color}55`, backgroundColor: `${color}18` }}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold"
      >
        {score}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function GameDetail() {
  const { igdbId } = useParams();
  const navigate = useNavigate();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: game, isPending, isFetched } = useQuery({
    queryKey: ["game", igdbId],
    queryFn: () => getGameDetail(igdbId!),
    enabled: !!igdbId,
  });

  const { data: journeyPlayers } = useQuery({
    queryKey: ["game", igdbId, "journeys"],
    queryFn: () => getGameJourneys(igdbId!),
    enabled: !!igdbId,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {isPending && <GameDetailSkeleton />}

      {isFetched && !game && (
        <div className="pt-8 text-center text-muted-foreground">Game not found.</div>
      )}

      {game && (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            {/* Title row */}
            <div className="flex gap-4">
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md bg-slate-800">
                {game.coverUrl
                  ? <img src={game.coverUrl} alt={game.name} className="absolute inset-0 h-full w-full object-cover" />
                  : <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-slate-300">{game.name[0]}</span>
                }
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="mb-1.5 text-xl font-bold">
                  {game.name}
                  {game.releaseYear && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({game.releaseYear})</span>
                  )}
                </h1>
                <div className="mb-2.5 flex flex-wrap gap-1">
                  {game.genres.map((g) => <GenreChip key={g} genre={g} />)}
                </div>
                {(game.developer || game.publisher) && (
                  <p className="text-xs text-muted-foreground">
                    {game.developer === game.publisher || !game.publisher
                      ? game.developer
                      : !game.developer
                        ? game.publisher
                        : `${game.developer} · ${game.publisher}`}
                  </p>
                )}
              </div>
            </div>

            {/* Platforms */}
            {game.platforms.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {game.platforms.map((p) => <PlatformBadge key={p} name={p} />)}
              </div>
            )}

            {/* Ratings */}
            {(game.aggregatedRating != null || game.rating != null) && (
              <div className="mt-4 flex gap-4">
                {game.aggregatedRating != null && (
                  <RatingBadge value={game.aggregatedRating} label="Critics" />
                )}
                {game.rating != null && (
                  <RatingBadge value={game.rating} label="Users" />
                )}
              </div>
            )}

            {/* Summary */}
            {game.summary && (
              <p className="mt-4 text-sm leading-relaxed text-foreground/80">{game.summary}</p>
            )}

            {/* Screenshots */}
            {game.screenshots.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {game.screenshots.slice(0, 3).map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxUrl(url)}
                    aria-label={`View screenshot ${i + 1}`}
                    className="shrink-0 overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <img
                      src={url}
                      alt={`${game.name} screenshot ${i + 1}`}
                      className="h-28 w-auto object-cover transition-opacity hover:opacity-80"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Links */}
            <div className="mt-4 flex flex-wrap gap-2">
              {game.trailerId && (
                <a
                  href={`https://www.youtube.com/watch?v=${game.trailerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Watch trailer
                  <ExternalLink size={11} />
                </a>
              )}
              {STORE_LABELS.filter(({ key }) => game.storeLinks[key]).map(({ key, label, color, bg, icon }) => (
                <a
                  key={key}
                  href={game.storeLinks[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color, backgroundColor: bg, borderColor: `${color}44` }}
                  className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                >
                  {icon}
                  {label}
                  <ExternalLink size={10} />
                </a>
              ))}
              <a
                href={`https://www.igdb.com/games/${igdbSlug(game.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                IGDB
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Journeys */}
          <div className="mt-4 rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Journeys</h2>
            </div>

            {journeyPlayers?.self && (
              <div className="px-4">
                <div className="divide-y divide-border">
                  <JourneyPlayerRow entry={journeyPlayers.self} />
                </div>
              </div>
            )}

            {(journeyPlayers?.following ?? []).length > 0 && (
              <div className="px-4">
                <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Following
                </p>
                <div className="divide-y divide-border">
                  {journeyPlayers!.following.map((entry) => (
                    <JourneyPlayerRow key={entry.player.id} entry={entry} />
                  ))}
                </div>
              </div>
            )}

            {(journeyPlayers?.others ?? []).length > 0 && (
              <div className="px-4 pb-2">
                <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Others
                </p>
                <div className="divide-y divide-border">
                  {journeyPlayers!.others.map((entry) => (
                    <JourneyPlayerRow key={entry.player.id} entry={entry} />
                  ))}
                </div>
              </div>
            )}

            {journeyPlayers && !journeyPlayers.self && journeyPlayers.following.length + journeyPlayers.others.length === 0 && (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                No journeys logged yet.
              </p>
            )}
          </div>
        </>
      )}

      <div className="h-8" />

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-label="Screenshot preview"
        >
          <img
            src={lightboxUrl}
            alt="Screenshot"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
