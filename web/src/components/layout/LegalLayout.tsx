// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

const PRIVACY_EMAIL = "privacy@yurnik.example";
export const CONTACT_EMAIL = "contact@yurnik.example";

/** Replaces occurrences of email in text with a mailto anchor. */
function makeEmailLink(text: string, email: string): React.ReactNode {
  const parts = text.split(email);
  if (parts.length === 1) return text;
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <a key={i} href={`mailto:${email}`} className="text-primary hover:underline">
            {email}
          </a>,
          part,
        ],
  );
}

export function withEmailLink(text: string): React.ReactNode {
  return makeEmailLink(text, PRIVACY_EMAIL);
}

export function withContactLink(text: string): React.ReactNode {
  return makeEmailLink(text, CONTACT_EMAIL);
}

type Substitution = { match: string; node: React.ReactNode };

/**
 * Replaces multiple substrings in text with React nodes in a single pass.
 * Substitutions are applied left-to-right; non-overlapping occurrences only.
 */
export function withLinks(text: string, subs: Substitution[]): React.ReactNode {
  // Build a regex that matches any of the target strings, capturing which one matched.
  const escaped = subs.map((s) => s.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const sub = subs.find((s) => s.match === part);
    return sub ? <span key={i}>{sub.node}</span> : part;
  });
}

type LegalLayoutProps = { title: string; updated: string; children: React.ReactNode };

export default function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background/80 px-6 backdrop-blur-sm">
        <Link
          to="/lore"
          className="flex items-center gap-2 font-bold tracking-tight"
        >
          <img src="/favicon-32x32.png" alt="" aria-hidden className="h-5 w-5" />
          <span className="bg-gradient-to-r from-blue-400 via-primary to-orange-400 bg-clip-text text-transparent">
            yurnik
          </span>
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("legal_last_updated", { date: updated })}</p>
        <div className="mt-8 space-y-8">{children}</div>
        <div className="mt-12 border-t border-border pt-6">
          <Link
            to="/"
            className="text-sm font-semibold text-primary transition-colors hover:underline"
          >
            {t("not_found_back")}
          </Link>
        </div>
      </main>
    </div>
  );
}
