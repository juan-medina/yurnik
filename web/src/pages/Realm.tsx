// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { getFeedJourneys } from "@/services/feed";
import JourneyCard from "@/components/JourneyCard";

export default function Realm() {
  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: getFeedJourneys,
  });

  if (isLoading) return null;

  if (journeys.length === 0) {
    return (
      <div className="mx-auto max-w-2xl flex flex-col items-center justify-center py-24 gap-3 text-center">
        <p className="text-zinc-300 text-base">Your realm is quiet.</p>
        <p className="text-zinc-500 text-sm">Follow some players to see their journeys here.</p>
        <Link
          to="/players"
          className="mt-2 text-sm text-zinc-200 border border-zinc-700 rounded-lg px-4 py-2 hover:bg-zinc-800 transition-colors"
        >
          Discover players
        </Link>
      </div>
    );
  }

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
