"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ActivityDashboard.module.css";

interface SkillItem {
  id: string;
  skill_id: string;
  skill_name: string;
  skill_category?: string;
  skill_level_value: number;
  skill_level_label: string;
}

// interface SkillCatalogItem {
//   skillId: string;
//   skillName: string;
//   skillCategory: string;
// }

interface ActivityDetail {
  activity_id: string;
  activity_name: string;
  activity_type: string;
  activity_detail: string;
  status: string;
  visibility: string;
  hours: number;
  max_participants: number;
  is_open_ended: boolean;
  enroll_start_at: string;
  enroll_end_at: string;
  run_start_at: string;
  run_end_at: string;
  skills: SkillItem[];
  meeting_info?: {
    type: string;
    location: string;
    speaker: string;
    speaker_position: string;
    qrcode_checkin: string;
  };
  challenge_info?: {
    problem_statement: string;
    description: string;
    level: string;
    submit_type: string;
  };
  course_info?: {
    modules: Array<{
      module_name: string;
      description: string;
      lessons: Array<{ title: string; type: string; data: string }>;
      quizzes: any[];
    }>;
  };
}

interface ParticipantItem {
  id: string;
  name: string;
  bio: string;
  profileImage: string;
  score: number;
  status: "Doing" | "Completed";
}

interface ActivityStats {
  registrants: number;
  doing: number;
  completed: number;
  awaitingCheck: number;
}

const SKILL_LEVEL_LABELS = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

function normalizeTextValue(value: any): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed.trim();
    } catch { }
    return trimmed;
  }

  if (typeof value === "object") {
    if (typeof value?.text === "string") return value.text.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value).trim();
}

function normalizeSkillId(skill: any, fallback = ""): string {
  return String(
    skill?.skill_id ??
    skill?.skillID ??
    skill?.skillId ??
    skill?.SkillID ??
    skill?.id ??
    fallback
  ).trim();
}

function normalizeSkillName(skill: any): string {
  return String(
    skill?.skill_name ??
    skill?.skillName ??
    skill?.SkillName ??
    skill?.name ??
    ""
  ).trim();
}

function normalizeSkillLevelNumber(skill: any): number {
  const value = Number(
    skill?.skill_level ??
    skill?.skillLevel ??
    skill?.SkillLevel ??
    skill?.level ??
    0
  );

  return Number.isFinite(value) && value >= 0 ? value : 0;
}

// แยก date/time จาก ISO string โดยตรง เพื่อไม่ให้ timezone shift ผิด
// รองรับ "2026-04-16T00:00:00+07:00" และ "2026-04-16T00:00:00Z"
function parseDateTimeParts(isoString: string): { date: string; time: string } {
  if (!isoString) return { date: "-", time: "-" };
  try {
    // ตัด timezone suffix ออก แล้วอ่าน local datetime ตรงๆ
    // เช่น "2026-04-16T07:00:00+07:00" → "2026-04-16T07:00:00"
    const local = isoString.replace(/([+-]\d{2}:\d{2}|Z)$/, "");
    const [datePart, timePart] = local.split("T");
    if (!datePart) return { date: isoString, time: "-" };

    // format date: DD Mon YYYY
    const [year, month, day] = datePart.split("-").map(Number);
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = `${String(day).padStart(2,"0")} ${MONTHS[(month ?? 1) - 1] ?? "?"} ${year}`;

    // format time: HH:MM
    const timeStr = timePart ? timePart.slice(0, 5) : "00:00";

    return { date: dateStr, time: timeStr };
  } catch {
    return { date: isoString, time: "-" };
  }
}

function formatDateTimeRange(start: string, end: string) {
  if (!start && !end) return "-";
  const s = parseDateTimeParts(start);
  const e = parseDateTimeParts(end);
  return `${s.date} • ${s.time} → ${e.date} • ${e.time}`;
}

function capitalize(str: string) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function getActivityTypeLabel(type: string) {
  if (type === "meeting") return "Meetings";
  if (type === "course") return "Courses";
  if (type === "challenge") return "Challenges";
  return capitalize(type);
}

async function fetchActivitySkills(activityId: string): Promise<SkillItem[]> {
  try {
    const res = await fetch(`/api/organization/activity/${activityId}/skills`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) return [];
    return Array.isArray(data?.skills) ? data.skills : [];
  } catch {
    return [];
  }
}

