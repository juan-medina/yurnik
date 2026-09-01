// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAgentToken, SessionExpiredError, signIn } from "@/services/auth";

type State = "loading" | "success" | "error";

export default function AgentAuth() {
  const { t } = useTranslation();
  const started = useRef(false);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    // Strict Mode double-invocation guard.
    if (started.current) return;
    started.current = true;

    getAgentToken()
      .then((token) => {
        window.location.href = `yurnik://auth?token=${encodeURIComponent(token)}`;
        setState("success");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          sessionStorage.setItem("auth_next", "/auth/agent");
          signIn();
        } else {
          setState("error");
        }
      });
  }, []);

  if (state === "success") {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-foreground">{t("agent_connected")}</p>
          <p className="text-sm text-muted-foreground">{t("agent_close_tab")}</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">{t("agent_failed")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">{t("agent_connecting")}</p>
    </div>
  );
}
