// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { NavLink } from "react-router";
import { Bell, Globe2, ScrollText, Settings, Shield, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer } from "@/services/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
};

type SidebarProps = { isOpen?: boolean; onClose?: () => void };

export default function Sidebar({ isOpen = false, onClose = () => {} }: SidebarProps) {
  const { t } = useTranslation();
  const { data: currentPlayer } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });

  const navItems: NavItem[] = [
    { to: "/", labelKey: "nav_realm", icon: Globe2, end: true },
    { to: "/journeys", labelKey: "nav_journeys", icon: ScrollText },
    { to: "/players", labelKey: "nav_players", icon: Users },
    { to: "/echoes", labelKey: "nav_echoes", icon: Bell },
    { to: currentPlayer ? `/player/${currentPlayer.handle}` : "/hero", labelKey: "nav_hero", icon: Shield },
    { to: "/settings", labelKey: "nav_settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-sidebar transition-transform",
          "md:static md:z-auto md:w-48 md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <NavLink
          to="/lore"
          onClick={onClose}
          className="flex h-14 items-center gap-2 px-4 font-bold tracking-tight text-primary"
        >
          <img src="/favicon-32x32.png" alt="" aria-hidden className="h-5 w-5" />
          yurnik
        </NavLink>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={labelKey}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon size={18} aria-hidden />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
