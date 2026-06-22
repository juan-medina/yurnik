// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { lazy, Suspense, useRef, useState, useEffect } from "react";
import { Smile } from "lucide-react";
import { searchPlayers } from "@/services/players";
import type { Player } from "@/models/player";
import PlayerAvatar from "@/components/PlayerAvatar";

// @emoji-mart/react and its data file are ~500kB; loaded only once the picker is opened.
const EmojiPicker = lazy(async () => {
  const [{ default: Picker }, { default: data }] = await Promise.all([
    import("@emoji-mart/react"),
    import("@emoji-mart/data"),
  ]);
  return { default: (props: Omit<React.ComponentProps<typeof Picker>, "data">) => <Picker data={data} {...props} /> };
});
// Must match the CHECK constraint in api/internal/migrations/0012_text_length_limits.up.sql
const MAX_TEXT_LENGTH = 400;

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
  label?: string;
  optionalLabel?: string;
  placeholder: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  // Rendered to the right of the emoji button in the bottom toolbar row
  toolbarRight?: React.ReactNode;
  // Enables @mention autocomplete while typing. Only comments use this —
  // bio and journey logs have no notion of mentioning another player.
  enableMentions?: boolean;
};

// Debounce so autocomplete doesn't fire a search request on every keystroke.
const MENTION_SEARCH_DEBOUNCE_MS = 250;

// LimitedTextarea is a textarea with a character counter and emoji picker.
// Use it for any free-text field that enforces a max length (bio, journey log, comments).
export function LimitedTextarea({ value, onChange, label, optionalLabel, placeholder, rows = 3, maxLength = MAX_TEXT_LENGTH, className, toolbarRight, enableMentions }: LimitedTextareaProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionResults, setMentionResults] = useState<Player[]>([]);
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest("[data-emoji-trigger]")
      ) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  // Debounced fetch of @mention candidates while mentionQuery is active.
  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }
    clearTimeout(mentionDebounceRef.current);
    mentionDebounceRef.current = setTimeout(async () => {
      const results = await searchPlayers(mentionQuery);
      setMentionResults(results);
    }, MENTION_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(mentionDebounceRef.current);
  }, [mentionQuery]);

  // After every keystroke, check whether the caret sits inside an "@token"
  // (no whitespace since the last "@") and update the active mention query.
  function updateMentionState(text: string, caret: number) {
    if (!enableMentions) return;
    const uptoCaret = text.slice(0, caret);
    const at = uptoCaret.lastIndexOf("@");
    if (at === -1 || /\s/.test(uptoCaret.slice(at, caret))) {
      setMentionQuery(null);
      return;
    }
    setMentionStart(at);
    setMentionQuery(uptoCaret.slice(at + 1));
  }

  function selectMention(player: Player) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? mentionStart;
    const next = value.slice(0, mentionStart) + "@" + player.handle + " " + value.slice(caret);
    if ([...next].length > maxLength) return;
    onChange(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = mentionStart + player.handle.length + 2;
      el?.setSelectionRange(pos, pos);
    });
  }

  function insertEmoji(emoji: { native: string }) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji.native + value.slice(end);

    if ([...next].length > maxLength) return;

    onChange(next);
    setPickerOpen(false);

    // Restore focus and move cursor after the inserted emoji
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.native.length;
      el.setSelectionRange(pos, pos);
    });
  }

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
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onClick={(e) => updateMentionState(value, e.currentTarget.selectionStart ?? value.length)}
          onKeyUp={(e) => updateMentionState(value, e.currentTarget.selectionStart ?? value.length)}
          onBlur={() => setMentionQuery(null)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={className ?? "w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"}
        />
        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card shadow-md">
            {mentionResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectMention(p); }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              >
                <PlayerAvatar player={p} className="h-6 w-6 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 truncate text-xs text-muted-foreground">@{p.handle}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Toolbar: emoji button left, optional slot right (e.g. Post button, char counter) */}
      <div className="relative mt-1 flex items-center justify-between">
        <button
          type="button"
          data-emoji-trigger
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Insert emoji"
          className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          <Smile size={16} />
        </button>
        {!label && <CharCounter value={value} max={maxLength} />}
        {toolbarRight}
        {pickerOpen && (
          <div ref={pickerRef} className="absolute bottom-full left-0 z-50 mb-1">
            <Suspense fallback={null}>
              <EmojiPicker
                onEmojiSelect={insertEmoji}
                theme="auto"
                previewPosition="none"
                skinTonePosition="search"
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
