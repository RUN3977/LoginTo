export const UI_TOKENS = {
  radius: {
    control: 6,
    card: 8
  },
  color: {
    ink: "#172033",
    muted: "#667085",
    surface: "#FFFFFF",
    surfaceAlt: "#F5F7FA",
    border: "#D0D5DD",
    action: "#2563EB",
    success: "#0F766E",
    warning: "#A16207",
    danger: "#B42318"
  },
  density: {
    listRowHeight: 56,
    toolbarHeight: 44,
    iconButtonSize: 36
  }
} as const;

export type UnlockState = "locked" | "unlocking" | "unlocked" | "error";

export type SyncBadgeState = "idle" | "pairing" | "syncing" | "conflict" | "error";
