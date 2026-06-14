// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { getPendingJourneysCount } from "@/services/journeys";

export function usePendingJourneysCount(enabled: boolean) {
  return useQuery({
    queryKey: ["pending-journeys-count"],
    queryFn: getPendingJourneysCount,
    enabled,
    refetchInterval: (query) => (query.state.data !== undefined ? 10 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
  });
}
