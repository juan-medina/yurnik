// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Flag, ShieldOff, RotateCcw } from "lucide-react";
import GenreChip from "@/components/GenreChip";
import ReportModal from "@/components/ReportModal";
import PlayerAvatar from "@/components/PlayerAvatar";
import { genreBarColor } from "@/lib/genres";
import FollowListModal from "@/components/FollowListModal";
import ActivityFeed from "@/components/ActivityFeed";
import type { FeedItem, Player, PlayerProfile, ReportTargetType } from "@/models";

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface ProfileViewProps {
  profile: PlayerProfile;
  items: FeedItem[];
  viewerId?: string;
  followers: Player[];
  following: Player[];
  sectionTitle: string;
  /** Back button or other nav rendered above the profile card */
  header?: ReactNode;
  /** Follow/unfollow button rendered at the trailing edge of the profile card */
  profileActions?: ReactNode;
  /** Avatar area: upload widget (Hero) or static image (PlayerProfile) */
  avatarContent?: ReactNode;
  /** Bio area: editable widget (Hero) or plain text (PlayerProfile) */
  bioContent?: ReactNode;
  /** Called when admin clicks the suspend button */
  onSuspend?: () => void;
  /** Called when admin clicks the reset profile button */
  onResetProfile?: () => void;
  /** Optional content rendered after the activity feed (e.g. a load-more button) */
  activityFooter?: ReactNode;
  hasMoreFollowers?: boolean;
  loadingMoreFollowers?: boolean;
  onLoadMoreFollowers?: () => void;
  hasMoreFollowing?: boolean;
  loadingMoreFollowing?: boolean;
  onLoadMoreFollowing?: () => void;
}

