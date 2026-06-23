// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useTranslation } from "react-i18next";
import LegalLayout from "@/components/layout/LegalLayout";

interface WhatsNewEntry {
  date: string;
  title: string;
  body: string;
}

function Entry({ date, title, body }: WhatsNewEntry) {
  return (
    <section>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{date}</p>
      <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}

export default function WhatsNew() {
  const { t } = useTranslation();
  const rawEntries = t("whats_new_entries", { returnObjects: true });
  const entries = Array.isArray(rawEntries) ? (rawEntries as WhatsNewEntry[]) : [];

  return (
    <LegalLayout title={t("whats_new_title")} updated={t("legal_updated_date")}>
      {entries.map((entry, index) => (
        <Entry
          key={index}
          date={entry.date}
          title={entry.title}
          body={entry.body}
        />
      ))}
    </LegalLayout>
  );
}