function normalizeActivityResponse(activityId: string, payload: any): ActivityDetail {
  const raw = payload?.activity ?? payload ?? {};
  const info = raw?.commonInfo ?? raw?.common_info ?? raw;

  const meetingInfo =
    raw?.meeting_info ?? raw?.meetingInfo ??
    info?.meeting_info ?? info?.meetingInfo;

  // backend อาจ return challenge_info หลาย format
  const challengeInfoWrapped =
    raw?.challenge_info ?? raw?.challengeInfo ??
    raw?.challenge ??
    info?.challenge_info ?? info?.challengeInfo ??
    info?.challenge;

  const challengeInfo = challengeInfoWrapped ?? (
    (raw?.problem_statement != null || info?.problem_statement != null ||
     raw?.level != null || info?.level != null)
      ? {
          problem_statement: raw?.problem_statement ?? info?.problem_statement,
          description: raw?.goal_expected_outcome ?? raw?.goal ?? info?.goal_expected_outcome ?? info?.goal,
          level: raw?.level ?? info?.level,
          submit_type: raw?.submit_type ?? raw?.submission_requirements ?? info?.submit_type ?? info?.submission_requirements,
        }
      : null
  );

  // course response is flat — modules live directly on raw/info
  // wrapped form (course_info / courseInfo) is also supported
  const courseInfoWrapped =
    raw?.course_info ?? raw?.courseInfo ??
    info?.course_info ?? info?.courseInfo;

  // detect course by type or by presence of modules/course_id
  const detectedType = String(
    info?.activity_type ?? raw?.activity_type ?? ""
  ).toLowerCase();

  const rawModules =
    courseInfoWrapped?.modules ??
    raw?.modules ??
    info?.modules;

  const isCourse =
    detectedType === "course" ||
    !!raw?.course_id ||
    !!raw?.course_name ||
    Array.isArray(rawModules);

  // normalize modules array
  function normalizeModules(modules: any[]): ActivityDetail["course_info"] {
    return {
      modules: modules.map((m: any) => ({
        module_name: String(m?.module_name ?? m?.name ?? ""),
        description: String(m?.description ?? ""),
        lessons: Array.isArray(m?.lessons)
          ? m.lessons.map((l: any) => ({
              title: String(l?.title ?? ""),
              type: String(l?.type ?? ""),
              data: String(l?.data ?? ""),
            }))
          : [],
        quizzes: Array.isArray(m?.quizzes) ? m.quizzes : [],
      })),
    };
  }

  const courseInfo: ActivityDetail["course_info"] =
    isCourse && Array.isArray(rawModules) && rawModules.length > 0
      ? normalizeModules(rawModules)
      : isCourse
        ? { modules: [] }
        : undefined;

  // normalize skills — backend returns { activityID, skillID, level }
  // but skills route returns { skill_id, skill_level_value, ... }
  const rawSkills: any[] = Array.isArray(raw?.skills)
    ? raw.skills
    : Array.isArray(info?.skills)
      ? info.skills
      : [];

  const skills: SkillItem[] = rawSkills.map((s: any, index: number) => {
    const skillId = normalizeSkillId(s, `skill-${index}`);
    // Backend returns Level (PascalCase), level (lowercase), skill_level, skillLevel
    const levelRaw = s?.Level ?? s?.level ?? s?.skill_level ?? s?.skillLevel ?? 0;
    const levelValue = Number.isFinite(Number(levelRaw)) ? Number(levelRaw) : 0;
    const SKILL_LEVEL_LABELS_LOCAL = [
      "Remembering", "Understanding", "Applying",
      "Analyzing", "Evaluating", "Creating",
    ];
    return {
      id: s?.id ?? s?.ID ?? `skill-${skillId}-${index}`,
      skill_id: skillId,
      skill_name: normalizeSkillName(s),
      skill_category: String(s?.skill_category ?? s?.skillCategory ?? ""),
      skill_level_value: levelValue,
      skill_level_label: SKILL_LEVEL_LABELS_LOCAL[levelValue] ?? SKILL_LEVEL_LABELS_LOCAL[0],
    };
  });

  return {
    activity_id: String(info?.activity_id ?? raw?.activity_id ?? raw?.id ?? activityId),
    activity_name: String(info?.activity_name ?? raw?.activity_name ?? ""),
    activity_type: String(info?.activity_type ?? raw?.activity_type ?? ""),
    activity_detail: normalizeTextValue(
      info?.activity_detail ?? raw?.activity_detail ?? raw?.description ?? ""
    ),
    status: String(
      info?.activity_status ?? info?.status ??
      raw?.activity_status ?? raw?.status ?? "draft"
    ),
    visibility: String(
      info?.activity_visibility ?? info?.visibility ??
      raw?.activity_visibility ?? raw?.visibility ?? "public"
    ),
    hours: Number(
      info?.activity_hours ?? info?.hours ??
      raw?.activity_hours ?? raw?.hours ?? 0
    ),
    max_participants: Number(
      info?.activity_max_participants ?? info?.max_participants ??
      raw?.activity_max_participants ?? raw?.max_participants ?? 0
    ),
    is_open_ended: Boolean(info?.is_open_ended ?? raw?.is_open_ended ?? false),
    enroll_start_at:
      info?.activity_enroll_start_at ?? info?.enroll_start_at ??
      raw?.activity_enroll_start_at ?? raw?.enroll_start_at ??
      raw?.enroll_start ?? "",
    enroll_end_at:
      info?.activity_enroll_end_at ?? info?.enroll_end_at ??
      raw?.activity_enroll_end_at ?? raw?.enroll_end_at ??
      raw?.enroll_end ?? "",
    run_start_at:
      info?.activity_start_at ?? info?.run_start_at ??
      raw?.activity_start_at ?? raw?.run_start_at ??
      raw?.start_at ?? "",
    run_end_at:
      info?.activity_end_at ?? info?.run_end_at ??
      raw?.activity_end_at ?? raw?.run_end_at ??
      raw?.end_at ?? "",
    skills,
    meeting_info: meetingInfo
      ? {
          type: String(meetingInfo?.type ?? ""),
          location: String(meetingInfo?.location ?? ""),
          speaker: String(meetingInfo?.speaker ?? ""),
          speaker_position: String(meetingInfo?.speaker_position ?? ""),
          qrcode_checkin: String(meetingInfo?.qrcode_checkin ?? ""),
        }
      : undefined,
    challenge_info: challengeInfo
      ? {
          problem_statement: String(challengeInfo?.problem_statement ?? ""),
          description: String(challengeInfo?.description ?? ""),
          level: String(challengeInfo?.level ?? ""),
          submit_type: String(challengeInfo?.submit_type ?? ""),
        }
      : undefined,
    course_info: courseInfo,
  };
}

