// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, Pencil, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getPlayerProfile,
  getPlayerJourneys,
  getFollowers,
  getFollowing,
  followPlayer,
  unfollowPlayer,
} from "@/services/players";
import { getCurrentPlayer, updateProfile } from "@/services/auth";
import ProfileView from "@/components/ProfileView";
import AvatarEditor from "@/components/AvatarEditor";
import EditProfileModal from "@/components/EditProfileModal";

export default function PlayerProfile() {
  const { t } = useTranslation();
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentPlayer, isLoading: currentPlayerLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
  });

  const { data: profile } = useQuery({
    queryKey: ["player-profile", handle],
    queryFn: () => getPlayerProfile(handle!),
    enabled: !!handle,
  });

  const { data: journeys = [] } = useQuery({
    queryKey: ["journeys", "player", handle],
    queryFn: () => getPlayerJourneys(handle!),
    enabled: !!handle,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ["follow-list", profile?.player.id, "followers"],
    queryFn: () => getFollowers(profile!.player.handle),
    enabled: !!profile,
  });

  const { data: following = [] } = useQuery({
    queryKey: ["follow-list", profile?.player.id, "following"],
    queryFn: () => getFollowing(profile!.player.handle),
    enabled: !!profile,
  });

  const isFollowing = profile?.player.isFollowing ?? false;

  const followMutation = useMutation({
    mutationFn: (follow: boolean) =>
      follow ? followPlayer(profile!.player.handle) : unfollowPlayer(profile!.player.handle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-profile", handle] });
      queryClient.invalidateQueries({ queryKey: ["follow-list", profile?.player.id] });
    },
  });

  const [editingProfile, setEditingProfile] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["player-profile", handle] });
    },
  });

  if (currentPlayerLoading) return null;

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl pt-8 text-center text-muted-foreground">
        {t("profile_not_found")}
      </div>
    );
  }

  const isOwnProfile = currentPlayer?.id === profile.player.id;

  const avatarContent = isOwnProfile && currentPlayer ? (
    <AvatarEditor
      player={currentPlayer}
      size="lg"
      onChanged={() => {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        queryClient.invalidateQueries({ queryKey: ["player-profile", handle] });
      }}
    />
  ) : undefined;

  const profileActions = isOwnProfile ? (
    <button
      onClick={() => setEditingProfile(true)}
      aria-label="Edit profile"
      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Pencil size={15} />
    </button>
  ) : (
    <button
      onClick={() => followMutation.mutate(!isFollowing)}
      aria-label={isFollowing ? t("profile_unfollow") : t("profile_follow")}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        isFollowing
          ? "border-border bg-muted text-muted-foreground"
          : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
      }`}
    >
      {isFollowing ? (
        <>
          <Check size={14} />
          {t("profile_unfollow")}
        </>
      ) : (
        <>
          <UserPlus size={14} />
          {t("profile_follow")}
        </>
      )}
    </button>
  );

  return (
    <>
      <ProfileView
        profile={profile}
        journeys={journeys}
        followers={followers}
        following={following}
        journeyQueryKey={["journeys", "player", handle]}
        sectionTitle={isOwnProfile ? t("hero_section_journeys") : `${profile.player.name}'s journeys`}
        header={
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t("profile_back")}
          >
            <ChevronLeft size={20} />
          </button>
        }
        avatarContent={avatarContent}
        profileActions={profileActions}
        bioContent={
          profile.player.bio ? (
            <p className="text-sm text-muted-foreground">{profile.player.bio}</p>
          ) : undefined
        }
      />

      {editingProfile && currentPlayer && (
        <EditProfileModal
          player={currentPlayer}
          onSave={(patch) => updateProfileMutation.mutateAsync(patch)}
          onClose={() => setEditingProfile(false)}
        />
      )}
    </>
  );
}
