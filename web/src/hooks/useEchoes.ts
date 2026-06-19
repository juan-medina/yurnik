// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import type { Echo } from "@/models/echo";
import { getEchoes } from "@/services/echoes";

async function fetchEchoes(): Promise<Echo[]> {
  const { echoes } = await getEchoes();
  return echoes;
}

export function useEchoes(enabled: boolean) {
  return useQuery({
    queryKey: ["echoes"],
    queryFn: fetchEchoes,
    enabled,
    refetchInterval: (query) => (query.state.data ? 10 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
  });
}