export default function ProfileView({
  profile,
  items,
  viewerId,
  followers,
  following,
  sectionTitle,
  header,
  profileActions,
  avatarContent,
  bioContent,
  onSuspend,
  onResetProfile,
  activityFooter,
  hasMoreFollowers,
  loadingMoreFollowers,
  onLoadMoreFollowers,
  hasMoreFollowing,
  loadingMoreFollowing,
  onLoadMoreFollowing,
}: ProfileViewProps) {
  const { t } = useTranslation();
  const [followList, setFollowList] = useState<{ title: string; kind: "followers" | "following" } | null>(null);
  const [reporting, setReporting] = useState<ReportTargetType | null>(null);

  const { player, journeyCount, totalSeconds, recentGames, genreHours, horizon } = profile;
  const isOwnProfile = player.id === viewerId;
  const canReport = !!viewerId && !isOwnProfile;
  const maxGenreSeconds = genreHours[0]?.seconds ?? 1;

  return (
    <div className="mx-auto max-w-2xl">
      {header && <div className="mb-4 flex items-center gap-3">{header}</div>}

      {/* Profile card */}
      <div className="mb-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {avatarContent ?? (
            <PlayerAvatar player={player} className="h-16 w-16 shrink-0 text-xl" />
          )}

          {/* Name, handle, bio */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <p className="text-xl font-bold leading-tight">{player.name}</p>
              {player.isAdmin && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground">
                  {t("admin_badge")}
                </span>
              )}
            </div>
            <p className="mb-3 text-sm text-muted-foreground">@{player.handle}</p>
            {bioContent}
          </div>

          {/* Actions: follow button + icon row stacked */}
          <div className="flex shrink-0 flex-col items-end gap-2">
            {profileActions}
            {(canReport || onSuspend || onResetProfile) && (
              <div className="flex items-center gap-1">
                {onResetProfile && (
                  <button
                    onClick={onResetProfile}
                    title={t("admin_reset_profile_tooltip")}
                    aria-label={t("admin_reset_profile_tooltip")}
                    className="text-muted-foreground/40 transition-colors hover:text-destructive"
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
                {onSuspend && (
                  <button
                    onClick={onSuspend}
                    title={t("admin_suspend_tooltip")}
                    aria-label={t("admin_suspend_tooltip")}
                    className="text-muted-foreground/40 transition-colors hover:text-destructive"
                  >
                    <ShieldOff size={15} />
                  </button>
                )}
                {canReport && (
                  <button
                    onClick={() => setReporting("profile")}
                    title={t("report_profile_tooltip")}
                    aria-label={t("report_profile_tooltip")}
                    className="text-muted-foreground/40 transition-colors hover:text-destructive"
                  >
                    <Flag size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 divide-x divide-y divide-border rounded-lg border border-border bg-card sm:grid-cols-4 sm:divide-y-0">
        {[
          { labelKey: "profile_stat_journeys", value: journeyCount, onClick: undefined },
          { labelKey: "profile_stat_hours", value: formatSeconds(totalSeconds), onClick: undefined },
          {
            labelKey: "profile_stat_followers",
            value: player.followers ?? followers.length,
            onClick: () => setFollowList({ title: t("profile_followers_modal"), kind: "followers" }),
          },
          {
            labelKey: "profile_stat_following",
            value: player.following ?? following.length,
            onClick: () => setFollowList({ title: t("profile_following_modal"), kind: "following" }),
          },
        ].map(({ labelKey, value, onClick }) =>
          onClick ? (
            <button
              key={labelKey}
              onClick={onClick}
              className="flex flex-col items-center py-4 transition-colors hover:bg-accent/50"
            >
              <span className="text-lg font-bold">{value}</span>
              <span className="text-xs text-muted-foreground">{t(labelKey)}</span>
            </button>
          ) : (
            <div key={labelKey} className="flex flex-col items-center py-4">
              <span className="text-lg font-bold">{value}</span>
              <span className="text-xs text-muted-foreground">{t(labelKey)}</span>
            </div>
          ),
        )}
      </div>

      {/* Recent games */}
      {recentGames.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("profile_recent_games")}
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {recentGames.map((g) => (
              <Link key={g.igdbId} to={`/game/${g.igdbId}`} className="group block">
                {g.coverUrl ? (
                  <img
                    src={g.coverUrl}
                    alt={g.name}
                    className="mb-2 aspect-[3/4] w-full rounded-md object-cover transition-opacity group-hover:opacity-80"
                  />
                ) : (
                  <div className="mb-2 flex aspect-[3/4] w-full items-center justify-center rounded-md bg-muted transition-opacity group-hover:opacity-80">
                    <span className="px-1 text-center text-xs text-muted-foreground">{g.name}</span>
                  </div>
                )}
                <p className="truncate text-xs font-medium group-hover:underline" title={g.name}>
                  {g.name}
                </p>
                {g.releaseYear && (
                  <p className="text-xs text-muted-foreground">{g.releaseYear}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Genre hours bars */}
      {genreHours.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("profile_genres")}
          </h2>
          <div className="flex flex-col gap-2">
            {genreHours.map((g) => (
              <div key={g.genre} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <GenreChip genre={g.genre} size="sm" />
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(g.seconds / maxGenreSeconds) * 100}%`,
                      backgroundColor: genreBarColor(g.genre),
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                  {formatSeconds(g.seconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Horizon */}
      {(horizon.length > 0 || isOwnProfile) && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("profile_horizon")}
          </h2>
          {horizon.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {horizon.map((g) => (
                <Link key={g.igdbId} to={`/game/${g.igdbId}`} className="group block">
                  {g.coverUrl ? (
                    <img
                      src={g.coverUrl}
                      alt={g.name}
                      className="mb-2 aspect-[3/4] w-full rounded-md object-cover transition-opacity group-hover:opacity-80"
                    />
                  ) : (
                    <div className="mb-2 flex aspect-[3/4] w-full items-center justify-center rounded-md bg-muted transition-opacity group-hover:opacity-80">
                      <span className="px-1 text-center text-xs text-muted-foreground">{g.name}</span>
                    </div>
                  )}
                  <p className="truncate text-xs font-medium group-hover:underline" title={g.name}>
                    {g.name}
                  </p>
                  {g.releaseYear && (
                    <p className="text-xs text-muted-foreground">{g.releaseYear}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              {t("profile_horizon_empty_you")}{" "}
              <Link to="/horizon" className="text-primary underline-offset-2 hover:underline">
                {t("nav_horizon")}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Activity */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {sectionTitle}
      </h2>

      <ActivityFeed
        items={items}
        viewerId={viewerId}
        emptyState={
          <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
            {t("profile_no_activity")}
          </div>
        }
      />
      {activityFooter}

      <div className="h-8" />

      {followList && (
        <FollowListModal
          title={followList.title}
          players={followList.kind === "followers" ? followers : following}
          onClose={() => setFollowList(null)}
          hasMore={followList.kind === "followers" ? (hasMoreFollowers ?? false) : (hasMoreFollowing ?? false)}
          loadingMore={followList.kind === "followers" ? (loadingMoreFollowers ?? false) : (loadingMoreFollowing ?? false)}
          onLoadMore={followList.kind === "followers" ? onLoadMoreFollowers : onLoadMoreFollowing}
        />
      )}

      {reporting && (
        <ReportModal
          targetType={reporting}
          targetId={player.id}
          onClose={() => setReporting(null)}
        />
      )}
    </div>
  );
}
