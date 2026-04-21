"use client";

import styles from "./ClientDashboard.module.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar3D from "@/components/shared/Avatar3D";

import StudentCalendar, {
  type StudentCalendarSiteEvent,
  type StudentCalendarTrackColor,
} from "@/components/shared/student/StudentCalendar";

/* =======================
   Types
======================= */
type Skill = { id: string; name: string; percent: number };

type ActivityStatusKey =
  | "completed"
  | "inProgress"
  | "registered"
  | "incomplete";

type StudentMe = {
  name: string;
  bio: string;
  phone: string;
  email: string;
  address: string;
  education: string;
  level: number;
  xp: number;
  xpMax: number;
  firstName: string;
  lastName: string;
  birthDate: string;
  university: string;
  faculty: string;
  major: string;
  year: string;
  interests: string[];
  skill: string[];
  profileImageUrl: string | null;
  avatarModelUrl: string | null;
  avatarChoiceId: string | null;
};

type AvatarOption = {
  id: string;
  modelUrl: string;
  name: string;
  unlockLevel?: number;
};

type ActivityItem = {
  id: string;
  title: string;
  sub: string;
  xp: number;
  hours: number;
  status: string;
  detailPath: string;
};

type MissionItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
};

type ScheduleItem = StudentCalendarSiteEvent & {
  sub: string;
};

type CompletionSegment = {
  key: ActivityStatusKey;
  title: string;
  count: number;
  color: string;
  colorClass: string;
  items: string[];
};

type DashboardApiResponse = {
  ok: boolean;
  data?: {
    student_info?: {
      user_id?: string;
      std_id?: string;
      first_name?: string;
      last_name?: string;
      birth_date?: string;
      phone?: string;
      email?: string;
      address?: string;
      about_me?: string;
      university?: string;
      faculty?: string;
      major?: string;
      year?: number | string;
      interests?: string[];
      skill?: string[];
      level?: number;
      total_exp?: number;
      xp_max?: number;
      avatar_choice?: string | null;
      profile_image_url?: string | null;
      avatar_model_url?: string | null;
      avatar_image_url?: string | null;
      is_profile_complete?: boolean;
      profile?: {
        bio?: string;
        email?: string;
        headline?: string;
      } | null;
      achievement?: Record<string, any> | null;
      portfolio?: Record<string, any> | null;
    };
    activities_status?: {
      completed_number?: number;
      failed_number?: number;
      registered_number?: number;
      waiting_feedback_number?: number;
    };
    done_activities?: Array<{
      activity_id?: string;
      activity_name?: string;
      activity_type?: string;
      status?: string;
      xp?: number;
    }>;
    schedules?: Array<{
      activity_id?: string;
      activity_name?: string;
      activity_type?: string;
      start_at?: string;
      end_at?: string;
    }>;
    today_missions?: Array<{
      activity_id?: string;
      activity_name?: string;
      run_start_at?: string;
      run_end_at?: string;
    }>;
  };
  message?: string;
};

type ActivityStatsResponse = {
  ok: boolean;
  data?: {
    all_activities?: Array<{
      ActivityID?: string;
      Activity_id?: string;
      activity_id?: string;
      ActivityName?: string;
      Activity_name?: string;
      activity_name?: string;
      ActivityType?: string;
      Activity_type?: string;
      activity_type?: string;
      submission_status?: string;
      SubmissionStatus?: string;
      status?: string;
      Status?: string;
      Hours?: number | string;
      hours?: number | string;
    }>;
  };
  message?: string;
};

type ModalKind = "editProfile" | "badges" | "certificate" | null;
type TileId = "badges" | "certificate" | "portfolio";

/* =======================
   Static UI Data
======================= */
const LEVEL_BADGES = [
  "/images/icons/badge01.png",
  "/images/icons/badge02.png",
  "/images/icons/badge03.png",
  "/images/icons/badge04.png",
  "/images/icons/badge05.png",
];

const BADGE_TILES: Array<{ id: TileId; label: string; image: string; alt: string }> = [
  { id: "badges", label: "badges", image: "/images/icons/porttfolio-icon.png", alt: "Badges" },
  { id: "certificate", label: "certificate", image: "/images/icons/porttfolio-icon.png", alt: "Certificate" },
  { id: "portfolio", label: "portfolio", image: "/images/icons/porttfolio-icon.png", alt: "Portfolio" },
];

/* =======================
   Helpers
======================= */
function cx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

function toSkillPercent(name: string, index: number) {
  const preset: Record<string, number> = {
    HTML: 85,
    CSS: 70,
    JavaScript: 55,
    React: 42,
    TypeScript: 35,
    "UI/UX": 60,
    Git: 50,
    API: 40,
    Testing: 25,
    SQL: 45,
    Cloud: 20,
    "Soft Skills": 65,
  };

  return preset[name] ?? Math.max(20, 80 - index * 5);
}

function safeDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
}

function shortDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function getActivityDetailPath(activityType?: string) {
  const type = String(activityType ?? "").toLowerCase();

  if (type === "challenge") return "/student/activities/challenge-progress";
  if (type === "course") return "/student/activities/course-progress";
  if (type === "meeting") return "/student/activities/meeting-progress";

  return "/student/activities";
}

function getActivityIdForStats(activity: any, index: number) {
  return String(
    activity?.ActivityID ||
    activity?.Activity_id ||
    activity?.activity_id ||
    activity?.activityId ||
    `activity-${index}`
  );
}

function getActivityTypeForStats(activity: any) {
  return String(
    activity?.ActivityType ||
    activity?.Activity_type ||
    activity?.activity_type ||
    "activity"
  ).toLowerCase();
}

function getActivityStatusForStats(activity: any) {
  return String(
    activity?.submission_status ||
    activity?.SubmissionStatus ||
    activity?.status ||
    activity?.Status ||
    ""
  ).toLowerCase();
}

function getStatusRank(status: string) {
  if (status === "completed" || status === "complete") return 5;
  if (status === "submitted") return 4;
  if (status === "in progress" || status === "in_progress") return 3;
  if (status === "failed" || status === "fail" || status === "incomplete") {
    return 2;
  }
  return 1;
}

function normalizeOverviewStatus(raw: any) {
  const s = String(raw ?? "").toLowerCase();

  if (s === "completed" || s === "complete") return "Completed";
  if (s === "submitted") return "Submitted";
  if (s === "failed" || s === "fail" || s === "incomplete") return "Incomplete";
  return "In progress";
}

function dedupeActivitiesFromStats(statsData?: ActivityStatsResponse["data"]) {
  const rawList: any[] = Array.isArray(statsData?.all_activities)
    ? statsData!.all_activities!
    : [];

  const uniqueMap = new Map<string, any>();

  rawList.forEach((activity: any, index: number) => {
    const id = getActivityIdForStats(activity, index);
    const currentStatus = getActivityStatusForStats(activity);

    if (!uniqueMap.has(id)) {
      uniqueMap.set(id, activity);
      return;
    }

    const existing = uniqueMap.get(id);
    const existingStatus = getActivityStatusForStats(existing);

    if (getStatusRank(currentStatus) >= getStatusRank(existingStatus)) {
      uniqueMap.set(id, activity);
    }
  });

  return Array.from(uniqueMap.values());
}

function mapOverviewActivities(statsData?: ActivityStatsResponse["data"]): ActivityItem[] {
  return dedupeActivitiesFromStats(statsData).map((item, index) => {
    const type = getActivityTypeForStats(item);

    return {
      id: getActivityIdForStats(item, index),
      title: String(
        item?.ActivityName ||
        item?.Activity_name ||
        item?.activity_name ||
        "Activity"
      ),
      sub: type,
      xp: 0,
      hours: Number(item?.Hours ?? item?.hours ?? 0),
      status: normalizeOverviewStatus(getActivityStatusForStats(item)),
      detailPath: getActivityDetailPath(type),
    };
  });
}

