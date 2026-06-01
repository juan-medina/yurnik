// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { NavLink } from "react-router";
import { Bell, Globe2, ScrollText, Settings, Shield, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export const navItems: NavItem[] = [
  { to: "/", label: "Realm", icon: Globe2, end: true },
  { to: "/journeys", label: "Journeys", icon: ScrollText },
  { to: "/players", label: "Players", icon: Users },
  { to: "/echoes", label: "Echoes", icon: Bell },
  { to: "/hero", label: "Hero", icon: Shield },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 px-4 font-bold tracking-tight text-primary">
        <img src="/favicon-32x32.png" alt="" aria-hidden className="h-5 w-5" />
        yurnik
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
