// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { uploadAvatar, ACCEPTED_AVATAR_TYPES, MAX_AVATAR_BYTES } from "@/services/avatar";
import type { Player } from "@/models/player";

interface AvatarUploadProps {
  player: Player;
  size?: "sm" | "lg";
  onUploaded: () => void;
}

/**
 * Clickable avatar that triggers a file picker. On selection it runs the full
 * presigned-URL upload flow and calls onUploaded with the new public URL.
 */
export default function AvatarUpload({ player, size = "lg", onUploaded }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dim = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const textSize = size === "lg" ? "text-xl" : "text-sm";

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
    setUploading(true);
    try {
      await uploadAvatar(file);
      onUploaded();
    } catch (err) {
      if (err instanceof Error && err.message === "too_large") {
        setError("Image must be under 2 MB.");
      } else {
        setError("Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change avatar"
        className={`group relative ${dim} shrink-0 cursor-pointer rounded-full disabled:cursor-wait`}
      >
        <PlayerAvatar player={player} className={`h-full w-full ${textSize}`} />

        {/* Hover / loading overlay */}
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-100">
          {uploading ? (
            <Loader2 size={size === "lg" ? 20 : 14} className="animate-spin text-white" />
          ) : (
            <Upload size={size === "lg" ? 16 : 12} className="text-white" />
          )}
        </div>
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AVATAR_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
