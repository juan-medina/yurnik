// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, Pencil, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getPlayerProfile,
  getFollowers,
  getFollowing,
  followPlayer,
  unfollowPlayer,
} from "@/services/players";
import { getPlayerActivity } from "@/services/feed";
import type { FeedItem } from "@/models/feed";
import type { Player } from "@/models/player";
import { getCurrentPlayer, updateProfile } from "@/services/auth";
import ProfileView from "@/components/ProfileView";
import AvatarEditor from "@/components/AvatarEditor";
import EditProfileModal from "@/components/EditProfileModal";
import SignInPromptModal from "@/components/SignInPromptModal";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function PlayerProfile() {
  const { t } = useTranslation();
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentPlayer } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentPlayer,
    retry: false,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["player-profile", handle],
    queryFn: () => getPlayerProfile(handle!),
    enabled: !!handle,
  });

  const [allActivity, setAllActivity] = useState<FeedItem[]>([]);
  const [nextActivityCursor, setNextActivityCursor] = useState<string | undefined>();
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);

  useQuery({
    queryKey: ["activity", "player", handle],
    queryFn: async () => {
      const page = await getPlayerActivity(handle!);
      setAllActivity(page.items);
      setNextActivityCursor(page.nextCursor);
      return page;
    },
    enabled: !!handle,
  });

  async function loadMoreActivity() {
    if (!nextActivityCursor || loadingMoreActivity) return;
    setLoadingMoreActivity(true);
    try {
      const page = await getPlayerActivity(handle!, nextActivityCursor);
      setAllActivity((prev) => [...prev, ...page.items]);
      setNextActivityCursor(page.nextCursor);
    } finally {
      setLoadingMoreActivity(false);
    }
  }

  const activity = allActivity;

  const [allFollowers, setAllFollowers] = useState<Player[]>([]);
  const [nextFollowersCursor, setNextFollowersCursor] = useState<string | undefined>();
  const [loadingMoreFollowers, setLoadingMoreFollowers] = useState(false);

  useQuery({
    queryKey: ["follow-list", profile?.player.id, "followers"],
    queryFn: async () => {
      const page = await getFollowers(profile!.player.handle);
      setAllFollowers(page.players);
      setNextFollowersCursor(page.nextCursor);
      return page;
    },
    enabled: !!profile,
  });

  async function loadMoreFollowers() {
    if (!nextFollowersCursor || loadingMoreFollowers) return;
    setLoadingMoreFollowers(true);
    try {
      const page = await getFollowers(profile!.player.handle, nextFollowersCursor);
      setAllFollowers((prev) => [...prev, ...page.players]);
      setNextFollowersCursor(page.nextCursor);
    } finally {
      setLoadingMoreFollowers(false);
    }
  }

  const [allFollowing, setAllFollowing] = useState<Player[]>([]);
  const [nextFollowingCursor, setNextFollowingCursor] = useState<string | undefined>();
  const [loadingMoreFollowing, setLoadingMoreFollowing] = useState(false);

  useQuery({
    queryKey: ["follow-list", profile?.player.id, "following"],
    queryFn: async () => {
      const page = await getFollowing(profile!.player.handle);
      setAllFollowing(page.players);
      setNextFollowingCursor(page.nextCursor);
      return page;
    },
    enabled: !!profile,
  });

  async function loadMoreFollowing() {
    if (!nextFollowingCursor || loadingMoreFollowing) return;
    setLoadingMoreFollowing(true);
    try {
      const page = await getFollowing(profile!.player.handle, nextFollowingCursor);
      setAllFollowing((prev) => [...prev, ...page.players]);
      setNextFollowingCursor(page.nextCursor);
    } finally {
      setLoadingMoreFollowing(false);
    }
  }

  const followers = allFollowers;
  const following = allFollowing;

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
  const [showSignIn, setShowSignIn] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["player-profile", handle] });
    },
  });

  usePageTitle(profile?.player.name);

  if (profileLoading) return null;

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl pt-8 text-center text-muted-foreground">
        {t("profile_not_found")}
      </div>
    );
  }

  const isOwnProfile = currentPlayer?.id === profile.player.id;
  const canSuspend = !!currentPlayer?.isAdmin && !isOwnProfile;

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
      onClick={() => { if (!currentPlayer) { setShowSignIn(true); return; } followMutation.mutate(!isFollowing); }}
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
        items={activity}
        viewerId={currentPlayer?.id}
        followers={followers}
        following={following}
        hasMoreFollowers={!!nextFollowersCursor}
        loadingMoreFollowers={loadingMoreFollowers}
        onLoadMoreFollowers={loadMoreFollowers}
        hasMoreFollowing={!!nextFollowingCursor}
        loadingMoreFollowing={loadingMoreFollowing}
        onLoadMoreFollowing={loadMoreFollowing}
        sectionTitle={
          isOwnProfile
            ? t("profile_section_activity_you")
            : t("profile_section_activity", { name: profile.player.name })
        }
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
        onSuspend={
          canSuspend
            ? () =>
                navigate(
                  `/admin?confirm_suspend=${profile.player.id}&suspend_name=${encodeURIComponent(profile.player.name)}`
                )
            : undefined
        }
        onResetProfile={
          canSuspend
            ? () =>
                navigate(
                  `/admin?confirm_reset=${profile.player.id}&reset_name=${encodeURIComponent(profile.player.name)}`
                )
            : undefined
        }
        bioContent={
          profile.player.bio ? (
            <p className="break-words whitespace-pre-wrap text-sm text-muted-foreground">{profile.player.bio}</p>
          ) : undefined
        }
        activityFooter={
          nextActivityCursor ? (
            <div className="border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={loadMoreActivity}
                disabled={loadingMoreActivity}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {loadingMoreActivity ? t("loading") : t("load_more")}
              </button>
            </div>
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
      {showSignIn && <SignInPromptModal onClose={() => setShowSignIn(false)} />}
    </>
  );
}
