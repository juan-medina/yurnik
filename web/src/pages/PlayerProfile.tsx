// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { Navigate, useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlayer, getPlayerJourneys, getFollowers, getFollowing, followPlayer, unfollowPlayer } from "@/services/players";
import { getCurrentPlayer } from "@/services/auth";
import ProfileView from "@/components/ProfileView";

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentPlayer, isLoading: currentPlayerLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
  });

  const { data: player } = useQuery({
    queryKey: ["player", id],
    queryFn: () => getPlayer(id!),
    enabled: !!id,
  });

  const { data: journeys = [] } = useQuery({
    queryKey: ["journeys", "player", id],
    queryFn: () => getPlayerJourneys(id!),
    enabled: !!id,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ["follow-list", player?.id, "followers"],
    queryFn: () => getFollowers(player!.id),
    enabled: !!player,
  });

  const { data: following = [] } = useQuery({
    queryKey: ["follow-list", player?.id, "following"],
    queryFn: () => getFollowing(player!.id),
    enabled: !!player,
  });

  const isFollowing = player?.isFollowing ?? false;

  const followMutation = useMutation({
    mutationFn: (follow: boolean) => follow ? followPlayer(player!.id) : unfollowPlayer(player!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player", id] });
      queryClient.invalidateQueries({ queryKey: ["follow-list", player?.id] });
    },
  });

  if (currentPlayerLoading) return null;
  if (currentPlayer && id === currentPlayer.id) return <Navigate to="/hero" replace />;

  if (!player) {
    return (
      <div className="mx-auto max-w-2xl pt-8 text-center text-muted-foreground">
        Player not found.
      </div>
    );
  }

  const isOwnProfile = currentPlayer?.id === player.id;

  return (
    <ProfileView
      player={player}
      journeys={journeys}
      followers={followers}
      following={following}
      journeyQueryKey={["journeys", "player", id]}
      sectionTitle={`${player.name}'s journeys`}
      header={
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
      }
      profileActions={
        !isOwnProfile ? (
          <button
            onClick={() => followMutation.mutate(!isFollowing)}
            aria-label={isFollowing ? "Unfollow" : "Follow"}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              isFollowing
                ? "border-border bg-muted text-muted-foreground"
                : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            {isFollowing ? (
              <>
                <Check size={14} />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus size={14} />
                Follow
              </>
            )}
          </button>
        ) : undefined
      }
      bioContent={
        player.bio ? (
          <p className="text-sm text-muted-foreground">{player.bio}</p>
        ) : undefined
      }
    />
  );
}
