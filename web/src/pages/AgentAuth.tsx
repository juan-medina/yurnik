// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { getAgentToken, SessionExpiredError } from "@/services/auth";

type State = "loading" | "success" | "error";

export default function AgentAuth() {
  const navigate = useNavigate();
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
          navigate("/login", { replace: true });
        } else {
          setState("error");
        }
      });
  }, [navigate]);

  if (state === "success") {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-foreground">Agent connected</p>
          <p className="text-sm text-muted-foreground">You can close this tab.</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Failed to connect agent. Try again.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Connecting agent…</p>
    </div>
  );
}
