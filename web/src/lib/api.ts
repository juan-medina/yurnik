// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class RateLimitedError extends Error {
  /** Seconds the caller should wait before retrying, from the Retry-After header. */
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("too many requests");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const resp = await fetch(input, init);
  if (resp.status === 429) {
    const retryAfter = Number.parseInt(resp.headers.get("Retry-After") ?? "", 10);
    throw new RateLimitedError(Number.isNaN(retryAfter) ? 0 : retryAfter);
  }
  return resp;
}
