// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Bell, Menu, Moon, Sun } from "lucide-react";
import { NavLink } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { avatarSrc, initials } from "@/lib/display";
import { getCurrentPlayer } from "@/services/auth";
import { getEchoes } from "@/services/echoes";

type TopBarProps = { onMenuClick?: () => void };

export default function TopBar({ onMenuClick = () => {} }: TopBarProps) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { data: echoes = [] } = useQuery({ queryKey: ["echoes"], queryFn: getEchoes });
  const { data: player } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
    refetchInterval: (query) => (query.state.data ? 6 * 60 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
  });
  const hasUnread = echoes.some((e) => !e.read);

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border px-6">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
        aria-label={t("topbar_menu")}
      >
        <Menu size={18} />
      </button>
      <div className="ml-auto flex items-center gap-3">
        <NavLink
          to="/echoes"
          className={({ isActive }) =>
            `relative flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`
          }
          aria-label={t("topbar_echoes_label")}
        >
          <Bell size={16} />
          {hasUnread && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </NavLink>
        <button
          onClick={toggleTheme}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label={theme === "dark" ? t("topbar_switch_light") : t("topbar_switch_dark")}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <NavLink
          to={player ? `/player/${player.handle}` : "#"}
          aria-label={t("nav_hero")}
          className={({ isActive }) =>
            `block rounded-full transition-opacity ${isActive ? "opacity-100" : "opacity-70 hover:opacity-100"}`
          }
        >
          {player ? (
            <div className="relative h-8 w-8">
              <img
                key={avatarSrc(player)}
                src={avatarSrc(player)}
                alt={player.name}
                className="h-full w-full rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.removeAttribute("hidden");
                }}
              />
              <div
                hidden
                className="absolute inset-0 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: player.color }}
              >
                {initials(player.name)}
              </div>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted" />
          )}
        </NavLink>
      </div>
    </header>
  );
}
