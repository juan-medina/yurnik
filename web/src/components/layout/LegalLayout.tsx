// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

const CONTACT_EMAIL = "privacy@yurnik.example";

export function withEmailLink(text: string): React.ReactNode {
  const parts = text.split(CONTACT_EMAIL);
  if (parts.length === 1) return text;

  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <a key={i} href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>,
          part,
        ],
  );
}

type LegalLayoutProps = { title: string; updated: string; children: React.ReactNode };

export default function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background/80 px-6 backdrop-blur-sm">
        <Link
          to="/lore"
          className="flex items-center gap-2 font-bold tracking-tight text-primary"
        >
          <img src="/favicon-32x32.png" alt="" aria-hidden className="h-5 w-5" />
          yurnik
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
