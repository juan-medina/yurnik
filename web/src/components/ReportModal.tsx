// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { LimitedTextarea } from "@/components/LimitedTextarea";
import { submitReport } from "@/services/reports";
import { useCooldown } from "@/hooks/useCooldown";
import { RateLimitedError } from "@/lib/api";
import type { ReportReason, ReportTargetType } from "@/models";

const REASONS: ReportReason[] = [
  "spam",
  "harassment",
  "hate_speech",
  "explicit",
  "impersonation",
  "private_info",
  "other",
];

const REASON_KEYS: Record<ReportReason, string> = {
  spam: "report_reason_spam",
  harassment: "report_reason_harassment",
  hate_speech: "report_reason_hate_speech",
  explicit: "report_reason_explicit",
  impersonation: "report_reason_impersonation",
  private_info: "report_reason_private_info",
  other: "report_reason_other",
};

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  contextId?: string;
  onClose: () => void;
};

export default function ReportModal({ targetType, targetId, contextId, onClose }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const cooldown = useCooldown();

  const mutation = useMutation({
    mutationFn: () =>
      submitReport(targetType, targetId, reason as ReportReason, note || undefined, contextId),
    onSuccess: () => setSubmitted(true),
    onError: (err) => {
      if (err instanceof RateLimitedError) {
        cooldown.start(err.retryAfterSeconds);
      } else if (err instanceof Error && err.message === "already_reported") {
        setAlreadyReported(true);
      }
    },
  });

  const noteRequired = reason === "other";
  const canSubmit =
    reason !== "" &&
    cooldown.remaining === 0 &&
    (!noteRequired || note.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-semibold">{t("report_title")}</p>
            <p className="text-xs text-muted-foreground">{t(`report_${targetType}`)}</p>
          </div>
          <button onClick={onClose} aria-label={t("modal_close")} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("report_success")}</p>
        ) : alreadyReported ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("report_already")}</p>
        ) : (
          <>
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("report_reason_label")}</p>
              <div className="flex flex-col gap-1">
                {REASONS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-primary"
                    />
                    {t(REASON_KEYS[r])}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <LimitedTextarea
                value={note}
                onChange={setNote}
                label={t("report_note_label")}
                optionalLabel={noteRequired ? t("report_note_required") : t("report_note_optional")}
                placeholder={t("report_note_placeholder")}
                maxLength={200}
                rows={2}
              />
            </div>

            {cooldown.remaining > 0 && (
              <p className="mb-2 text-xs text-destructive">
                {t("report_slow_down", { seconds: cooldown.remaining })}
              </p>
            )}
            {mutation.isError && cooldown.remaining === 0 && !(mutation.error instanceof Error && mutation.error.message === "already_reported") && (
              <p className="mb-2 text-xs text-destructive">{t("report_error")}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                {t("report_cancel")}
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={!canSubmit || mutation.isPending}
                className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {t("report_submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