function buildCompletionSegmentsFromStats(
  statsData: ActivityStatsResponse["data"] | undefined,
  schedules: ScheduleItem[]
): CompletionSegment[] {
  const deduped = dedupeActivitiesFromStats(statsData);

  const completedItems = deduped
    .filter((item) => {
      const s = getActivityStatusForStats(item);
      return s === "completed" || s === "complete";
    })
    .map(
      (item) =>
        String(
          item?.ActivityName ||
          item?.Activity_name ||
          item?.activity_name ||
          "Activity"
        )
    );

  const incompleteItems = deduped
    .filter((item) => {
      const s = getActivityStatusForStats(item);
      return s === "failed" || s === "fail" || s === "incomplete";
    })
    .map(
      (item) =>
        String(
          item?.ActivityName ||
          item?.Activity_name ||
          item?.activity_name ||
          "Activity"
        )
    );

  const inProgressItems = deduped
    .filter((item) => {
      const s = getActivityStatusForStats(item);
      return s === "submitted" || s === "in progress" || s === "in_progress" || s === "";
    })
    .map(
      (item) =>
        String(
          item?.ActivityName ||
          item?.Activity_name ||
          item?.activity_name ||
          "Activity"
        )
    );

  return [
    {
      key: "completed",
      title: "Completed",
      count: completedItems.length,
      color: "#9FD5A8",
      colorClass: styles.badgeFillGreen,
      items: completedItems,
    },
    {
      key: "incomplete",
      title: "Incomplete",
      count: incompleteItems.length,
      color: "#E58F82",
      colorClass: styles.badgeFillRed,
      items: incompleteItems,
    },
    {
      key: "registered",
      title: "Registered",
      count: schedules.length,
      color: "#7EC6D9",
      colorClass: styles.badgeFillBlue,
      items: schedules.map((x) => x.title),
    },
    {
      key: "inProgress",
      title: "In Progress",
      count: inProgressItems.length,
      color: "#F1C97B",
      colorClass: styles.badgeFillYellowSoft,
      items: inProgressItems,
    },
  ];
}

const PUBLIC_ASSET_BASE =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
  "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com";

function toPublicAssetUrl(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `${PUBLIC_ASSET_BASE.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`;
}

function normalizeAvatarOption(item: any, index: number): AvatarOption | null {
  const id = String(item?.id ?? item?.avatar_id ?? item?.avatar_choice ?? "").trim();
  const modelUrl = toPublicAssetUrl(
    item?.modelUrl ?? item?.model_url ?? item?.avatar_model ?? item?.glb_url ?? null
  );

  if (!id || !modelUrl) return null;

  return {
    id,
    modelUrl,
    name: String(item?.name ?? item?.avatar_name ?? `Avatar ${index + 1}`).trim() || `Avatar ${index + 1}`,
    unlockLevel:
      item?.unlockLevel !== undefined && item?.unlockLevel !== null
        ? Number(item.unlockLevel)
        : item?.unlock_level !== undefined && item?.unlock_level !== null
          ? Number(item.unlock_level)
          : undefined,
  };
}

function normalizeAvatarOptions(json: any): AvatarOption[] {
  const raw: any[] = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.avatars)
        ? json.avatars
        : [];

  return raw
    .map((item: any, index: number) => normalizeAvatarOption(item, index))
    .filter(Boolean) as AvatarOption[];
}

function limitAvatarOptions(options: AvatarOption[], selectedId: string | null, limit = 3) {
  if (options.length <= limit) return options;

  const top = options.slice(0, limit);
  if (!selectedId || top.some((option) => option.id === selectedId)) return top;

  const selected = options.find((option) => option.id === selectedId);
  if (!selected) return top;

  return [...top.slice(0, limit - 1), selected];
}

function mapStudentToDashboard(api: DashboardApiResponse["data"], statsData?: any) {
  const student = api?.student_info ?? {};
  const firstName = student.first_name?.trim() || "";
  const lastName = student.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim() || "Student";

  const university = student.university?.trim() || "";
  const faculty = student.faculty?.trim() || "";
  const major = student.major?.trim() || "";
  const year =
    student.year !== null && student.year !== undefined && String(student.year).trim() !== ""
      ? String(student.year)
      : "";

  const interests = Array.isArray(student.interests) ? student.interests : [];
  const skillsFromApi = Array.isArray(student.skill) ? student.skill : [];

  const educationParts = [university, faculty, major, year ? `Year ${year}` : ""].filter(Boolean);

  const email =
    student.email?.trim() ||
    student.profile?.email?.trim() ||
    "-";

  const bio =
    student.about_me?.trim() ||
    student.profile?.bio?.trim() ||
    student.profile?.headline?.trim() ||
    (interests.length ? `Interests: ${interests.join(", ")}` : "Student profile");

  const me: StudentMe = {
    name: fullName,
    bio,
    phone: student.phone?.trim() || "-",
    email,
    address: student.address?.trim() || "-",
    education: educationParts.join(" • ") || "-",
    level: Number(student.level ?? 1),
    xp: Number(student.total_exp ?? 0),
    xpMax: Number(student.xp_max ?? 100),
    firstName,
    lastName,
    birthDate: student.birth_date || "",
    university,
    faculty,
    major,
    year,
    interests,
    skill: skillsFromApi,
    profileImageUrl: student.profile_image_url ?? student.avatar_image_url ?? null,
    avatarModelUrl: student.avatar_model_url ?? null,
    avatarChoiceId: student.avatar_choice ?? null,
  };

  let skills: Skill[] = [];
  if (statsData?.skill_levels && statsData.skill_levels.length > 0) {
    skills = statsData.skill_levels.map((s: any, i: number) => {
      const skillLevel = parseInt(s.skill_level || "0", 10);
      const pct = Math.min(100, Math.max(10, skillLevel * 15));
      return {
        id: s.skill_id || `s${i}`,
        name: s.skill_name || "Unknown",
        percent: pct,
      };
    });
  } else {
    skills = skillsFromApi.map((name, index) => ({
      id: `skill-${index}`,
      name,
      percent: toSkillPercent(name, index),
    }));
  }

  const doneActivities: ActivityItem[] = Array.isArray(api?.done_activities)
    ? api!.done_activities!.map((item, index) => {
      const activityType = item.activity_type || "Activity";

      return {
        id: item.activity_id || `done-${index}`,
        title: item.activity_name || "Activity",
        sub: activityType,
        xp: Number(item.xp ?? 0),
        hours: Number((item as any).hours ?? 0),
        status: item.status || "",
        detailPath: getActivityDetailPath(activityType),
      };
    })
    : [];

  const schedules: ScheduleItem[] = Array.isArray(api?.schedules)
    ? api!.schedules!.map((item: any, index) => ({
      id: item.activity_id || `schedule-${index}`,
      title: item.activity_name || "Schedule",
      sub: item.activity_type || "Activity",
      startAt: item.start_at || "",
      endAt: item.end_at || "",
      calendarColor: normalizeScheduleColor(item.calendar_color),
    }))
    : [];

  const missions: MissionItem[] = Array.isArray(api?.today_missions)
    ? api!.today_missions!.map((item, index) => ({
      id: item.activity_id || `mission-${index}`,
      title: item.activity_name || "Mission",
      startAt: item.run_start_at || "",
      endAt: item.run_end_at || "",
    }))
    : [];

  const status = api?.activities_status ?? {};
  const completionSegments: CompletionSegment[] = [
    {
      key: "completed",
      title: "Completed",
      count: Number(status.completed_number ?? 0),
      color: "#9FD5A8",
      colorClass: styles.badgeFillGreen,
      items: doneActivities
        .filter((x) => x.status.toLowerCase().includes("complete"))
        .map((x) => x.title),
    },
    {
      key: "incomplete",
      title: "Incomplete",
      count: Number(status.failed_number ?? 0),
      color: "#E58F82",
      colorClass: styles.badgeFillRed,
      items: doneActivities
        .filter((x) => x.status.toLowerCase().includes("fail"))
        .map((x) => x.title),
    },
    {
      key: "registered",
      title: "Registered",
      count: Number(status.registered_number ?? 0),
      color: "#7EC6D9",
      colorClass: styles.badgeFillBlue,
      items: schedules.map((x) => x.title),
    },
    {
      key: "inProgress",
      title: "In Progress",
      count: Number(status.waiting_feedback_number ?? 0),
      color: "#F1C97B",
      colorClass: styles.badgeFillYellowSoft,
      items: doneActivities
        .filter((x) => x.status.toLowerCase().includes("waiting"))
        .map((x) => x.title),
    },
  ];

  const xpDailyBars =
    doneActivities.length > 0
      ? doneActivities.slice(0, 10).map((item, idx) => ({
        labelTop: `A${idx + 1}`,
        labelBottom: item.sub,
        xp: Math.max(0, Number(item.xp ?? 0)),
      }))
      : [
        { labelTop: "A1", labelBottom: "No data", xp: 0 },
        { labelTop: "A2", labelBottom: "No data", xp: 0 },
      ];

  const xpWeeklyBars =
    missions.length > 0
      ? missions.slice(0, 6).map((item, idx) => ({
        labelTop: `W${idx + 1}`,
        labelBottom: shortDateTime(item.startAt),
        xp: 10,
      }))
      : [
        { labelTop: "W1", labelBottom: "No mission", xp: 0 },
        { labelTop: "W2", labelBottom: "No mission", xp: 0 },
      ];

  return {
    me,
    skills,
    doneActivities,
    schedules,
    missions,
    completionSegments,
    xpDailyBars,
    xpWeeklyBars,
  };
}

