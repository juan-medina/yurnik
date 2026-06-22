// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { renderCommentText } from "./mentions";
import type { CommentMention } from "@/models";

function renderText(text: string, mentions: CommentMention[]) {
  return render(<MemoryRouter>{renderCommentText(text, mentions)}</MemoryRouter>);
}

describe("renderCommentText", () => {
  it("returns the plain text unchanged when there are no mentions", () => {
    const { container } = renderText("just a normal comment, no mentions here", []);
    expect(container.textContent).toBe("just a normal comment, no mentions here");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a single mention as a link to the player's profile", () => {
    const mention: CommentMention = { userId: "u1", handle: "jdoe", name: "J Doe", startOffset: 4, length: 5 };
    renderText("hey @jdoe check this out", [mention]);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/player/jdoe");
    expect(link).toHaveTextContent("@jdoe");
    expect(screen.getByText(/hey/)).toBeInTheDocument();
    expect(screen.getByText(/check this out/)).toBeInTheDocument();
  });

  it("renders the mention's current handle even when it differs from what was typed (post-rename)", () => {
    // The comment body still literally says "@oldhandle" (never rewritten),
    // but the resolved mention now carries the user's renamed handle —
    // resolution is by stable user_id, not by matching the handle text.
    const mention: CommentMention = { userId: "u1", handle: "newhandle", name: "New Name", startOffset: 9, length: 10 };
    renderText("nice clip @oldhandle", [mention]);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/player/newhandle");
    expect(link).toHaveTextContent("@newhandle");
    expect(screen.queryByText(/oldhandle/)).not.toBeInTheDocument();
  });

  it("renders multiple mentions out of offset order correctly (sorts before splicing)", () => {
    const mentionB: CommentMention = { userId: "ub", handle: "bob", name: "Bob", startOffset: 9, length: 4 };
    const mentionA: CommentMention = { userId: "ua", handle: "alice", name: "Alice", startOffset: 0, length: 6 };
    // Passed in reverse offset order on purpose.
    renderText("@alice and @bob should play this", [mentionB, mentionA]);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/player/alice");
    expect(links[1]).toHaveAttribute("href", "/player/bob");
    expect(screen.getByText(/should play this/)).toBeInTheDocument();
  });

  it("accounts for multi-byte characters before the mention (rune offsets, not UTF-16 code units)", () => {
    // "café " is 5 runes; the mention starts right after it.
    const mention: CommentMention = { userId: "u1", handle: "jdoe", name: "J Doe", startOffset: 5, length: 5 };
    renderText("café @jdoe", [mention]);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("@jdoe");
    expect(screen.getByText(/café/)).toBeInTheDocument();
  });

  it("skips a mention whose offset no longer fits the text instead of rendering garbage", () => {
    // Defensive case — should never happen from the backend, but a mention
    // pointing past the end of the text must not crash rendering.
    const mention: CommentMention = { userId: "u1", handle: "jdoe", name: "J Doe", startOffset: 100, length: 5 };
    const { container } = renderText("short comment", [mention]);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.textContent).toBe("short comment");
  });

  it("renders plain text for a mention target that was deleted (mentions array simply omits it)", () => {
    // When the mentioned user deletes their account, the comment_mentions
    // row cascades away server-side — the comment is fetched with an empty
    // mentions array, and the original "@handle" text in the body renders
    // as plain text, same as an unresolved handle.
    renderText("go say hi to @ghostuser", []);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("go say hi to @ghostuser")).toBeInTheDocument();
  });
});
