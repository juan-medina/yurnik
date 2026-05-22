// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Camera, Check, Clock, Heart, Pencil } from "lucide-react";
import {
  MY_PLAYER,
  MY_PLAYER_ID,
  SESSIONS,
  avatarSrc,
  initials,
  type MockSession,
} from "@/lib/mock";

const MY_SESSIONS = SESSIONS.filter((s) => s.player.id === MY_PLAYER_ID);

function totalHours(sessions: MockSession[]): string {
  const mins = sessions.reduce((acc, s) => {
    const h = parseInt(s.duration.match(/(\d+)h/)?.[1] ?? "0");
    const m = parseInt(s.duration.match(/(\d+)m/)?.[1] ?? "0");
    return acc + h * 60 + m;
  }, 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function Hero() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(() => avatarSrc(MY_PLAYER));

  const [displayName, setDisplayName] = useState(MY_PLAYER.name);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(displayName);

  const [bio, setBio] = useState(MY_PLAYER.bio ?? "");
  const [editingBio, setEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState(bio);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  function saveName() {
    setDisplayName(draftName.trim() || displayName);
    setEditingName(false);
  }

  function cancelName() {
    setDraftName(displayName);
    setEditingName(false);
  }

  function saveBio() {
    setBio(draftBio.trim() || bio);
    setEditingBio(false);
  }

  function cancelBio() {
    setDraftBio(bio);
    setEditingBio(false);
  }

  function toggleLike(id: string) {
    setLikedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Profile card */}
      <div className="mb-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="group relative h-16 w-16 shrink-0">
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full rounded-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                target.nextElementSibling?.removeAttribute("hidden");
              }}
            />
            <div
              hidden
              className="flex h-full w-full items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: MY_PLAYER.color }}
            >
              {initials(displayName)}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Edit avatar"
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Camera size={18} className="text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload avatar"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setAvatarUrl(URL.createObjectURL(file));
              }}
            />
          </div>

          {/* Name, handle, bio */}
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="mb-3">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  aria-label="Display name"
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-lg font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={saveName}
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  >
                    <Check size={12} />
                    Save
                  </button>
                  <button
                    onClick={cancelName}
                    className="rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-1 flex items-center gap-2">
                <p className="text-xl font-bold leading-tight">{displayName}</p>
                <button
                  onClick={() => {
                    setDraftName(displayName);
                    setEditingName(true);
                  }}
                  aria-label="Edit name"
                  className="shrink-0 rounded-md p-0.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}

            <p className="mb-3 text-sm text-muted-foreground">@{MY_PLAYER.handle}</p>

            {editingBio ? (
              <div>
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={2}
                  aria-label="Bio"
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={saveBio}
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  >
                    <Check size={12} />
                    Save
                  </button>
                  <button
                    onClick={cancelBio}
                    className="rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-sm text-muted-foreground">{bio}</p>
                <button
                  onClick={() => {
                    setDraftBio(bio);
                    setEditingBio(true);
                  }}
                  aria-label="Edit bio"
                  className="shrink-0 rounded-md p-0.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 divide-x divide-border rounded-lg border border-border bg-card">
        {[
          { label: "Journeys", value: MY_SESSIONS.length },
          { label: "Hours", value: totalHours(MY_SESSIONS) },
          { label: "Followers", value: MY_PLAYER.followers ?? 0 },
          { label: "Following", value: MY_PLAYER.following ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center py-4">
            <span className="text-lg font-bold">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Journeys */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Your journeys
      </h2>

      {MY_SESSIONS.length > 0 ? (
        <div className="flex flex-col gap-3">
          {MY_SESSIONS.map((session) => {
            const liked = likedIds.has(session.id);
            const count = session.likes + (liked ? 1 : 0);
            return (
              <article
                key={session.id}
                className="flex cursor-pointer gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
                onClick={() => navigate(`/journey/${session.id}`)}
              >
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md"
                  style={{ backgroundColor: session.coverColor }}
                >
                  <span
                    className="absolute inset-0 flex items-center justify-center text-2xl font-bold"
                    style={{ color: session.coverAccent }}
                  >
                    {session.game[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1">
                    <span className="text-xs text-muted-foreground">{session.timestamp}</span>
                  </div>
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-bold">{session.game}</span>
                    <div className="flex flex-wrap gap-1">
                      {session.genres.map((g) => (
                        <span
                          key={g}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>{session.duration}</span>
                  </div>
                  {session.log && (
                    <p className="mb-2 text-sm italic text-muted-foreground">
                      &ldquo;{session.log}&rdquo;
                    </p>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(session.id);
                    }}
                    aria-label={liked ? "Unlike" : "Like"}
                    className="flex items-center gap-1.5 transition-colors"
                  >
                    <Heart
                      size={15}
                      className={
                        liked
                          ? "fill-rose-500 text-rose-500"
                          : "text-muted-foreground hover:text-rose-400"
                      }
                    />
                    {count > 0 && (
                      <span
                        className={`text-xs ${liked ? "text-rose-500" : "text-muted-foreground"}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No journeys yet.
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
