// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useTranslation } from "react-i18next";
import LegalLayout from "@/components/layout/LegalLayout";

const ENTRIES = [
  { key: "2026_06_23_session", date: "2026-06-23" },
  { key: "2026_06_23_agent", date: "2026-06-23" },
  { key: "2026_06_22_og", date: "2026-06-22" },
  { key: "2026_06_22_roll", date: "2026-06-22" },
  { key: "2026_06_22", date: "2026-06-22" },
  { key: "2026_06_21", date: "2026-06-21" },
  { key: "2026_06_17", date: "2026-06-17" },
  { key: "2026_06_15", date: "2026-06-15" },
  { key: "2026_06_11", date: "2026-06-11" },
  { key: "2026_06_09", date: "2026-06-09" },
  { key: "2026_06_05", date: "2026-06-05" },
] as const;

function Entry({ date, title, body }: { date: string; title: string; body: string }) {
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

  return (
    <LegalLayout title={t("whats_new_title")} updated={t("legal_updated_date")}>
      {ENTRIES.map(({ key, date }) => (
        <Entry
          key={key}
          date={date}
          title={t(`whats_new_${key}_title`)}
          body={t(`whats_new_${key}_body`)}
        />
      ))}
    </LegalLayout>
  );
}
