// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect } from "react";

export function usePageTitle(title: string | undefined): void {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} — Yurnik`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
