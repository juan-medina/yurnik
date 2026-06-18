// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Globe2,
  Gamepad2,
  Users,
  ScrollText,
  Monitor,
  CheckCircle2,
  ArrowDown,
  Telescope,
} from "lucide-react";

function GitHubIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.562 21.8 24 17.302 24 12 24 5.373 18.627 0 12 0z" />
    </svg>
  );
}
import { getCurrentPlayer, signIn } from "@/services/auth";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

type FeatureCardProps = { icon: React.ReactNode; title: string; body: string };

function FeatureCard({ icon, title, body }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

type StepProps = { number: number; label: string };

function Step({ number, label }: StepProps) {
  return (
    <div className="flex w-28 flex-col items-center gap-2 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-sm font-bold text-primary">
        {number}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function LoreContent({ authenticated }: { authenticated: boolean }) {
  const { t } = useTranslation();

  const openPoints = [
    { title: t("lore_open_point_1_title"), sub: t("lore_open_point_1_sub") },
    { title: t("lore_open_point_2_title"), sub: t("lore_open_point_2_sub") },
    { title: t("lore_open_point_3_title"), sub: t("lore_open_point_3_sub") },
    { title: t("lore_open_point_4_title"), sub: t("lore_open_point_4_sub") },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-6 py-12 text-center sm:py-16">
        <div className="flex flex-col items-center gap-0.5">
          <img src="/logo.png" alt="Yurnik" className="w-24 sm:w-28" />
          <h1 className="bg-gradient-to-r from-blue-400 via-primary to-orange-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
            yurnik
          </h1>
        </div>
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">{t("lore_tagline")}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {authenticated ? (
            <Link
              to="/"
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("lore_auth_cta")}
            </Link>
          ) : (
            <>
              <button
                onClick={() => signIn()}
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("lore_cta_primary")}
              </button>
              <Link
                to="/players"
                className="rounded-md border border-border px-6 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                {t("home_explore_cta")}
              </Link>
              <a
                href="#how-it-works"
                className="flex items-center justify-center gap-2 rounded-md border border-border px-6 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                {t("lore_cta_secondary")}
                <ArrowDown size={14} />
              </a>
            </>
          )}
        </div>
        {!authenticated && (
          <p className="mt-2 text-xs text-muted-foreground/80">
            {t("legal_agree_prefix")}{" "}
            <Link to="/terms" className="underline hover:text-foreground">
              {t("legal_terms")}
            </Link>{" "}
            {t("legal_and")}{" "}
            <Link to="/privacy" className="underline hover:text-foreground">
              {t("legal_privacy")}
            </Link>
            .
          </p>
        )}
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-y border-border bg-muted/50 px-6 py-8"
      >
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t("lore_how_title")}
          </h2>
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
              <Step number={1} label={t("lore_step_play")} />
              <div className="hidden h-px w-12 self-center border-t border-dashed border-primary/30 sm:block" />
              <Step number={2} label={t("lore_step_confirm")} />
              <div className="hidden h-px w-12 self-center border-t border-dashed border-primary/30 sm:block" />
              <Step number={3} label={t("lore_step_share")} />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t("lore_features_title")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={<Globe2 size={18} />}
              title={t("lore_feature_realm_title")}
              body={t("lore_feature_realm_body")}
            />
            <FeatureCard
              icon={<ScrollText size={18} />}
              title={t("lore_feature_log_title")}
              body={t("lore_feature_log_body")}
            />
            <FeatureCard
              icon={<Users size={18} />}
              title={t("lore_feature_players_title")}
              body={t("lore_feature_players_body")}
            />
            <FeatureCard
              icon={<Monitor size={18} />}
              title={t("lore_feature_agent_title")}
              body={t("lore_feature_agent_body")}
            />
            <FeatureCard
              icon={<Telescope size={18} />}
              title={t("lore_feature_horizon_title")}
              body={t("lore_feature_horizon_body")}
            />
          </div>
        </div>
      </section>

      {/* Open */}
      <section className="border-y border-border bg-muted/50 px-6 py-14">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <Gamepad2 size={32} className="text-primary" />
          <h2 className="text-xl font-bold text-foreground">{t("lore_open_title")}</h2>
          <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
            {openPoints.map(({ title, sub }) => (
              <div key={title} className="flex items-start gap-3">
                <CheckCircle2 size={14} className="mt-1 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      {!authenticated && (
        <section className="flex flex-col items-center gap-4 bg-gradient-to-b from-primary/5 to-background px-6 py-20 text-center">
          <h2 className="text-2xl font-bold text-foreground">{t("lore_bottom_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("lore_bottom_sub")}</p>
          <button
            onClick={() => signIn()}
            className="mt-2 rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("lore_cta_primary")}
          </button>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground/60">
        <p className="flex items-center justify-center gap-2">
          {t("lore_footer_open")}
          <a
            href="https://github.com/juan-medina/yurnik"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <GitHubIcon size={13} />
            GitHub
          </a>
        </p>
        <p className="mt-2 flex items-center justify-center gap-3">
          <Link to="/terms" className="transition-colors hover:text-foreground">
            {t("legal_terms")}
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            {t("legal_privacy")}
          </Link>
        </p>
      </footer>
    </div>
  );
}

export default function Lore() {
  const { data: player, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation();

  if (isLoading) return null;

  if (!player) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <img src="/favicon-32x32.png" alt="" aria-hidden className="h-5 w-5" />
            <span className="bg-gradient-to-r from-blue-400 via-primary to-orange-400 bg-clip-text text-transparent">
              yurnik
            </span>
          </div>
          <button
            onClick={() => signIn()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("lore_signin")}
          </button>
        </header>
        <LoreContent authenticated={false} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-auto">
          <LoreContent authenticated={true} />
        </main>
      </div>
    </div>
  );
}
