// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@/models/notification";
import { getNotifications } from "@/services/notifications";

async function fetchNotifications(): Promise<Notification[]> {
  const { notifications } = await getNotifications();
  return notifications;
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled,
    refetchInterval: (query) => (query.state.data ? 10 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
  });
}
