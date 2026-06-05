// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCurrentPlayer, updateProfile } from "@/services/auth";
import { getUserJourneys } from "@/services/journeys";
import { getFollowers, getFollowing, getMyProfile } from "@/services/players";
import ProfileView from "@/components/ProfileView";
import AvatarEditor from "@/components/AvatarEditor";
import EditProfileModal from "@/components/EditProfileModal";

export default function Hero() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: currentPlayer } = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentPlayer });
  const { data: profile } = useQuery({
    queryKey: ["player-profile", "me"],
    queryFn: getMyProfile,
    enabled: !!currentPlayer,
  });
  const { data: journeys = [] } = useQuery({ queryKey: ["journeys", "user"], queryFn: getUserJourneys });
  const { data: followers = [] } = useQuery({
    queryKey: ["follow-list", currentPlayer?.id, "followers"],
    queryFn: () => getFollowers(currentPlayer!.id),
    enabled: !!currentPlayer,
  });
  const { data: following = [] } = useQuery({
    queryKey: ["follow-list", currentPlayer?.id, "following"],
    queryFn: () => getFollowing(currentPlayer!.id),
    enabled: !!currentPlayer,
  });

  const [editingProfile, setEditingProfile] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["player-profile", "me"] });
    },
  });

  if (!profile || !currentPlayer) return null;

  const avatarContent = (
    <AvatarEditor
      player={currentPlayer}
      size="lg"
      onChanged={() => {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        queryClient.invalidateQueries({ queryKey: ["player-profile", "me"] });
      }}
    />
  );

  const profileActions = (
    <button
      onClick={() => setEditingProfile(true)}
      aria-label="Edit profile"
      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Pencil size={15} />
    </button>
  );

  const bioContent = profile.player.bio ? (
    <p className="text-sm text-muted-foreground">{profile.player.bio}</p>
  ) : null;

  return (
    <>
      <ProfileView
        profile={profile}
        journeys={journeys}
        followers={followers}
        following={following}
        journeyQueryKey={["journeys", "user"]}
        sectionTitle={t("hero_section_journeys")}
        avatarContent={avatarContent}
        profileActions={profileActions}
        bioContent={bioContent}
      />

      {editingProfile && (
        <EditProfileModal
          player={currentPlayer}
          onSave={(patch) => updateProfileMutation.mutateAsync(patch)}
          onClose={() => setEditingProfile(false)}
        />
      )}
    </>
  );
}
