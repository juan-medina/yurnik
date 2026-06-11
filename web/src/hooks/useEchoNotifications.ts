// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Echo } from "@/models";
import { useDesktopNotifications } from "./useDesktopNotifications";

export function useEchoNotifications(echoes: Echo[]) {
  const { t } = useTranslation();
  const { enabled } = useDesktopNotifications();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const unread = echoes.filter((e) => !e.read);

    // First run: just record the current unread set, don't notify retroactively.
    if (seenIds.current === null) {
      seenIds.current = new Set(unread.map((e) => e.id));
      return;
    }

    for (const echo of unread) {
      if (seenIds.current.has(echo.id)) continue;
      seenIds.current.add(echo.id);
      if (!enabled) continue;

      const actor = echo.actors[0]?.name ?? t("echoes_someone");
      const body =
        echo.type === "new_comment"
          ? t("notif_new_comment_body", { actor, title: echo.subjectTitle ?? "" })
          : t("notif_new_follower_body", { actor });
      new Notification(t("notif_title"), { body, icon: "/favicon-32x32.png" });
    }
  }, [echoes, enabled, t]);
}
