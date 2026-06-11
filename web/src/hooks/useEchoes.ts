// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { getEchoes } from "@/services/echoes";

export function useEchoes(enabled: boolean) {
  return useQuery({
    queryKey: ["echoes"],
    queryFn: getEchoes,
    enabled,
    refetchInterval: (query) => (query.state.data ? 10 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
  });
}