function normalizeScheduleColor(value?: string | null): StudentCalendarTrackColor {
  const raw = String(value ?? "").trim();
  const allowed: StudentCalendarTrackColor[] = [
    "pink",
    "yellow",
    "green",
    "softPink",
    "blue",
    "orange",
    "rose",
    "greenWide",
  ];

  return allowed.includes(raw as StudentCalendarTrackColor)
    ? (raw as StudentCalendarTrackColor)
    : "pink";
}

/* =======================
   Page
======================= */
export default function ClientDashboard() {
  const router = useRouter();

  const [me, setMe] = useState<StudentMe | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [doneActivities, setDoneActivities] = useState<ActivityItem[]>([]);
  const [overviewActivities, setOverviewActivities] = useState<ActivityItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [completionSegments, setCompletionSegments] = useState<CompletionSegment[]>([]);
  const [xpDailyBars, setXpDailyBars] = useState<Array<{ labelTop: string; labelBottom: string; xp: number }>>([]);
  const [xpWeeklyBars, setXpWeeklyBars] = useState<Array<{ labelTop: string; labelBottom: string; xp: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [avatarChoices, setAvatarChoices] = useState<AvatarOption[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [avatarSaving, setAvatarSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [imgNat, setImgNat] = useState({ w: 0, h: 0 });
  const [photoSaving, setPhotoSaving] = useState(false);

  const cropBoxWidth = 280;
  const cropBoxHeight = 190;
  const baseScale =
    imgNat.w && imgNat.h
      ? Math.max(cropBoxWidth / imgNat.w, cropBoxHeight / imgNat.h)
      : 1;

  const [modal, setModal] = useState<ModalKind>(null);
  const [portfolioCerts, setPortfolioCerts] = useState<Array<{ id: string; title: string; badgeLink: string }>>([]);
  const [portfolioBadges, setPortfolioBadges] = useState<Array<{ id: string; title: string; badgeLink: string }>>([]);

  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    phone: "",
    email: "",
    address: "",
    about: "",
  });

  const closeCropModal = () => {
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(null);
    setCropOpen(false);
  };

  const startCropPhoto = (f: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCropUrl(url);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setCropOpen(true);
  };

  useEffect(() => {
    return () => {
      if (photoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const [dashboardRes, activityStatsRes, avatarRes] = await Promise.all([
          fetch("/api/student", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }),
          fetch("/api/student/activitystats", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }).catch(() => null),
          fetch("/api/options/avatars/student", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }).catch(() => null),
          fetch("/api/student/activitystats", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }).catch(() => null),
          fetch("/api/student/portfolio", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }).catch(() => null),
        ]);

        const json: DashboardApiResponse = await dashboardRes.json();
        let statsJson: any = null;
        if (statsRes && statsRes.ok) {
          statsJson = await statsRes.json();
        }

        if (!dashboardRes.ok || !json.ok || !json.data) {
          throw new Error(json?.message || "Failed to load dashboard");
        }

        const mapped = mapStudentToDashboard(json.data);

        let mappedOverviewActivities: ActivityItem[] = mapped.doneActivities;
        let mappedCompletionSegments: CompletionSegment[] = mapped.completionSegments;

        if (activityStatsRes && activityStatsRes.ok) {
          const activityStatsJson: ActivityStatsResponse | null =
            await activityStatsRes.json().catch(() => null);

          if (activityStatsJson?.ok) {
            mappedOverviewActivities = mapOverviewActivities(activityStatsJson.data);
            mappedCompletionSegments = buildCompletionSegmentsFromStats(
              activityStatsJson.data,
              mapped.schedules
            );
          }
        }

        let avatarOptions: AvatarOption[] = [];
        if (avatarRes && avatarRes.ok) {
          const avatarJson = await avatarRes.json();
          avatarOptions = normalizeAvatarOptions(avatarJson);
        }

        if (!avatarOptions.length && mapped.me.avatarChoiceId && mapped.me.avatarModelUrl) {
          avatarOptions = [
            {
              id: mapped.me.avatarChoiceId,
              modelUrl: mapped.me.avatarModelUrl,
              name: "Current avatar",
            },
          ];
        }

        if (portfolioRes && portfolioRes.ok) {
          try {
            const portfolioJson = await portfolioRes.json();
            const certs: any[] = Array.isArray(portfolioJson?.data?.certificates)
              ? portfolioJson.data.certificates
              : [];
            setPortfolioCerts(
              certs
                .filter((c) => c.itemType !== "badge" && c.title)
                .map((c, i) => ({ id: c.id || `cert-${i}`, title: c.title, badgeLink: c.badgeLink || "" }))
            );
            setPortfolioBadges(
              certs
                .filter((c) => c.itemType === "badge" && c.title)
                .map((c, i) => ({ id: c.id || `badge-${i}`, title: c.title, badgeLink: c.badgeLink || "" }))
            );
          } catch {
            // portfolio load failure is non-critical
          }
        }

        const limitedAvatarOptions = limitAvatarOptions(avatarOptions, mapped.me.avatarChoiceId, 3);
        const selectedIndex = Math.max(
          0,
          limitedAvatarOptions.findIndex((option) => option.id === mapped.me.avatarChoiceId)
        );
        const selectedOption = limitedAvatarOptions[selectedIndex] ?? null;

        if (!cancelled) {
          setMe(
            selectedOption
              ? {
                ...mapped.me,
                avatarChoiceId: selectedOption.id,
                avatarModelUrl: selectedOption.modelUrl,
              }
              : mapped.me
          );
          setSkills(mapped.skills);
          setDoneActivities(mapped.doneActivities);
          setOverviewActivities(mappedOverviewActivities);
          setSchedules(mapped.schedules);
          setMissions(mapped.missions);
          setCompletionSegments(mappedCompletionSegments);
          setXpDailyBars(mapped.xpDailyBars);
          setXpWeeklyBars(mapped.xpWeeklyBars);
          setPhotoUrl(mapped.me.profileImageUrl);
          setAvatarChoices(limitedAvatarOptions);
          setSelectedAvatar(selectedIndex);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load dashboard");
          setMe(null);
          setSkills([]);
          setDoneActivities([]);
          setOverviewActivities([]);
          setSchedules([]);
          setMissions([]);
          setCompletionSegments([]);
          setXpDailyBars([]);
          setXpWeeklyBars([]);
          setAvatarChoices([]);
          setSelectedAvatar(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!me) return;

    setDraft((p) => ({
      ...p,
      firstName: me.firstName,
      lastName: me.lastName,
      birthDate: me.birthDate,
      phone: me.phone,
      email: me.email,
      address: me.address,
      about: me.bio,
    }));
  }, [me]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModal(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: 24 }}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div style={{ padding: 24, color: "#b42318" }}>{error}</div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className={styles.page}>
        <div style={{ padding: 24 }}>No dashboard data</div>
      </div>
    );
  }

  const filledMedals = Math.min(5, Math.max(0, Math.floor(me.level / 2)));

  const onPickPhoto = (f: File | null) => {
    startCropPhoto(f);
  };

  const openPhotoPicker = () => fileRef.current?.click();

  const uploadAndSaveProfilePhoto = async (blob: Blob) => {
    const file = new File([blob], "profile.png", {
      type: "image/png",
    });

    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/student/profile-image", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const uploadJson = await uploadRes.json();

    if (!uploadRes.ok || !uploadJson?.ok || !uploadJson?.key || !uploadJson?.url) {
      throw new Error(uploadJson?.message || "Failed to upload profile image");
    }

    const saveRes = await fetch("/api/student", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        profile_image_url: uploadJson.key,
      }),
    });

    const saveJson = await saveRes.json();

    if (!saveRes.ok || !saveJson?.ok) {
      throw new Error(saveJson?.message || "Failed to save profile image");
    }

    setPhotoUrl(uploadJson.url);
    setMe((prev) =>
      prev
        ? {
          ...prev,
          profileImageUrl: uploadJson.url,
        }
        : prev
    );
  };

  const onClickTile = (id: TileId) => {
    if (id === "portfolio") return router.push("/student/portfolio");
    if (id === "badges") return setModal("badges");
    if (id === "certificate") return setModal("certificate");
  };

  const handleAvatarSelect = async (idx: number) => {
    const next = avatarChoices[idx];
    if (!next || avatarSaving || !me) return;

    const prevIndex = selectedAvatar;
    const prevChoiceId = me.avatarChoiceId;
    const prevModelUrl = me.avatarModelUrl;

    setSelectedAvatar(idx);
    setMe((prev) =>
      prev
        ? {
          ...prev,
          avatarChoiceId: next.id,
          avatarModelUrl: next.modelUrl,
        }
        : prev
    );

    if (next.id === prevChoiceId) return;

    try {
      setAvatarSaving(true);

      const res = await fetch("/api/student", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          avatar_choice: next.id,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Failed to update avatar");
      }
    } catch (e: any) {
      setSelectedAvatar(prevIndex);
      setMe((prev) =>
        prev
          ? {
            ...prev,
            avatarChoiceId: prevChoiceId,
            avatarModelUrl: prevModelUrl,
          }
          : prev
      );
      alert(e?.message || "Failed to update avatar");
    } finally {
      setAvatarSaving(false);
    }
  };

  const saveEdit = async () => {
    try {
      const payload = {
        first_name: draft.firstName,
        last_name: draft.lastName,
        birth_date: draft.birthDate,
        phone: draft.phone,
        email: draft.email,
        address: draft.address,
        about_me: draft.about,
        avatar_choice: me.avatarChoiceId,
        university: me.university,
        faculty: me.faculty,
        major: me.major,
        year: me.year,
        interests: me.interests,
        skill: me.skill,
      };

      const res = await fetch("/api/student", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Failed to update profile");
      }

      const fullName = `${draft.firstName} ${draft.lastName}`.trim() || me.name;

      setMe((prev) =>
        prev
          ? {
            ...prev,
            name: fullName,
            firstName: draft.firstName,
            lastName: draft.lastName,
            birthDate: draft.birthDate,
            phone: draft.phone,
            email: draft.email,
            address: draft.address,
            bio: draft.about,
          }
          : prev
      );

      setModal(null);
    } catch (e: any) {
      alert(e?.message || "Failed to update profile");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.board}>
        <div className={styles.dash}>
          <div className={styles.left}>
            <TopProfileRow
              me={me}
              photoUrl={photoUrl}
              fileRef={fileRef}
              onPickPhoto={onPickPhoto}
              openPhotoPicker={openPhotoPicker}
              onEdit={() => setModal("editProfile")}
            />

            <MidRow
              me={me}
              filledMedals={filledMedals}
              skills={skills}
              onClickTile={onClickTile}
            />

            <ActivityMissionSplit
              activities={overviewActivities}
              onViewAll={() => router.push("/student/activities")}
              onOpenActivity={(activity) =>
                router.push(`${activity.detailPath}?activityId=${activity.id}`)
              }
            />

            <BottomSplit
              completionSegments={completionSegments}
              dailyBars={xpDailyBars}
              weeklyBars={xpWeeklyBars}
            />
          </div>

          <div className={styles.right}>
            <AvatarCard
              selected={selectedAvatar}
              onSelect={handleAvatarSelect}
              avatarChoices={avatarChoices}
              saving={avatarSaving}
            />
            <StudentCalendar siteEvents={schedules} />
          </div>

          {modal && (
            <ModalShell onClose={() => setModal(null)}>
              {modal === "editProfile" && (
                <EditProfileModal
                  draft={draft}
                  setDraft={setDraft}
                  onCancel={() => setModal(null)}
                  onSave={saveEdit}
                />
              )}

              {modal === "badges" && (
                <GridModal title="Badges" items={portfolioBadges} onClose={() => setModal(null)} />
              )}

              {modal === "certificate" && (
                <GridModal title="Certificate" items={portfolioCerts} onClose={() => setModal(null)} />
              )}
            </ModalShell>
          )}

          {cropOpen && cropUrl && (
            <div className={styles.cropOverlay} role="dialog" aria-modal="true">
              <div className={styles.cropModal}>
                <div className={styles.cropHeader}>
                  <div className={styles.cropTitle}>Crop Profile Photo</div>
                  <button
                    type="button"
                    className={styles.cropClose}
                    onClick={closeCropModal}
                  >
                    ✕
                  </button>
                </div>

                <div
                  className={styles.cropBox}
                  style={{ width: cropBoxWidth, height: cropBoxHeight }}
                >
                  <img
                    src={cropUrl}
                    alt="Crop source"
                    className={styles.cropImg}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImgNat({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                    draggable={false}
                    style={{
                      transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${baseScale * cropZoom})`,
                    }}
                  />

                  <div
                    className={styles.cropDragLayer}
                    onMouseDown={(downEvt) => {
                      downEvt.preventDefault();
                      const start = { x: downEvt.clientX, y: downEvt.clientY };
                      const startOff = { ...cropOffset };

                      const onMove = (moveEvt: MouseEvent) => {
                        const dx = moveEvt.clientX - start.x;
                        const dy = moveEvt.clientY - start.y;
                        setCropOffset({ x: startOff.x + dx, y: startOff.y + dy });
                      };

                      const onUp = () => {
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };

                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                  />
                </div>

                <div className={styles.cropControls}>
                  <label className={styles.cropLabel}>
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={2.5}
                      step={0.01}
                      value={cropZoom}
                      onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                    />
                  </label>
                </div>

                <div className={styles.cropActions}>
                  <button
                    type="button"
                    className={styles.cropBtn}
                    onClick={closeCropModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={styles.cropBtnPrimary}
                    disabled={photoSaving}
                    onClick={async () => {
                      if (!cropUrl || !imgNat.w || !imgNat.h) return;

                      try {
                        setPhotoSaving(true);

                        const img = new Image();
                        img.src = cropUrl;
                        await new Promise<void>((res) => (img.onload = () => res()));

                        const Cw = cropBoxWidth;
                        const Ch = cropBoxHeight;

                        const baseScaleNow = Math.max(Cw / imgNat.w, Ch / imgNat.h);
                        const s = baseScaleNow * cropZoom;

                        const rw = imgNat.w * s;
                        const rh = imgNat.h * s;

                        const left = (Cw - rw) / 2 + cropOffset.x;
                        const top = (Ch - rh) / 2 + cropOffset.y;

                        let sx = (0 - left) / s;
                        let sy = (0 - top) / s;
                        let sw = Cw / s;
                        let sh = Ch / s;

                        sx = Math.max(0, Math.min(imgNat.w - sw, sx));
                        sy = Math.max(0, Math.min(imgNat.h - sh, sy));

                        const outW = 840;
                        const outH = 570;
                        const canvas = document.createElement("canvas");
                        canvas.width = outW;
                        canvas.height = outH;

                        const ctx = canvas.getContext("2d")!;
                        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

                        const blob: Blob = await new Promise((resolve, reject) =>
                          canvas.toBlob((b) => {
                            if (!b) {
                              reject(new Error("Failed to create image blob"));
                              return;
                            }
                            resolve(b);
                          }, "image/png", 0.92)
                        );

                        await uploadAndSaveProfilePhoto(blob);
                        closeCropModal();
                      } catch (e: any) {
                        alert(e?.message || "Failed to save profile photo");
                      } finally {
                        setPhotoSaving(false);
                      }
                    }}
                  >
                    {photoSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =======================
   Sections
======================= */
function TopProfileRow({
  me,
  photoUrl,
  fileRef,
  onPickPhoto,
  openPhotoPicker,
  onEdit,
}: {
  me: StudentMe;
  photoUrl: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickPhoto: (f: File | null) => void;
  openPhotoPicker: () => void;
  onEdit: () => void;
}) {
  return (
    <div className={styles.topGrid}>
      <section className={cx(styles.card, styles.photoCard)}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={styles.hiddenFile}
          onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          className={styles.photoBtn}
          onClick={openPhotoPicker}
          aria-label="Change profile photo"
        >
          <div className={styles.photoFrame}>
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className={styles.photoImg} />
            ) : (
              <div className={styles.photoPlaceholder} />
            )}
          </div>
        </button>
      </section>

      <section className={styles.bioBox}>
        <div className={styles.bioBg} />

        <button
          className={styles.editButtonIcon}
          type="button"
          aria-label="Edit personal information"
          onClick={onEdit}
        >
          ✎
        </button>

        <div className={styles.bioInformation}>
          <div className={styles.profileName}>{me.name}</div>
          <div className={styles.profileBio}>{me.bio}</div>

          <div className={styles.linesWrap}>
            <div className={styles.lineTop} />
            <div className={styles.lineBottomLeft} />
            <div className={styles.lineBottomRight} />
            <div className={styles.lineVertical} />
          </div>

          <div className={styles.profilePhone}>Phone: {me.phone}</div>
          <div className={styles.profileEmail}>Email: {me.email}</div>
          <div className={styles.profileAddress}>Address: {me.address}</div>
          <div className={styles.profileEducation}>Education: {me.education}</div>
        </div>
      </section>
    </div>
  );
}

function MidRow({
  me,
  skills,
  onClickTile,
}: {
  me: StudentMe;
  filledMedals: number;
  skills: Skill[];
  onClickTile: (id: TileId) => void;
}) {
  const badgeThresholds = [1, 3, 5, 10, 16];
  const filledMedals = badgeThresholds.filter((lv) => me.level >= lv).length;
  const currentBadgeIndex =
    filledMedals > 0 ? Math.min(filledMedals - 1, LEVEL_BADGES.length - 1) : -1;

  return (
    <div className={styles.midGrid}>
      <section className={cx(styles.card, styles.rankCard)}>
        <div className={styles.rankTop}>
          <div className={styles.levelWrap}>
            <div className={styles.levelXpBox} />

            <div className={styles.levelXpScore}>
              <span>{me.xp}/{me.xpMax}</span>
              <span>XP</span>
            </div>

            <div className={styles.levelBadgeBox}>
              <div className={styles.levelBadgeBg} />
              <div className={styles.levelValue}>{me.level}</div>
            </div>

            <img
              src={
                currentBadgeIndex >= 0
                  ? LEVEL_BADGES[currentBadgeIndex]
                  : "/images/icons/badge01-icon.png"
              }
              alt=""
              aria-hidden="true"
              className={styles.levelBadgeIcon}
            />
          </div>
        </div>

        <div className={styles.medalRow}>
          {LEVEL_BADGES.map((src, i) => {
            const unlocked = i < filledMedals;
            const active = i === currentBadgeIndex;

            return (
              <div
                key={src}
                className={cx(
                  styles.medalSlot,
                  unlocked ? styles.medalOn : styles.medalOff,
                  active && styles.medalActive
                )}
              >
                <img
                  src={src}
                  alt={`Level badge ${i + 1}`}
                  className={styles.medalImg}
                  draggable={false}
                />
              </div>
            );
          })}
        </div>

        <div className={styles.tileRow}>
          {BADGE_TILES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.tileBtn}
              onClick={() => onClickTile(t.id)}
              aria-label={t.label}
            >
              <div className={styles.tileOuter} />
              <div className={styles.tileInner} />

              <div className={styles.tileIconWrap}>
                <img src={t.image} alt={t.alt} className={styles.tileIcon} />
              </div>

              <div className={styles.tileLabel}>{t.label}</div>
            </button>
          ))}
        </div>
      </section>

      <section className={cx(styles.card, styles.skillCard)}>
        <div className={styles.skillHead}>
          <div className={styles.skillTitle}>Skill Progress graph</div>
        </div>

        <div className={styles.skillViewport}>
          <div
            className={styles.skillScroll}
            role="region"
            aria-label="Skill progress list"
          >
            <div className={styles.skillRow}>
              {skills.length > 0 ? (
                skills.map((s, i) => (
                  <div key={s.id} className={styles.skillCol}>
                    <div className={styles.skillPct}>{s.percent}%</div>

                    <div className={styles.skillTube}>
                      <div
                        className={cx(
                          styles.skillFill,
                          i === 0 && styles.trackGreenWide,
                          i === 1 && styles.trackPink,
                          i === 2 && styles.trackYellow,
                          i === 3 && styles.trackGreen,
                          i === 4 && styles.trackSoftPink,
                          i === 5 && styles.trackBlue,
                          i === 6 && styles.trackOrange,
                          i === 7 && styles.trackRose,
                          i === 8 && styles.trackSoftPink,
                          i === 9 && styles.trackBlue,
                          i === 10 && styles.trackOrange,
                          i === 11 && styles.trackRose
                        )}
                        style={{ height: `${s.percent}%` }}
                      />
                    </div>

                    <div className={styles.skillLabel} title={s.name}>
                      {s.name}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 16 }}>No skills</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActivityMissionSplit({
  activities,
  onViewAll,
  onOpenActivity,
}: {
  activities: ActivityItem[];
  onViewAll: () => void;
  onOpenActivity: (activity: ActivityItem) => void;
}) {
  function statusPillClass(status: string) {
    const s = String(status ?? "").trim().toLowerCase();

    if (s === "completed" || s === "complete") {
      return styles.overviewStatusComplete;
    }

    if (
      s === "in progress" ||
      s === "in_progress" ||
      s === "submitted" ||
      s === "waiting" ||
      s === "waiting feedback"
    ) {
      return styles.overviewStatusProgress;
    }

    if (s === "failed" || s === "fail" || s === "incomplete") {
      return styles.overviewStatusIncomplete;
    }

    return styles.overviewStatusProgress;
  }

  function statusLabel(status: string) {
    const s = String(status ?? "").trim().toLowerCase();

    if (s === "completed" || s === "complete") {
      return "Completed";
    }

    if (
      s === "in progress" ||
      s === "in_progress" ||
      s === "submitted" ||
      s === "waiting" ||
      s === "waiting feedback"
    ) {
      return "In progress";
    }

    if (s === "failed" || s === "fail" || s === "incomplete") {
      return "Incomplete";
    }

    return "In progress";
  }

  return (
    <section className={cx(styles.card, styles.splitCard)}>
      <div className={styles.activityPane}>
        <div className={styles.activityPaneHead}>
          <div className={styles.activityOverviewTitle}>Activity Overview</div>

          <button className={styles.viewAllBtn} type="button" onClick={onViewAll}>
            <span>view all</span>
          </button>
        </div>

        <div className={styles.activityScrollArea}>
          {activities.length > 0 ? (
            <div className={styles.activityTable}>
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  className={styles.activityRowLink}
                  onClick={() => onOpenActivity(activity)}
                >
                  <article className={styles.overviewRow}>
                    <div className={styles.overviewIconCell} aria-hidden>
                      <img
                        src="/images/icons/jigsaw-icon.png"
                        alt=""
                        className={styles.overviewBadgeImg}
                        draggable={false}
                      />
                    </div>

                    <div className={styles.overviewTitleCell}>
                      <div className={styles.overviewName}>{activity.title}</div>
                    </div>

                    <div className={styles.overviewMetaCol}>
                      <div className={styles.overviewMetaLabel}>Category</div>
                      <div className={styles.overviewMetaValue}>{activity.sub}</div>
                    </div>

                    <div className={styles.overviewMetaCol}>
                      <div className={styles.overviewMetaLabel}>Hours</div>
                      <div className={styles.overviewMetaValue}>{activity.hours}</div>
                    </div>

                    <div className={styles.overviewStatusCol}>
                      <div
                        className={cx(
                          styles.overviewStatusPill,
                          statusPillClass(activity.status)
                        )}
                      >
                        {statusLabel(activity.status)}
                      </div>
                    </div>
                  </article>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.overviewEmpty}>No activities yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function BottomSplit({
  completionSegments,
  dailyBars,
  weeklyBars,
}: {
  completionSegments: CompletionSegment[];
  dailyBars: Array<{ labelTop: string; labelBottom: string; xp: number }>;
  weeklyBars: Array<{ labelTop: string; labelBottom: string; xp: number }>;
}) {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [selectedSegment, setSelectedSegment] = useState<ActivityStatusKey | null>(null);

  const segmentOrder = completionSegments;
  const totalActivities = segmentOrder.reduce((sum, seg) => sum + seg.count, 0);

  const allItems = segmentOrder.flatMap((seg) =>
    seg.items.map((item) => ({
      item,
      colorClass: seg.colorClass,
      sectionTitle: seg.title,
    }))
  );

  const currentInfo = selectedSegment
    ? segmentOrder.find((x) => x.key === selectedSegment) ?? null
    : null;

  const rightItems = currentInfo
    ? currentInfo.items.map((item) => ({
      item,
      colorClass: currentInfo.colorClass,
      sectionTitle: currentInfo.title,
    }))
    : allItems;

  const barsRaw = period === "daily" ? dailyBars : weeklyBars;
  const size = 210;
  const center = size / 2;
  const radius = 56;
  const strokeWidth = 40;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  const donutSegments =
    totalActivities > 0
      ? segmentOrder.map((seg) => {
        const fraction = seg.count / totalActivities;
        const arc = circumference * fraction;
        const startFraction = accumulated;
        const midFraction = startFraction + fraction / 2;
        accumulated += fraction;

        const angle = midFraction * Math.PI * 2 - Math.PI / 2;
        const isActive = selectedSegment === seg.key;

        const popDistance = isActive ? 3 : 0;
        const offsetX = isActive ? Math.cos(angle) * popDistance : 0;
        const offsetY = isActive ? Math.sin(angle) * popDistance : 0;

        const labelRadius =
          seg.key === "inProgress"
            ? radius - strokeWidth / 2 + 2
            : radius - strokeWidth / 2 + 8;

        const labelX = center + Math.cos(angle) * labelRadius;
        const labelY = center + Math.sin(angle) * labelRadius;

        return {
          ...seg,
          arc,
          dashOffset: -startFraction * circumference,
          offsetX,
          offsetY,
          labelX,
          labelY,
          isActive,
        };
      })
      : [];

  const yTicks = period === "daily" ? [0, 10, 20, 30, 40] : [0, 50, 100, 150, 200];
  const chartMaxValue = yTicks[yTicks.length - 1];
  const chartDrawableHeight = period === "daily" ? 116 : 124;

  const barsForRender = barsRaw.map((b) => ({
    ...b,
    h:
      b.xp <= 0
        ? 12
        : Math.max(22, Math.round((b.xp / chartMaxValue) * chartDrawableHeight)),
  }));

  const itemWidth = period === "daily" ? 60 : 82;
  const itemGap = period === "daily" ? 8 : 12;
  const plotWidth = barsForRender.length * itemWidth + Math.max(0, barsForRender.length - 1) * itemGap;

  return (
    <section className={cx(styles.card, styles.splitCardBottom)}>
      <div className={styles.bottomSplitDivider} aria-hidden />

      <div className={styles.completionPane}>
        <div className={styles.completionTitle}>Activity Completion Status</div>

        <div className={styles.completionContentFigure}>
          <div className={styles.completionDonutCol}>
            <div
              className={styles.donutFigureWrap}
              onClick={() => setSelectedSegment(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedSegment(null);
                }
              }}
              aria-label="Show all activity statuses"
            >
              <svg
                viewBox={`0 0 ${size} ${size}`}
                className={styles.donutFigureSvg}
                aria-label="Activity completion donut chart"
              >
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="#F3EEE8"
                  strokeWidth={strokeWidth}
                />

                {donutSegments.map((seg) => (
                  <g
                    key={seg.key}
                    transform={`translate(${seg.offsetX} ${seg.offsetY})`}
                    className={styles.donutFigureGroup}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSegment(seg.key);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedSegment(seg.key);
                      }
                    }}
                  >
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="butt"
                      strokeDasharray={`${seg.arc} ${circumference - seg.arc}`}
                      strokeDashoffset={seg.dashOffset}
                      transform={`rotate(-90 ${center} ${center})`}
                      className={cx(
                        styles.donutFigureStroke,
                        selectedSegment === null && styles.donutFigureStrokeNeutral,
                        seg.isActive && styles.donutFigureStrokeActive,
                        selectedSegment !== null &&
                        selectedSegment !== seg.key &&
                        styles.donutFigureStrokeDim
                      )}
                    />

                  </g>
                ))}

                <circle
                  cx={center}
                  cy={center}
                  r={30}
                  fill="#F4F4F1"
                  stroke="#3A332C"
                  strokeWidth="1.4"
                />

                <text
                  x={center}
                  y={center + 6}
                  textAnchor="middle"
                  className={styles.donutFigureCenter}
                >
                  {totalActivities}
                </text>
              </svg>
            </div>

            <div className={styles.completionLegendGrid}>
              {segmentOrder.map((seg) => (
                <button
                  key={seg.key}
                  type="button"
                  className={cx(
                    styles.completionLegendButton,
                    seg.colorClass,
                    selectedSegment === seg.key && styles.completionLegendButtonActive
                  )}
                  onClick={() => setSelectedSegment(seg.key)}
                >
                  <span className={styles.completionLegendButtonText}>{seg.title}</span>
                  <span className={styles.completionLegendButtonCount}>({seg.count})</span>
                </button>
              ))}

              <button
                type="button"
                className={cx(
                  styles.completionLegendButton,
                  styles.completionLegendAllButton,
                  selectedSegment === null && styles.completionLegendButtonActive
                )}
                onClick={() => setSelectedSegment(null)}
              >
                <span className={styles.completionLegendButtonText}>All</span>
                <span className={styles.completionLegendButtonCount}>({totalActivities})</span>
              </button>
            </div>
          </div>

          <div className={styles.completionInfoCol}>
            <div
              className={cx(
                styles.completionBadgeFigure,
                currentInfo ? currentInfo.colorClass : styles.completionBadgeAll
              )}
            >
              {currentInfo ? currentInfo.title : "All Statuses"}
            </div>

            <div className={styles.completionInfoListScrollable}>
              {rightItems.length > 0 ? (
                rightItems.map((entry, idx) => (
                  <div key={`${entry.sectionTitle}-${entry.item}-${idx}`} className={styles.completionInfoItem}>
                    - {entry.item}
                  </div>
                ))
              ) : (
                <div className={styles.completionInfoItem}>- No data</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.xpPane}>
        <div className={styles.xpChartTitle}>
          {period === "daily" ? "กราฟ XP ต่อวัน" : "กราฟ XP ต่อสัปดาห์"}
        </div>

        <div className={styles.periodButton}>
          <div className={styles.periodButtonOuter} />

          <button
            type="button"
            className={styles.periodDaily}
            onClick={() => setPeriod("daily")}
            aria-pressed={period === "daily"}
          >
            <div
              className={cx(
                styles.periodDailyBg,
                period === "daily" ? styles.periodActiveBg : styles.periodInactiveBg
              )}
            />
            <div className={styles.periodText}>daily</div>
          </button>

          <button
            type="button"
            className={styles.periodWeekly}
            onClick={() => setPeriod("weekly")}
            aria-pressed={period === "weekly"}
          >
            <div
              className={cx(
                styles.periodWeeklyBg,
                period === "weekly" ? styles.periodActiveBg : styles.periodInactiveBg
              )}
            />
            <div className={styles.periodText}>weekly</div>
          </button>

          <div className={styles.periodDividerLine} />
        </div>

        <div className={styles.barGraph}>
          <div className={styles.barScrollArea}>
            <div className={styles.barGraphInner}>
              <div className={styles.barYAxis}>
                {yTicks
                  .slice()
                  .reverse()
                  .map((tick) => (
                    <div key={tick} className={styles.barYAxisTick}>
                      <span className={styles.barYAxisLabel}>{tick}</span>
                    </div>
                  ))}
              </div>

              <div className={styles.barPlotArea} style={{ width: `${Math.max(plotWidth, 320)}px` }}>
                {yTicks
                  .slice(1)
                  .reverse()
                  .map((tick, idx) => (
                    <div key={tick} className={styles.barGridLine} style={{ top: `${idx * 25}%` }}>
                      <span className={styles.barGridValue}>{tick}</span>
                    </div>
                  ))}

                <div className={styles.barBaseLine} />

                <div
                  className={cx(
                    styles.barGroup,
                    period === "weekly" && styles.barGroupWeekly
                  )}
                >
                  {barsForRender.map((b) => (
                    <div
                      key={`${period}-${b.labelTop}-${b.labelBottom}`}
                      className={cx(
                        styles.barGroupItem,
                        period === "weekly" && styles.barGroupItemWeekly
                      )}
                    >
                      <div className={styles.barRect} style={{ height: `${b.h}px` }} />
                      <div className={styles.barXp} style={{ bottom: `${b.h + 40}px` }}>
                        {b.xp} XP
                      </div>
                      <div className={styles.barDateLabel}>
                        <span className={styles.barDay}>{b.labelTop}</span>
                        <span className={styles.barDate}>{b.labelBottom}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AvatarCard({
  selected,
  onSelect,
  avatarChoices,
  saving = false,
}: {
  selected: number;
  onSelect: (idx: number) => void;
  avatarChoices: AvatarOption[];
  saving?: boolean;
}) {
  const currentAvatar = avatarChoices[selected] ?? null;

  return (
    <section className={cx(styles.card, styles.avatarCard)}>
      <div className={styles.avatarBig}>
        {currentAvatar?.modelUrl ? (
          <div className={styles.avatarBigStage}>
            <Avatar3D
              modelUrl={currentAvatar.modelUrl}
              className={styles.avatarViewport}
              modelScale={1.5}
              modelPosition={[0, -0.7, 0]}
              cameraPosition={[0.5, 0.02, 2.5]}
              cameraFov={38}
            />
          </div>
        ) : (
          <div className={styles.avatarEmpty}>No avatar</div>
        )}
      </div>

      <div className={styles.avatarThumbRow}>
        {avatarChoices.map((avatar, idx) => (
          <button
            key={avatar.id}
            type="button"
            className={cx(styles.avatarThumbCard, idx === selected && styles.avatarThumbCardOn)}
            onClick={() => onSelect(idx)}
            disabled={saving}
            aria-label={`Select ${avatar.name}`}
            aria-pressed={idx === selected}
          >
            <div className={styles.avatarThumbImg}>
              <Avatar3D
                modelUrl={avatar.modelUrl}
                className={styles.avatarViewport}
                modelScale={1.1}
                modelPosition={[0, -0.55, 0]}
                cameraPosition={[0, 0.05, 2.2]}
                cameraFov={34}
              />
            </div>

            <div className={styles.avatarCheck}>
              <span className={cx(styles.checkBox, idx === selected && styles.checkBoxOn)}>
                {idx === selected ? "✓" : ""}
              </span>
            </div>
          </button>
        ))}
      </div>
      {/* {saving && <div className={styles.avatarSavingText}>Saving avatar...</div>} */}
    </section>
  );
}

type CalendarEvent =
  | "pink"
  | "yellow"
  | "green"
  | "softPink"
  | "blue"
  | "orange"
  | "rose"
  | "greenWide";

type CalendarDayItem = {
  day: string;
  weekend?: boolean;
  otherMonth?: boolean;
  muted?: boolean;
  events: CalendarEvent[];
};

function CalendarCard({
  title,
  schedules,
}: {
  title: string;
  schedules: ScheduleItem[];
}) {
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const weeks: CalendarDayItem[][] = [
    [
      { day: "28", otherMonth: true, events: [] },
      { day: "29", otherMonth: true, events: [] },
      { day: "30", otherMonth: true, events: [] },
      { day: "1", events: ["green", "orange"] },
      { day: "2", events: ["orange"] },
      { day: "3", events: ["rose"] },
      { day: "4", weekend: true, events: [] },
    ],
    [
      { day: "5", weekend: true, events: ["pink", "yellow", "green"] },
      { day: "6", events: ["softPink", "blue"] },
      { day: "7", events: [] },
      { day: "8", events: ["greenWide", "pink"] },
      { day: "9", events: [] },
      { day: "10", events: [] },
      { day: "11", weekend: true, events: [] },
    ],
    [
      { day: "12", weekend: true, muted: true, events: [] },
      { day: "13", muted: true, events: [] },
      { day: "14", muted: true, events: [] },
      { day: "15", muted: true, events: [] },
      { day: "16", muted: true, events: [] },
      { day: "17", muted: true, events: [] },
      { day: "18", weekend: true, muted: true, events: [] },
    ],
    [
      { day: "19", weekend: true, muted: true, events: [] },
      { day: "20", muted: true, events: [] },
      { day: "21", muted: true, events: [] },
      { day: "22", muted: true, events: [] },
      { day: "23", muted: true, events: [] },
      { day: "24", muted: true, events: [] },
      { day: "25", weekend: true, muted: true, events: [] },
    ],
    [
      { day: "26", weekend: true, muted: true, events: [] },
      { day: "27", muted: true, events: [] },
      { day: "28", muted: true, events: [] },
      { day: "29", muted: true, events: [] },
      { day: "30", muted: true, events: [] },
      { day: "31", muted: true, events: [] },
      { day: "1", otherMonth: true, muted: true, events: [] },
    ],
    [
      { day: "2", otherMonth: true, events: [] },
      { day: "3", otherMonth: true, events: [] },
      { day: "4", otherMonth: true, events: [] },
      { day: "5", otherMonth: true, events: [] },
      { day: "6", otherMonth: true, events: [] },
      { day: "7", otherMonth: true, events: [] },
      { day: "8", otherMonth: true, events: [] },
    ],
  ];

  return (
    <section className={cx(styles.card, styles.calendarCard)}>
      <div className={styles.calendarPanel}>
        <div className={styles.calendarHeader}>
          <div className={styles.calendarMonthChip}>
            <div className={styles.calendarTitle}>{title}</div>
          </div>
        </div>

        <div className={styles.calendarGrid}>
          <div className={styles.calendarRow}>
            {weekDays.map((d, idx) => (
              <div
                key={d}
                className={cx(
                  styles.calendarWeekDay,
                  (idx === 0 || idx === 6) && styles.calendarWeekEnd
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, rowIdx) => (
            <div key={rowIdx} className={styles.calendarRow}>
              {week.map((item, idx) => (
                <div
                  key={`${rowIdx}-${idx}-${item.day}`}
                  className={cx(
                    styles.calendarCell,
                    item.weekend && styles.calendarWeekEnd,
                    item.otherMonth && styles.calendarOtherMonth,
                    item.muted && styles.calendarMutedCell
                  )}
                >
                  <div className={styles.calendarCellInner}>
                    <div className={styles.calendarDay}>{item.day}</div>

                    <div className={styles.calendarEvents}>
                      {item.events.map((event, i) => (
                        <div
                          key={i}
                          className={cx(
                            styles.trackBar,
                            event === "pink" && styles.trackPink,
                            event === "yellow" && styles.trackYellow,
                            event === "green" && styles.trackGreen,
                            event === "softPink" && styles.trackSoftPink,
                            event === "blue" && styles.trackBlue,
                            event === "orange" && styles.trackOrange,
                            event === "rose" && styles.trackRose,
                            event === "greenWide" && styles.trackGreenWide
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {schedules.length > 0 && (
            <div style={{ padding: "10px 6px 0 6px", fontSize: 12 }}>
              {schedules.slice(0, 3).map((item) => (
                <div key={item.id} style={{ marginBottom: 6 }}>
                  {item.title} • {shortDateTime(item.startAt)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function EditProfileModal({
  draft,
  setDraft,
  onCancel,
  onSave,
}: {
  draft: {
    firstName: string;
    lastName: string;
    birthDate: string;
    phone: string;
    email: string;
    address: string;
    about: string;
  };
  setDraft: React.Dispatch<React.SetStateAction<any>>;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className={styles.modalTitle}>Personal Information</div>

      <div className={styles.modalForm}>
        <Field label="First name">
          <input className={styles.modalInput} value={draft.firstName} onChange={(e) => setDraft((p: any) => ({ ...p, firstName: e.target.value }))} />
        </Field>

        <Field label="Last name">
          <input className={styles.modalInput} value={draft.lastName} onChange={(e) => setDraft((p: any) => ({ ...p, lastName: e.target.value }))} />
        </Field>

        <div className={styles.modalGrid2}>
          <Field label="Birth date">
            <input className={styles.modalInput} value={draft.birthDate} onChange={(e) => setDraft((p: any) => ({ ...p, birthDate: e.target.value }))} />
          </Field>

          <Field label="Phone number">
            <input className={styles.modalInput} value={draft.phone} onChange={(e) => setDraft((p: any) => ({ ...p, phone: e.target.value }))} />
          </Field>
        </div>

        <Field label="Email">
          <input className={styles.modalInput} value={draft.email} onChange={(e) => setDraft((p: any) => ({ ...p, email: e.target.value }))} />
        </Field>

        <Field label="Address">
          <input className={styles.modalInput} value={draft.address} onChange={(e) => setDraft((p: any) => ({ ...p, address: e.target.value }))} />
        </Field>

        <Field label="About me">
          <textarea className={styles.modalTextarea} value={draft.about} onChange={(e) => setDraft((p: any) => ({ ...p, about: e.target.value }))} />
        </Field>
      </div>

      <div className={styles.modalActions}>
        <button className={cx(styles.modalBtn, styles.modalOk)} type="button" onClick={onSave} aria-label="Save">
          ✓
        </button>
        <button className={cx(styles.modalBtn, styles.modalCancel)} type="button" onClick={onCancel} aria-label="Cancel">
          ✕
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <div className={styles.modalLabel}>{label}</div>
      {children}
    </label>
  );
}

function GridModal({
  title,
  items,
  onClose,
}: {
  title: string;
  items: Array<{ id: string; title: string; badgeLink: string }>;
  onClose: () => void;
}) {
  return (
    <>
      <div className={styles.modalTitle}>{title}</div>
      <div className={styles.modalGridBadges}>
        {items.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", padding: "16px 0", fontSize: 14, color: "#888" }}>
            No {title.toLowerCase()} yet
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={styles.modalBadgeBox} title={item.title}>
              {item.badgeLink ? (
                <img
                  src={item.badgeLink}
                  alt={item.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }}
                />
              ) : (
                <div style={{ fontSize: 11, padding: 4, wordBreak: "break-word", textAlign: "center" }}>
                  {item.title}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className={styles.modalActions}>
        <button className={cx(styles.modalBtn, styles.modalOk)} type="button" onClick={onClose} aria-label="Close">
          ✓
        </button>
      </div>
    </>
  );
}