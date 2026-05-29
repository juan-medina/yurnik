// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { getFeedJourneys } from "@/services/feed";
import JourneyCard from "@/components/JourneyCard";

export default function Realm() {
  const { data: journeys = [] } = useQuery({ queryKey: ["feed"], queryFn: getFeedJourneys });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-3">
        {journeys.map((journey) => (
          <JourneyCard key={journey.id} journey={journey} queryKey={["feed"]} showPlayer />
        ))}
      </div>
    </div>
  );
}
