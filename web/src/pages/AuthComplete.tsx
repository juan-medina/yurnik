// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { completeSignIn, AccountSuspendedError } from "@/services/auth";

export default function AuthComplete() {
  const { t } = useTranslation();
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
      .catch((err) => {
        if (err instanceof AccountSuspendedError) {
          navigate("/?error=suspended", { replace: true });
        } else {
          navigate("/?error=auth_failed", { replace: true });
        }
      });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">{t("auth_completing")}</p>
    </div>
  );
}
