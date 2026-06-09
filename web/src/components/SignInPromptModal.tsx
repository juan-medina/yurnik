// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { signIn } from "@/services/auth";

type Props = { onClose: () => void };

export default function SignInPromptModal({ onClose }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t("modal_close")}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={18} />
        </button>
        <div className="flex flex-col items-center gap-4 text-center">
          <img src="/logo.png" alt="Yurnik" className="h-10 w-10 object-contain" />
          <div>
            <h2 className="font-semibold text-foreground">{t("signin_prompt_title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("signin_prompt_sub")}</p>
          </div>
          <button
            onClick={() => signIn()}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("lore_cta_primary")}
          </button>
        </div>
      </div>
    </div>
  );
}
