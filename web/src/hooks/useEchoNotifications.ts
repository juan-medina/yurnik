// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Echo } from "@/models";
import { useDesktopNotifications } from "./useDesktopNotifications";

export function useEchoNotifications(echoes: Echo[]) {
  const { t } = useTranslation();
  const { enabled } = useDesktopNotifications();
  // Echoes batch repeat activity (e.g. multiple commenters) into one row, so an
  // id alone doesn't tell us whether there's new activity since the last popup —
  // updatedAt does, since every upsert bumps it.
  const seenKeys = useRef<Set<string> | null>(null);

  useEffect(() => {
    const unread = echoes.filter((e) => !e.read);
    const keyOf = (e: Echo) => `${e.id}:${e.updatedAt.getTime()}`;

    // First run: just record the current unread set, don't notify retroactively.
    if (seenKeys.current === null) {
      seenKeys.current = new Set(unread.map(keyOf));
      return;
    }

    for (const echo of unread) {
      const key = keyOf(echo);
      if (seenKeys.current.has(key)) continue;
      seenKeys.current.add(key);
      if (!enabled) continue;

      const actor = echo.actors[0]?.name ?? t("echoes_someone");
      const title = echo.subjectTitle ?? "";
      const body =
        echo.type === "new_comment"
          ? t("notif_new_comment_body", { actor, title })
          : echo.type === "new_comment_reply"
            ? t("notif_new_comment_reply_body", { actor, title })
            : t("notif_new_follower_body", { actor });
      new Notification(t("notif_title"), { body, icon: "/favicon-32x32.png" });
    }
  }, [echoes, enabled, t]);
}
