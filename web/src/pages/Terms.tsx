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

export default function Terms() {
  const { t } = useTranslation();

  return (
    <LegalLayout title={t("terms_title")} updated={t("legal_updated_date")}>
      <Section title={t("terms_intro_title")} body={t("terms_intro_body")} />
      <Section title={t("terms_account_title")} body={t("terms_account_body")} />
      <Section title={t("terms_content_title")} body={t("terms_content_body")} />
      <Section title={t("terms_conduct_title")} body={t("terms_conduct_body")} />
      <Section title={t("terms_termination_title")} body={t("terms_termination_body")} />
      <Section title={t("terms_changes_title")} body={t("terms_changes_body")} />
      <Section title={t("terms_contact_title")} body={withEmailLink(t("terms_contact_body"))} />
    </LegalLayout>
  );
}
