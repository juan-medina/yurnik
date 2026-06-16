// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { Player } from "@/models/player";
import { LimitedTextarea } from "@/components/LimitedTextarea";

interface EditProfileModalProps {
  player: Player;
  onSave: (patch: { displayName?: string; bio?: string }) => Promise<void>;
  onClose: () => void;
}

export default function EditProfileModal({ player, onSave, onClose }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(player.name);
  const [bio, setBio] = useState(player.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const patch: { displayName?: string; bio?: string } = {};

    // Only send fields that changed
    if (displayName.trim() !== player.name) patch.displayName = displayName.trim();
    if ((bio.trim() || "") !== (player.bio ?? "")) patch.bio = bio.trim();

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(patch);
      onClose();
    } catch {
      setError("Save failed. Please try again.");
      setSaving(false);
    }
  }

  function handleRevertName() {
    // Empty string signals the API to revert to Discord name
    setDisplayName("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Edit profile</h2>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {/* Display name */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="edit-display-name" className="text-sm font-medium">Display name</label>
            {player.hasCustomName && (
              <button
                type="button"
                onClick={handleRevertName}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw size={11} />
                Use Discord name
              </button>
            )}
          </div>
          <input
            id="edit-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            placeholder="Your Discord name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Bio */}
        <div className="mb-5">
          <LimitedTextarea
            label="Bio"
            value={bio}
            onChange={setBio}
            placeholder="Tell your story…"
            rows={4}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
