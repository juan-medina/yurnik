// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useTranslation } from "react-i18next";
import LegalLayout, { withEmailLink } from "@/components/layout/LegalLayout";

function Section({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}

export default function Privacy() {
  const { t } = useTranslation();

  return (
    <LegalLayout title={t("privacy_title")} updated={t("legal_updated_date")}>
      <Section title={t("privacy_intro_title")} body={t("privacy_intro_body")} />
      <Section title={t("privacy_data_title")} body={t("privacy_data_body")} />
      <Section title={t("privacy_igdb_title")} body={t("privacy_igdb_body")} />
      <Section title={t("privacy_why_title")} body={t("privacy_why_body")} />
      <Section title={t("privacy_retention_title")} body={t("privacy_retention_body")} />
      <Section title={t("privacy_rights_title")} body={t("privacy_rights_body")} />
      <Section title={t("privacy_contact_title")} body={withEmailLink(t("privacy_contact_body"))} />
    </LegalLayout>
  );
}
