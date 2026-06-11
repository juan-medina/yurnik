// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";

const STORAGE_KEY = "desktopNotifications";

export function useDesktopNotifications() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [enabled, setEnabledState] = useState(
    () => supported && localStorage.getItem(STORAGE_KEY) === "true" && Notification.permission === "granted",
  );

  async function setEnabled(value: boolean) {
    if (!supported) return;
    if (!value) {
      localStorage.removeItem(STORAGE_KEY);
      setEnabledState(false);
      return;
    }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return;
    localStorage.setItem(STORAGE_KEY, "true");
    setEnabledState(true);
  }

  return {
    enabled,
    setEnabled,
    supported,
    denied: supported && Notification.permission === "denied",
  };
}
