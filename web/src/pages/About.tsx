// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  ArrowDown,
  Gamepad2,
} from "lucide-react";

import { getCurrentPlayer, signIn } from "@/services/auth";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Footer from "@/components/layout/Footer";



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

export function AboutContent({ authenticated }: { authenticated: boolean }) {
  const { t } = useTranslation();

  const openPoints = [
    { title: t("about_open_point_1_title"), sub: t("about_open_point_1_sub") },
    { title: t("about_open_point_2_title"), sub: t("about_open_point_2_sub") },
    { title: t("about_open_point_3_title"), sub: t("about_open_point_3_sub") },
    { title: t("about_open_point_4_title"), sub: t("about_open_point_4_sub") },
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
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">{t("about_tagline")}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {authenticated ? (
            <Link
              to="/"
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("about_auth_cta")}
            </Link>
          ) : (
            <>
              <button
                onClick={() => signIn()}
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("about_cta_primary")}
              </button>
              <Link
                to="/explore"
                className="rounded-md border border-border px-6 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                {t("home_explore_cta")}
              </Link>
              <a
                href="#how-it-works"
                className="flex items-center justify-center gap-2 rounded-md border border-border px-6 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                {t("about_cta_secondary")}
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
            {t("about_how_title")}
          </h2>
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
              <Step number={1} label={t("about_step_play")} />
              <div className="hidden h-px w-12 self-center border-t border-dashed border-primary/30 sm:block" />
              <Step number={2} label={t("about_step_confirm")} />
              <div className="hidden h-px w-12 self-center border-t border-dashed border-primary/30 sm:block" />
              <Step number={3} label={t("about_step_share")} />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Sections with Screenshots */}
      <section className="px-6 py-14 overflow-hidden">
        <div className="mx-auto max-w-5xl flex flex-col gap-24">

          {/* Clean Social Feed */}
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-bold text-foreground">{t("about_feature_feed_title")}</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about_feature_feed_body")}
              </p>
            </div>
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
              <img src="/ss/ss-feed.jpg" alt="Clean Social Feed" className="relative rounded-lg border border-border shadow-2xl w-full" />
            </div>
          </div>

          {/* Profiles & Hard Data */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-bold text-foreground">{t("about_feature_log_title")}</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about_feature_log_body")}
              </p>
            </div>
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-orange-400/10 blur-3xl rounded-full" />
              <img src="/ss/ss-profile.jpg" alt="Profiles & Hard Data" className="relative rounded-lg border border-border shadow-2xl w-full" />
            </div>
          </div>

          {/* Auto-tracking */}
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-bold text-foreground">{t("about_feature_agent_title")}</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about_feature_agent_body")}
              </p>
            </div>
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-blue-400/10 blur-3xl rounded-full" />
              <img src="/ss/ss-agent.jpg" alt="Auto-tracking (PC)" className="relative rounded-lg border border-border shadow-2xl w-full" />
            </div>
          </div>
          {/* Explore */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-bold text-foreground">{t("about_feature_explore_title")}</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about_feature_explore_body")}
              </p>
            </div>
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-purple-400/10 blur-3xl rounded-full" />
              <img src="/ss/ss-explore.jpg" alt="Explore" className="relative rounded-lg border border-border shadow-2xl w-full" />
            </div>
          </div>

          {/* Backlog */}
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-bold text-foreground">{t("about_feature_backlog_title")}</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about_feature_backlog_body")}
              </p>
            </div>
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-emerald-400/10 blur-3xl rounded-full" />
              <img src="/ss/ss-backlog.jpg" alt="Backlog" className="relative rounded-lg border border-border shadow-2xl w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Open */}
      <section className="border-y border-border bg-muted/50 px-6 py-14">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <Gamepad2 size={32} className="text-primary" />
          <h2 className="text-xl font-bold text-foreground">{t("about_open_title")}</h2>
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
          <h2 className="text-2xl font-bold text-foreground">{t("about_bottom_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("about_bottom_sub")}</p>
          <button
            onClick={() => signIn()}
            className="mt-2 rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("about_cta_primary")}
          </button>
        </section>
      )}

      {/* Footer placeholder removed */}
    </div>
  );
}

export default function About() {
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
            {t("about_signin")}
          </button>
        </header>
        <AboutContent authenticated={false} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-auto">
          <AboutContent authenticated={true} />
        </main>
        <Footer />
      </div>
    </div>
  );
}
