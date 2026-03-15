export const ROUTES = {
  studentExplore: "/organization/explore",
  studentDashboard: "/organization/dashboard",
  studentActivities: "/organization/activities",
  studentChat: "/organization/chat",
  studentSettings: "/organization/settings",
} as const;

export type NavItem = {
  key: string;
  label: string;
  href: string;
  iconSrc?: string;
  enabled?: boolean;
};

export const ORGANIZATION_SIDEBAR_ITEMS: NavItem[] = [
  { key: "map", label: "Map", href: ROUTES.studentExplore, iconSrc: "/images/icon bar/icon1.jpg", enabled: true },
  { key: "dashboard", label: "dashboard", href: ROUTES.studentDashboard, iconSrc: "/images/icon bar/icon2.jpg", enabled: true,},
  { key: "activities", label: "Activities", href: ROUTES.studentActivities, iconSrc: "/images/icon bar/icon3.jpg", enabled: true, },
  { key: "chat", label: "Chat", href: ROUTES.studentChat, iconSrc: "/images/icon bar/icon4.jpg", enabled: false },
  { key: "settings", label: "Settings", href: ROUTES.studentSettings, iconSrc: "/images/icon bar/icon6.jpg", enabled: false,},
];
