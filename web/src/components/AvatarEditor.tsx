// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload, X } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import {
  uploadAvatar,
  removeAvatar,
  ACCEPTED_AVATAR_TYPES,
  ACCEPTED_AVATAR_EXTENSIONS,
  MAX_AVATAR_BYTES,
} from "@/services/avatar";
import type { Player } from "@/models/player";

interface AvatarEditorProps {
  player: Player;
  size?: "sm" | "lg";
  onChanged: () => void;
}

type State = "idle" | "uploading" | "removing";

/**
 * Avatar with a persistent camera badge. Clicking opens a modal with
 * Upload and Remove (if custom avatar set) options.
 */
export default function AvatarEditor({ player, size = "lg", onChanged }: AvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const dim = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const textSize = size === "lg" ? "text-xl" : "text-sm";
  const badgeSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const badgeIcon = size === "lg" ? 11 : 9;

  function openModal() {
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    if (state !== "idle") return;
    setOpen(false);
    setError(null);
  }

  async function handleFile(file: File) {
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be under 2 MB.");
      return;
    }

    setError(null);
    setState("uploading");
    try {
      await uploadAvatar(file);
      setState("idle");
      setOpen(false);
      onChanged();
    } catch (err) {
      setState("idle");
      if (err instanceof Error && err.message === "too_large") {
        setError("Image must be under 2 MB.");
      } else {
        setError("Upload failed. Please try again.");
      }
    }
  }

  async function handleRemove() {
    setError(null);
    setState("removing");
    try {
      await removeAvatar();
      setState("idle");
      setOpen(false);
      onChanged();
    } catch {
      setState("idle");
      setError("Failed to remove avatar. Please try again.");
    }
  }

  const busy = state !== "idle";

  return (
    <>
      {/* Avatar with camera badge */}
      <button
        type="button"
        onClick={openModal}
        aria-label="Edit avatar"
        className={`relative ${dim} shrink-0 cursor-pointer rounded-full`}
      >
        <PlayerAvatar key={player.avatarUrl} player={player} className={`h-full w-full ${textSize}`} />

        {/* Persistent camera badge */}
        <div
          className={`absolute bottom-0 right-0 ${badgeSize} flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card`}
        >
          <Camera size={badgeIcon} />
        </div>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Change avatar</h2>
              <button
                onClick={closeModal}
                disabled={busy}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Current avatar preview */}
            <div className="mb-4 flex justify-center">
              <div className="relative h-20 w-20">
                <PlayerAvatar key={player.avatarUrl} player={player} className="h-full w-full text-2xl" />
              </div>
            </div>

            {error && (
              <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {state === "uploading" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Upload size={15} />
                )}
                {state === "uploading" ? "Uploading…" : "Upload image"}
              </button>

              {player.hasCustomAvatar && (
                <button
                  onClick={handleRemove}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {state === "removing" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  {state === "removing" ? "Removing…" : "Use Discord avatar"}
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              JPEG, PNG or WebP · max 2 MB
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AVATAR_EXTENSIONS}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
