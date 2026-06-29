// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getCurrentPlayer, AccountSuspendedError } from "@/services/auth";
import { withContactLink } from "@/components/layout/LegalLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Footer from "./Footer";

export default function Shell() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
    refetchInterval: (query) => (query.state.data ? 6 * 60 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
  });

  if (error instanceof AccountSuspendedError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-lg font-semibold">{t("account_suspended_title")}</p>
        <p className="max-w-sm text-center text-sm text-muted-foreground">{withContactLink(t("account_suspended_body"))}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </div>
  );
}
