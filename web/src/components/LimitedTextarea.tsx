// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { MAX_TEXT_LENGTH } from "@/lib/constants";

export function CharCounter({ value, max = MAX_TEXT_LENGTH }: { value: string; max?: number }) {
  const remaining = max - value.length;
  return (
    <span className={`text-xs ${remaining < 20 ? "text-destructive" : "text-muted-foreground/60"}`}>
      {remaining}
    </span>
  );
}

type LimitedTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  optionalLabel?: string;
  placeholder: string;
  rows?: number;
  maxLength?: number;
  className?: string;
};

// LimitedTextarea is a textarea with a character counter. Use it for any
// free-text field that enforces a max length (bio, journey log, comments).
export function LimitedTextarea({ value, onChange, label, optionalLabel, placeholder, rows = 3, maxLength = MAX_TEXT_LENGTH, className }: LimitedTextareaProps) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-muted-foreground">
          <span>
            {label}{optionalLabel && (
              <>
                {" "}
                <span className="font-normal text-muted-foreground/60">{optionalLabel}</span>
              </>
            )}
          </span>
          <CharCounter value={value} max={maxLength} />
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={className ?? "w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"}
      />
    </div>
  );
}
