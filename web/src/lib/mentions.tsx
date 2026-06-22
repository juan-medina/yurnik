// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { Link } from "react-router";
import type { CommentMention } from "@/models";

// Splices each mention's *current* handle into the comment text at its
// recorded offset, so a Discord rename after the comment was posted is
// reflected immediately — the stored text itself never changes. A mention
// whose target has since been deleted simply won't be in the mentions
// array (the comment_mentions row cascades away), so it silently renders
// as the original plain "@handle" text typed in the comment body.
export function renderCommentText(text: string, mentions: CommentMention[]): React.ReactNode {
  if (mentions.length === 0) return text;
  const chars = Array.from(text);
  const sorted = [...mentions].sort((a, b) => a.startOffset - b.startOffset);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.startOffset < cursor || m.startOffset + m.length > chars.length) continue;
    parts.push(chars.slice(cursor, m.startOffset).join(""));
    parts.push(
      <Link key={`${m.userId}-${m.startOffset}`} to={`/player/${m.handle}`} className="font-medium text-primary hover:underline">
        @{m.handle}
      </Link>,
    );
    cursor = m.startOffset + m.length;
  }
  parts.push(chars.slice(cursor).join(""));
  return parts;
}
