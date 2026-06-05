// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { API_BASE, apiFetch } from "@/lib/api";

export const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_AVATAR_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Uploads the avatar file to the API, which validates, writes to R2, and
 * persists the URL. The file is sent as the raw request body.
 */
/** Removes the custom avatar, reverting to the Discord avatar. */
export async function removeAvatar(): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/me/avatar`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`remove avatar: ${resp.status}`);
}

export async function uploadAvatar(file: File): Promise<void> {
  const resp = await apiFetch(`${API_BASE}/api/me/avatar`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (resp.status === 413) throw new Error("too_large");
  if (resp.status === 400) throw new Error("invalid_type");
  if (!resp.ok) throw new Error(`upload avatar: ${resp.status}`);
}
