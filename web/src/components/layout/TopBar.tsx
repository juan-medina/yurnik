// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Bell, Moon, Sun, User } from "lucide-react";
import { NavLink } from "react-router";
import { useTheme } from "@/hooks/useTheme";

const MOCK_UNREAD = false;

export default function TopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border px-6">
      <NavLink
        to="/echoes"
        className={({ isActive }) =>
          `relative flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`
        }
        aria-label="Echoes"
      >
        <Bell size={16} />
        {MOCK_UNREAD && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </NavLink>
      <button
        onClick={toggleTheme}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <NavLink
        to="/hero"
        className={({ isActive }) =>
          `flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`
        }
        aria-label="Your hero"
      >
        <User size={16} />
      </NavLink>
    </header>
  );
}
