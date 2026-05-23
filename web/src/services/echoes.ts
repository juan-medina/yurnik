// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Echo } from "@/models/echo";
import { MOCK_ECHOES } from "@/lib/mock";

const readIds = new Set<string>(MOCK_ECHOES.filter((e) => e.read).map((e) => e.id));

export async function getEchoes(): Promise<Echo[]> {
  return MOCK_ECHOES.map((e) => ({ ...e, read: readIds.has(e.id) }));
}

export async function markAllRead(): Promise<void> {
  MOCK_ECHOES.forEach((e) => readIds.add(e.id));
}

export function _reset(): void {
  readIds.clear();
  MOCK_ECHOES.filter((e) => e.read).forEach((e) => readIds.add(e.id));
}
