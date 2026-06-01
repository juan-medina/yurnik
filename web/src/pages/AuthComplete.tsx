// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { completeSignIn } from "@/services/auth";

export default function AuthComplete() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    // Strict Mode double-invocation guard.
    if (started.current) return;
    started.current = true;

    completeSignIn()
      .then(() => {
        const next = sessionStorage.getItem("auth_next");
        if (next) {
          sessionStorage.removeItem("auth_next");
          navigate(next, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      })
      .catch(() => navigate("/login?error=auth_failed", { replace: true }));
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Completing sign in…</p>
    </div>
  );
}
