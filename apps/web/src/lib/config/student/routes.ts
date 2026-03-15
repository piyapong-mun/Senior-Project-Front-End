export const ROUTES = {
  studentExplore: "/student/explore",
  studentDashboard: "/student/dashboard",
  studentPortfolio: "/student/dashboard/portfolio",
  studentActivities: "/student/activities",
  studentChat: "/student/chat",
  studentQr: "/student/qr",
  studentSettings: "/student/settings",
} as const;

export type NavItem = {
  key: string;
  label: string;
  href: string;
  iconSrc?: string;
  enabled?: boolean;
};

export const STUDENT_SIDEBAR_ITEMS: NavItem[] = [
  { key: "map", label: "Map", href: ROUTES.studentExplore, iconSrc: "/images/icon bar/icon1.jpg", enabled: true },
  { key: "dashboard", label: "dashboard", href: ROUTES.studentDashboard, iconSrc: "/images/icon bar/icon2.jpg", enabled: true,},
  { key: "activities", label: "Activities", href: ROUTES.studentActivities, iconSrc: "/images/icon bar/icon3.jpg", enabled: true, },
  { key: "chat", label: "Chat", href: ROUTES.studentChat, iconSrc: "/images/icon bar/icon4.jpg", enabled: false },
  { key: "qr", label: "QR code", href: ROUTES.studentQr, iconSrc: "/images/icon bar/icon5.jpg", enabled: false },
  { key: "settings", label: "Settings", href: ROUTES.studentSettings, iconSrc: "/images/icon bar/icon6.jpg", enabled: false,},
];
