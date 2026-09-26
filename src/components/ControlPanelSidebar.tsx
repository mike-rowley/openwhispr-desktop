import React from "react";
import { Gift, Settings, HelpCircle, UserCircle, UserPlus } from "./icons";
import { useTranslation } from "react-i18next";
import { cn } from "./lib/utils";
import SupportDropdown from "./ui/SupportDropdown";
import type { UpsellDecision } from "../lib/upsell";
import { useControlPanelNavItems, type ControlPanelView } from "./controlPanelNav";

export type { ControlPanelView };

const rowIconClass =
  "shrink-0 text-foreground/70 group-hover:text-foreground/90 dark:text-foreground/65 dark:group-hover:text-foreground/85 transition-colors duration-150";
const rowLabelClass =
  "text-[13px] text-foreground/90 group-hover:text-foreground dark:text-foreground/85 dark:group-hover:text-foreground transition-colors duration-150";
const rowButtonClass =
  "group flex items-center gap-2.5 w-full h-8 px-2.5 rounded-md text-start outline-none hover:bg-foreground/4 dark:hover:bg-white/4 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors duration-150";

// This fork shows no upgrade/limit cards and no "Not signed in" row. The
// upsell props are still accepted so ControlPanel's wiring stays untouched.
interface ControlPanelSidebarProps {
  activeView: ControlPanelView;
  onViewChange: (view: ControlPanelView) => void;
  onOpenSettings: () => void;
  onOpenReferrals?: () => void;
  onInviteTeam?: () => void;
  onUpgrade?: () => void;
  isOverLimit?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  isSignedIn?: boolean;
  authLoaded?: boolean;
  upsell: UpsellDecision;
  updateAction?: React.ReactNode;
}

export default function ControlPanelSidebar({
  activeView,
  onViewChange,
  onOpenSettings,
  onOpenReferrals,
  onInviteTeam,
  userName,
  userEmail,
  userImage,
  isSignedIn,
  updateAction,
}: ControlPanelSidebarProps) {
  const { t } = useTranslation();

  const navItems = useControlPanelNavItems();

  return (
    <div className="w-48 h-full shrink-0 flex flex-col bg-surface-window">
      <div
        className="w-full h-10 shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <nav className="flex flex-col gap-0.5 px-2 pt-2 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "group relative flex items-center gap-2.5 w-full h-8 px-2.5 rounded-md outline-none transition-colors duration-150 text-start",
                "focus-visible:ring-1 focus-visible:ring-primary/30",
                isActive
                  ? "bg-primary/8 dark:bg-primary/10"
                  : "hover:bg-foreground/4 dark:hover:bg-white/4 active:bg-foreground/6"
              )}
            >
              <Icon
                size={16}
                className={cn(
                  "shrink-0 transition-colors duration-150",
                  isActive
                    ? "text-primary"
                    : "text-foreground/70 group-hover:text-foreground/90 dark:text-foreground/65 dark:group-hover:text-foreground/85"
                )}
              />
              <span
                className={cn(
                  "text-[13px] transition-colors duration-150",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-foreground/90 group-hover:text-foreground dark:text-foreground/85 dark:group-hover:text-foreground"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="px-2 pb-2 space-y-0.5">
        {updateAction && (
          <div className="px-1 pb-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {updateAction}
          </div>
        )}

        {onInviteTeam && (
          <button
            onClick={onInviteTeam}
            aria-label={t("sidebar.inviteTeam")}
            className={rowButtonClass}
          >
            <UserPlus size={16} className={rowIconClass} />
            <span className={rowLabelClass}>{t("sidebar.inviteTeam")}</span>
          </button>
        )}

        {isSignedIn && onOpenReferrals && (
          <button
            onClick={onOpenReferrals}
            aria-label={t("sidebar.referral")}
            className={rowButtonClass}
          >
            <Gift size={16} className={rowIconClass} />
            <span className={rowLabelClass}>{t("sidebar.referral")}</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          aria-label={t("sidebar.settings")}
          className={rowButtonClass}
        >
          <Settings size={16} className={rowIconClass} />
          <span className={rowLabelClass}>{t("sidebar.settings")}</span>
        </button>

        <SupportDropdown
          trigger={
            <button aria-label={t("sidebar.support")} className={rowButtonClass}>
              <HelpCircle size={16} className={rowIconClass} />
              <span className={rowLabelClass}>{t("sidebar.support")}</span>
            </button>
          }
        />

        {isSignedIn && (userName || userEmail) && (
          <>
            <div className="mx-1 h-px bg-border/10 dark:bg-white/6 my-1.5!" />

            <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md">
              {userImage ? (
                <img src={userImage} alt="" className="w-6 h-6 rounded-full shrink-0 object-cover" />
              ) : (
                <UserCircle
                  size={18}
                  className="shrink-0 text-foreground/50 dark:text-foreground/45"
                />
              )}
              <div className="flex-1 min-w-0">
                <p
                  dir="auto"
                  className="text-xs text-foreground/80 dark:text-foreground/80 truncate leading-tight"
                >
                  {userName || t("sidebar.defaultUser")}
                </p>
                {userEmail && (
                  <p className="text-xs text-foreground/55 dark:text-foreground/55 truncate leading-tight">
                    <bdi dir="ltr">{userEmail}</bdi>
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
