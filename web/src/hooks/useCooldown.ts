// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";

/**
 * Tracks a countdown in seconds, e.g. for a Retry-After cooldown. Call
 * `start(seconds)` to begin counting down; `remaining` ticks down to 0 once
 * per second.
 */
export function useCooldown(): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  function start(seconds: number) {
    clearInterval(intervalRef.current);
    setRemaining(seconds);
    if (seconds <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return { remaining, start };
}