async function fetchActivityById(activityId: string): Promise<ActivityDetail> {
  // ดึงข้อมูลปกติก่อน (ไม่ใส่ prefer=course เพื่อให้ได้ challenge_info ครบ)
  const res = await fetch(`/api/organization/activity/${activityId}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Failed to load activity (${res.status})`);
  }

  const detail = normalizeActivityResponse(activityId, data);

  // ถ้าเป็น course และยังไม่มี modules ให้ retry ด้วย ?prefer=course
  if (detail.activity_type === "course" && !detail.course_info?.modules?.length) {
    try {
      const res2 = await fetch(`/api/organization/activity/${activityId}?prefer=course`, {
        cache: "no-store",
      });
      const data2 = await res2.json().catch(() => ({}));
      if (res2.ok) return normalizeActivityResponse(activityId, data2);
    } catch {}
  }

  return detail;
}


async function fetchActivityParticipants(activityId: string): Promise<ParticipantItem[]> {
  const res = await fetch(`/api/organization/activity/${activityId}/participants`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json().catch(() => ({}));
  const list = Array.isArray(data?.participants) ? data.participants : [];

  return list.map((p: any, index: number) => ({
    id: String(p.user_id ?? p.id ?? `participant-${index}`),
    name:
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
      p.name ||
      "Unknown",
    bio: p.bio ?? p.about ?? "",
    profileImage:
      p.profile_image ??
      p.avatar ??
      "/images/avatar%20picture/default.png",
    score: Number(p.score ?? p.xp ?? 0),
    status: p.status === "completed" ? "Completed" : "Doing",
  }));
}

async function patchActivityStatus(activityId: string, status: "draft" | "published") {
  const res = await fetch(`/api/organization/activity/${activityId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update status");
  }
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={styles.detailField}>
      <div className={styles.detailLabel}>{label}</div>
      <div className={styles.detailValue}>{value || "-"}</div>
    </div>
  );
}

function CheckInQrPreview({
  value,
  displayCode,
}: {
  value: string;
  displayCode?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, value, {
        width: 118,
        margin: 2,
        color: { dark: "#111111", light: "#ffffff" },
      });
    });
  }, [value]);

  return (
    <div className={styles.qrPreviewBlock}>
      <div className={styles.qrPreviewFrame}>
        <canvas ref={canvasRef} />
      </div>
      <div className={styles.qrCodeText}>{displayCode ?? value}</div>
    </div>
  );
}

function EmptyParticipantPlaceholder() {
  return (
    <div className={styles.emptyParticipantsState}>
      {/* <div className={styles.emptyParticipantsIconWrap}>
        <Image
          src="/images/icons/message03-icon.png"
          alt="No participants"
          width={52}
          height={52}
          className={styles.emptyParticipantsIcon}
        />
      </div> */}

      <div className={styles.emptyParticipantsTitle}>No participants yet</div>

      <div className={styles.emptyParticipantsText}>
        When students register or join this activity, their information,
        attendance progress, and completion status will appear here.
      </div>

      <div className={styles.emptyParticipantsHintBox}>
        <div className={styles.emptyParticipantsHintTitle}>
          Participant data will be shown in this section later
        </div>
        <div className={styles.emptyParticipantsHintText}>
          This area is reserved for participant cards, scores, and activity status.
        </div>
      </div>
    </div>
  );
}

export default function ActivityDashboard() {
  const router = useRouter();
  const params = useParams();
  const activityId = (params?.id as string) ?? (params?.activityId as string) ?? "";

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    registrants: 0,
    doing: 0,
    completed: 0,
    awaitingCheck: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!activityId) {
      setLoadError("Activity ID not found.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [detail, pList, skillsFromRoute] = await Promise.all([
          fetchActivityById(activityId),
          fetchActivityParticipants(activityId),
          fetchActivitySkills(activityId),
        ]);

        if (cancelled) return;

        // prefer skills route (enriched with catalog names), fallback to skills
        // already normalized inside the activity response (course flat format)
        const mergedSkills =
          skillsFromRoute.length > 0
            ? skillsFromRoute
            : detail.skills;

        setActivity({
          ...detail,
          skills: mergedSkills,
        });
        setParticipants(pList);

        const doing = pList.filter((p) => p.status === "Doing").length;
        const completed = pList.filter((p) => p.status === "Completed").length;

        setStats({
          registrants: pList.length,
          doing,
          completed,
          awaitingCheck:
            detail.activity_type === "challenge"
              ? pList.filter((p) => p.status === "Doing").length
              : 0,
        });
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || "Failed to load activity.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activityId]);


  const handleEdit = () => {
    if (!activity) return;

    const typeRouteMap: Record<string, string> = {
      meeting: "meeting",
      course: "course",
      challenge: "challenge",
    };

    const route = typeRouteMap[activity.activity_type] || "meeting";
    router.push(`/organization/activities/${route}?edit=${activityId}`);
  };

  const activitySummaryItems = useMemo(() => {
    return [
      {
        label: "Registrants",
        value: stats.registrants,
        tone: "default",
      },
      {
        label: "Doing activities",
        value: stats.doing,
        tone: "teal",
      },
      {
        label: "Completed",
        value: stats.completed,
        tone: "green",
      },
      {
        label: "Awaiting check",
        value: stats.awaitingCheck,
        note: activity?.activity_type === "challenge" ? "(only challenge)" : "",
        tone: "soft",
      },
    ];
  }, [activity?.activity_type, stats]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingEmoji}>⏳</div>
          <div className={styles.loadingText}>Loading activity...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <strong>Error:</strong> {loadError}
          <button className={styles.errorBackButton} onClick={() => router.back()}>
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  if (!activity) return null;

  const isPublished = activity.status === "published";
  const typeLabel = getActivityTypeLabel(activity.activity_type);

  return (
    <div className={styles.container}>
      <section className={styles.heroCard}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow}>{typeLabel}</div>
          <h1 className={styles.heroTitle}>{activity.activity_name || "Untitled activity"}</h1>

          <div className={styles.descriptionPanel}>
            <div className={styles.descriptionPanelLabel}>Activity description</div>
            <div className={styles.descriptionBox}>
              {activity.activity_detail || "No description provided."}
            </div>
          </div>
        </div>

        <div className={styles.heroActions}>
          <div className={styles.statusToggleCard}>
            <div className={styles.publishStatusRow}>
              <div
                className={`${styles.statusTabBtn} ${!isPublished ? styles.activePublished : ""}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                Draft
              </div>
              <div className={styles.shortVerticalDivider} />
              <div
                className={`${styles.statusTabBtn} ${isPublished ? styles.activePublished : ""}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                Published
              </div>
            </div>

            <div className={styles.horizontalDivider} />

            <div className={styles.activityTypeRow}>
              {(["Meetings", "Courses", "Challenges"] as const).map((type, idx) => (
                <Fragment key={type}>
                  {idx > 0 && <div className={styles.shortVerticalDivider} />}
                  <div
                    className={`${styles.typeTabBtn} ${typeLabel === type ? styles.activeType : ""}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {type}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          <button className={styles.editPrimaryButton} onClick={handleEdit}>
            <Image
              src="/images/icons/button03-noline-icon.png"
              alt="Edit"
              width={50}
              height={50}
            />
            <span>Edit activity</span>
          </button>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        {activitySummaryItems.map((item) => (
          <div
            key={item.label}
            className={`${styles.summaryCard} `}
          >
            {item.note ? <div className={styles.summaryNote}>{item.note}</div> : null}
            <div className={styles.summaryValue}>{item.value}</div>
            <div className={styles.summaryLabel}>{item.label}</div>
          </div>
        ))}
      </section>

      <section className={styles.detailsCard}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionEyebrow}>Activity overview</div>
            <h2 className={styles.sectionTitle}>Summary details</h2>
          </div>
        </div>

        <div className={styles.detailsGrid}>
          <div className={styles.detailGroup}>
            <div className={styles.detailGroupTitle}>Basics</div>
            <DetailField label="Category" value={typeLabel} />
            <DetailField label="Visibility" value={capitalize(activity.visibility)} />
            <DetailField
              label="Join mode"
              value={activity.is_open_ended ? "Join anytime" : "Scheduled participation"}
            />
            <DetailField
              label="Max participants"
              value={activity.max_participants === 0 ? "Unlimited" : activity.max_participants}
            />
          </div>

          <div className={styles.detailGroup}>
            <div className={styles.detailGroupTitle}>Schedule</div>
            <DetailField
              label="Enrollment period"
              value={formatDateTimeRange(activity.enroll_start_at, activity.enroll_end_at)}
            />
            <DetailField
              label="Activity run period"
              value={formatDateTimeRange(activity.run_start_at, activity.run_end_at)}
            />
          </div>

          <div className={styles.detailGroup}>
            <div className={styles.detailGroupTitle}>Reward & outcome</div>
            <DetailField label="Hours / XP" value={activity.hours != null ? `${activity.hours} hrs` : "-"} />

            {activity.activity_type === "meeting" && (
              activity.meeting_info?.qrcode_checkin ? (
                <div className={styles.qrInfoSection}>
                  <div className={styles.qrInfoHeader}>Check-in code</div>
                  <CheckInQrPreview
                    value={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/student/checkin?activity=${activity.activity_id}&code=${encodeURIComponent(activity.meeting_info.qrcode_checkin)}`}
                    displayCode={activity.meeting_info.qrcode_checkin}
                  />
                </div>
              ) : (
                <DetailField label="Check-in code" value="-" />
              )
            )}
          </div>

          <div className={styles.detailGroup}>
            {activity.activity_type === "challenge" ? (
              <>
                <div className={styles.detailGroupTitle}>Challenge details</div>
                <DetailField
                  label="Problem statement"
                  value={activity.challenge_info?.problem_statement || "-"}
                />
                <DetailField
                  label="Goal / Outcome"
                  value={activity.challenge_info?.description || "-"}
                />
                <DetailField
                  label="Level"
                  value={capitalize(activity.challenge_info?.level || "-")}
                />
                <DetailField
                  label="Submission type"
                  value={activity.challenge_info?.submit_type || "-"}
                />
              </>
            ) : activity.activity_type === "course" ? (
              <>
                <div className={styles.detailGroupTitle}>Course details</div>
                <DetailField
                  label="Total modules"
                  value={
                    activity.course_info?.modules != null
                      ? `${activity.course_info.modules.length} modules`
                      : "-"
                  }
                />
                <DetailField
                  label="Total lessons"
                  value={
                    activity.course_info?.modules != null
                      ? String(
                          activity.course_info.modules.reduce(
                            (sum, m) => sum + (m.lessons?.length ?? 0),
                            0
                          )
                        )
                      : "-"
                  }
                />
                <DetailField
                  label="Total quizzes"
                  value={
                    activity.course_info?.modules != null
                      ? String(
                          activity.course_info.modules.reduce(
                            (sum, m) => sum + (m.quizzes?.length ?? 0),
                            0
                          )
                        )
                      : "-"
                  }
                />
                {activity.course_info?.modules && activity.course_info.modules.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #b3b3b3" }}>
                    <div className={styles.detailLabel} style={{ marginBottom: 8 }}>Module breakdown</div>
                    {activity.course_info.modules.map((mod, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 12,
                          color: "#3d3d3d",
                          padding: "5px 0",
                          borderBottom: "1px solid #ececec",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontWeight: 400 }}>
                          {mod.module_name || `Module ${idx + 1}`}
                        </span>
                        <span style={{ color: "#7a726b", flexShrink: 0 }}>
                          {mod.lessons?.length ?? 0} lessons
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.detailGroupTitle}>Meeting details</div>
                <DetailField
                  label="Delivery"
                  value={capitalize(activity.meeting_info?.type || "-")}
                />
                <DetailField
                  label="Location / Link"
                  value={activity.meeting_info?.location || "-"}
                />
                <DetailField
                  label="Speaker / Host"
                  value={
                    activity.meeting_info?.speaker
                      ? `${activity.meeting_info.speaker}${activity.meeting_info?.speaker_position
                        ? ` — ${activity.meeting_info.speaker_position}`
                        : ""
                      }`
                      : "-"
                  }
                />
              </>
            )}
          </div>
        </div>

        <div className={styles.skillsSection}>
          <div className={styles.skillsHeader}>
            <div className={styles.detailGroupTitle}>Skills awarded</div>
            <div className={styles.skillsHint}>Matched with the activity outcome</div>
          </div>

          {activity.skills.length > 0 ? (
            <div className={styles.skillsWrapperBox}>
              {activity.skills.map((skill, index) => {
                const skillKey =
                  skill.id ||
                  `${skill.skill_id || "skill"}-${skill.skill_name || "unnamed"}-${index}`;

                return (
                  <div key={skillKey} className={styles.skillBadgeItem}>
                    <div className={styles.skillNameText}>
                      {skill.skill_name || `Skill ${index + 1}`}
                    </div>
                    <div className={styles.skillLevelText}>
                      {skill.skill_level_label || `Level ${skill.skill_level_value}`}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptySkillsBox}>No skill rewards configured yet.</div>
          )}
        </div>
      </section>

      <section className={styles.participantsListCard}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionEyebrow}>Participants</div>
            <h2 className={styles.sectionTitle}>Activity participant area</h2>
          </div>
        </div>

        {participants.length === 0 ? (
          <EmptyParticipantPlaceholder />
        ) : (
          <div className={styles.scrollContainer}>
            {participants.map((person) => (
              <div key={person.id} className={styles.participantItemRow}>
                <div className={styles.profileWrap}>
                  <Image
                    src={person.profileImage}
                    alt="Avatar"
                    width={54}
                    height={54}
                    className={styles.avatarCircle}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/avatar%20picture/default.png";
                    }}
                  />
                </div>

                <div className={styles.participantMainInfo}>
                  <div className={styles.participantName}>{person.name}</div>
                  <div className={styles.participantBio}>{person.bio || "No participant bio."}</div>
                </div>

                <div className={styles.participantScoreWrap}>
                  <Image src="/images/icons/badge04.png" alt="Badge" width={26} height={26} />
                  <span>{person.score}</span>
                </div>

                <div className={styles.participantStatus}>
                  <div
                    className={`${styles.statusBadgeBase} ${person.status === "Doing" ? styles.statusDoing : styles.statusCompleted
                      }`}
                  >
                    {person.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}