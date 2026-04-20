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
  std_id: string;
  name: string;
  bio: string;
  profileImage: string;
  score: number;
  level: number;
  status: "Doing" | "Completed";
}

const LEVEL_BADGES = [
  "/images/icons/badge01.png",
  "/images/icons/badge02.png",
  "/images/icons/badge03.png",
  "/images/icons/badge04.png",
  "/images/icons/badge05.png",
];

function getLevelBadgeSrc(level: number): string {
  const badgeThresholds = [1, 3, 5, 10, 16];
  const filledMedals = badgeThresholds.filter((lv) => level >= lv).length;
  const index = filledMedals > 0 ? Math.min(filledMedals - 1, LEVEL_BADGES.length - 1) : -1;
  return index >= 0 ? LEVEL_BADGES[index] : "/images/icons/badge01-icon.png";
}

interface ChallengeReviewData {
  submissionId: string;
  stdId: string;
  submittedAt: string;
  status: string;
  note: string;
  score: number;
  xp: number;
  level: string;
  feedback: string;
  reviewerId: string;
  skills: Array<{
    skill_name: string;
    level: string;
  }>;
  artifact:
  | {
    type: "file" | "checkin" | "quiz" | "raw";
    url: string;
    label: string;
    payload: any;
  }
  | null;
}

interface ActivityStats {
  registrants: number;
  doing: number;
  completed: number;
  awaitingCheck: number;
}

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
    skill?.skill_name ?? skill?.skillName ?? skill?.SkillName ?? skill?.name ?? ""
  ).trim();
}

function parseDateTimeParts(isoString: string): { date: string; time: string } {
  if (!isoString) return { date: "-", time: "-" };

  try {
    const local = isoString.replace(/([+-]\d{2}:\d{2}|Z)$/, "");
    const [datePart, timePart] = local.split("T");
    if (!datePart) return { date: isoString, time: "-" };

    const [year, month, day] = datePart.split("-").map(Number);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const dateStr = `${String(day).padStart(2, "0")} ${months[(month ?? 1) - 1] ?? "?"} ${year}`;
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
    raw?.meeting_info ??
    raw?.meetingInfo ??
    info?.meeting_info ??
    info?.meetingInfo;

  const challengeInfoWrapped =
    raw?.challenge_info ??
    raw?.challengeInfo ??
    raw?.challenge ??
    info?.challenge_info ??
    info?.challengeInfo ??
    info?.challenge;

  const challengeInfo =
    challengeInfoWrapped ??
    (raw?.problem_statement != null ||
      info?.problem_statement != null ||
      raw?.level != null ||
      info?.level != null
      ? {
        problem_statement: raw?.problem_statement ?? info?.problem_statement,
        description:
          raw?.goal_expected_outcome ??
          raw?.goal ??
          info?.goal_expected_outcome ??
          info?.goal,
        level: raw?.level ?? info?.level,
        submit_type:
          raw?.submit_type ??
          raw?.submission_requirements ??
          info?.submit_type ??
          info?.submission_requirements,
      }
      : null);

  const courseInfoWrapped =
    raw?.course_info ?? raw?.courseInfo ?? info?.course_info ?? info?.courseInfo;

  const detectedType = String(info?.activity_type ?? raw?.activity_type ?? "").toLowerCase();
  const rawModules = courseInfoWrapped?.modules ?? raw?.modules ?? info?.modules;
  const isCourse =
    detectedType === "course" ||
    !!raw?.course_id ||
    !!raw?.course_name ||
    Array.isArray(rawModules);

  function normalizeModules(modules: any[]): ActivityDetail["course_info"] {
    return {
      modules: modules.map((moduleItem: any) => ({
        module_name: String(moduleItem?.module_name ?? moduleItem?.name ?? ""),
        description: String(moduleItem?.description ?? ""),
        lessons: Array.isArray(moduleItem?.lessons)
          ? moduleItem.lessons.map((lesson: any) => ({
            title: String(lesson?.title ?? ""),
            type: String(lesson?.type ?? ""),
            data: String(lesson?.data ?? ""),
          }))
          : [],
        quizzes: Array.isArray(moduleItem?.quizzes) ? moduleItem.quizzes : [],
      })),
    };
  }

  const courseInfo: ActivityDetail["course_info"] =
    isCourse && Array.isArray(rawModules) && rawModules.length > 0
      ? normalizeModules(rawModules)
      : isCourse
        ? { modules: [] }
        : undefined;

  const rawSkills: any[] = Array.isArray(raw?.skills)
    ? raw.skills
    : Array.isArray(info?.skills)
      ? info.skills
      : [];

  const skillLevelLabels = [
    "Remembering",
    "Understanding",
    "Applying",
    "Analyzing",
    "Evaluating",
    "Creating",
  ];

  const skills: SkillItem[] = rawSkills.map((skill: any, index: number) => {
    const skillId = normalizeSkillId(skill, `skill-${index}`);
    const levelRaw =
      skill?.Level ?? skill?.level ?? skill?.skill_level ?? skill?.skillLevel ?? 0;
    const levelValue = Number.isFinite(Number(levelRaw)) ? Number(levelRaw) : 0;

    return {
      id: skill?.id ?? skill?.ID ?? `skill-${skillId}-${index}`,
      skill_id: skillId,
      skill_name: normalizeSkillName(skill),
      skill_category: String(skill?.skill_category ?? skill?.skillCategory ?? ""),
      skill_level_value: levelValue,
      skill_level_label: skillLevelLabels[levelValue] ?? skillLevelLabels[0],
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
      info?.activity_status ??
      info?.status ??
      raw?.activity_status ??
      raw?.status ??
      "draft"
    ),
    visibility: String(
      info?.activity_visibility ??
      info?.visibility ??
      raw?.activity_visibility ??
      raw?.visibility ??
      "public"
    ),
    hours: Number(info?.activity_hours ?? info?.hours ?? raw?.activity_hours ?? raw?.hours ?? 0),
    max_participants: Number(
      info?.activity_max_participants ??
      info?.max_participants ??
      raw?.activity_max_participants ??
      raw?.max_participants ??
      0
    ),
    is_open_ended: Boolean(info?.is_open_ended ?? raw?.is_open_ended ?? false),
    enroll_start_at:
      info?.activity_enroll_start_at ??
      info?.enroll_start_at ??
      raw?.activity_enroll_start_at ??
      raw?.enroll_start_at ??
      raw?.enroll_start ??
      "",
    enroll_end_at:
      info?.activity_enroll_end_at ??
      info?.enroll_end_at ??
      raw?.activity_enroll_end_at ??
      raw?.enroll_end_at ??
      raw?.enroll_end ??
      "",
    run_start_at:
      info?.activity_start_at ??
      info?.run_start_at ??
      raw?.activity_start_at ??
      raw?.run_start_at ??
      raw?.start_at ??
      "",
    run_end_at:
      info?.activity_end_at ??
      info?.run_end_at ??
      raw?.activity_end_at ??
      raw?.run_end_at ??
      raw?.end_at ??
      "",
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
  const res = await fetch(`/api/organization/activity/${activityId}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || `Failed to load activity (${res.status})`);
  }

  const detail = normalizeActivityResponse(activityId, data);

  if (detail.activity_type === "course" && !detail.course_info?.modules?.length) {
    try {
      const res2 = await fetch(`/api/organization/activity/${activityId}?prefer=course`, {
        cache: "no-store",
      });
      const data2 = await res2.json().catch(() => ({}));
      if (res2.ok) return normalizeActivityResponse(activityId, data2);
    } catch { }
  }

  return detail;
}

const ASSETS_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_ASSETS_PUBLIC_BASE ||
  process.env.NEXT_PUBLIC_ASSETS_BASE ||
  "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com";

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function firstNonEmptyValue(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "object") {
      if (typeof value?.url === "string" && value.url.trim()) return value.url.trim();
      if (typeof value?.path === "string" && value.path.trim()) return value.path.trim();
    }
  }

  return "";
}

function resolveParticipantImage(value: any): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (isUuidLike(raw)) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("s3://")) {
    const withoutScheme = raw.replace("s3://", "");
    const slashIndex = withoutScheme.indexOf("/");
    const key = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
    return key && ASSETS_PUBLIC_BASE ? joinUrl(ASSETS_PUBLIC_BASE, key) : "";
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  if (
    raw.startsWith("student-profiles/") ||
    raw.startsWith("student-files/") ||
    raw.startsWith("employee-avatars/") ||
    raw.startsWith("student-avatars/") ||
    raw.startsWith("organization-logos/")
  ) {
    return joinUrl(ASSETS_PUBLIC_BASE, raw);
  }

  if (ASSETS_PUBLIC_BASE) {
    return joinUrl(ASSETS_PUBLIC_BASE, raw);
  }

  return raw;
}

function normalizeParticipantStatus(value: any): "Doing" | "Completed" {
  const status = String(value ?? "").trim().toLowerCase();

  if (
    [
      "completed",
      "complete",
      "done",
      "verified",
      "passed",
      "attendance complete",
      "attendance_complete",
      "checked-in complete",
      "checkin_complete",
    ].includes(status)
  ) {
    return "Completed";
  }

  return "Doing";
}

function resolveParticipantStatus(participant: any): "Doing" | "Completed" {
  const rawStatus = firstNonEmptyValue(
    participant?.submission_status,
    participant?.latest_submission?.status,
    participant?.submission?.status,
    participant?.participant_submission?.status,
    participant?.participant_submissions?.submission_status,
    participant?.participant_submissions?.status,
    participant?.participant_info?.participant_status,
    participant?.participant_info?.status,
    participant?.status,
    participant?.registration_status
  );

  return normalizeParticipantStatus(rawStatus);
}

function resolveParticipantScore(participant: any): number {
  const value = firstNonEmptyValue(
    participant?.score,
    participant?.current_xp,
    participant?.current_exp,
    participant?.xp,
    participant?.student?.current_xp,
    participant?.student?.current_exp,
    participant?.student?.xp,
    participant?.student?.score
  );

  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolveParticipantLevel(participant: any): number {
  const value = firstNonEmptyValue(
    participant?.level,
    participant?.current_level,
    participant?.student?.level,
    participant?.student?.current_level,
    participant?.participant_info?.level
  );
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolveParticipantName(participant: any): string {
  return (
    firstNonEmptyValue(
      `${participant?.first_name ?? ""} ${participant?.last_name ?? ""}`.trim(),
      `${participant?.participant_info?.participant_name ?? ""}`.trim(),
      `${participant?.student?.first_name ?? ""} ${participant?.student?.last_name ?? ""}`.trim(),
      participant?.name
    ) || "Unknown"
  );
}

function resolveParticipantBio(participant: any): string {
  return String(
    firstNonEmptyValue(
      participant?.bio,
      participant?.about,
      participant?.student?.bio,
      participant?.student?.about,
      participant?.participant_info?.participant_faculty &&
        participant?.participant_info?.participant_university
        ? `${participant.participant_info.participant_faculty} • ${participant.participant_info.participant_university}`
        : "",
      participant?.faculty && participant?.university
        ? `${participant.faculty} • ${participant.university}`
        : ""
    ) || ""
  ).trim();
}

function resolveParticipantProfileImage(participant: any): string {
  const imageValue = firstNonEmptyValue(
    participant?.profile_image_url,
    participant?.profile_image,
    participant?.student?.profile_image_url,
    participant?.student?.profile_image,
    participant?.participant_info?.profile_image_url,
    participant?.participant_info?.participant_avatar,
    participant?.avatar_url,
    participant?.avatar,
    !isUuidLike(String(participant?.avatar_choice ?? ""))
      ? participant?.avatar_choice
      : ""
  );

  return resolveParticipantImage(imageValue);
}

async function fetchActiveReviewerId(): Promise<string> {
  try {
    const res = await fetch("/api/organization/active-account", {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return "";
    return String(data?.userId ?? data?.user_id ?? "").trim();
  } catch {
    return "";
  }
}

async function fetchChallengeReview(
  activityId: string,
  stdId: string
): Promise<ChallengeReviewData | null> {
  const res = await fetch(
    `/api/organization/activity/${activityId}/challenge-review/${stdId}`,
    {
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const data = await res.json().catch(() => ({}));
  return data?.review ?? null;
}

async function submitChallengeReviewFeedback(
  activityId: string,
  stdId: string,
  payload: {
    submission_id: string;
    std_id: string;
    feedback: string;
    status: boolean;
  }
) {
  const res = await fetch(
    `/api/organization/activity/${activityId}/challenge-review/${stdId}/feedback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.ok) {
    const extra = [
      data?.message,
      data?.backend_status ? `backend status: ${data.backend_status}` : "",
      data?.backend_body?.message || data?.backend_body?.detail || "",
    ]
      .filter(Boolean)
      .join(" | ");

    throw new Error(extra || "Failed to submit review feedback");
  }

  return data?.result ?? {};
}

async function fetchStudentLevel(stdId: string): Promise<number> {
  if (!stdId) return 0;
  try {
    const res = await fetch(`/api/organization/student/${stdId}`, { cache: "no-store" });
    if (!res.ok) return 0;
    const data = await res.json().catch(() => ({}));
    const level = Number(data?.level ?? data?.data?.level ?? 0);
    return Number.isFinite(level) ? level : 0;
  } catch {
    return 0;
  }
}

async function fetchActivityParticipants(
  activityId: string
): Promise<ParticipantItem[]> {
  const res = await fetch(`/api/organization/activity/${activityId}/participants`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json().catch(() => ({}));
  const list = Array.isArray(data?.participants) ? data.participants : [];

  const baseItems: ParticipantItem[] = list.map(
    (participant: any, index: number): ParticipantItem => ({
    id: String(
      participant?.user_id ??
        participant?.id ??
        participant?.std_id ??
        participant?.student?.std_id ??
        `participant-${index}`
    ),
    std_id: String(
      participant?.std_id ??
        participant?.StdID ??
        participant?.student?.std_id ??
        participant?.participant_info?.participant_id ??
        ""
    ).trim(),
    name: resolveParticipantName(participant),
    bio: resolveParticipantBio(participant),
    profileImage: resolveParticipantProfileImage(participant),
    score: resolveParticipantScore(participant),
    level: resolveParticipantLevel(participant),
    status: resolveParticipantStatus(participant),
    })
  );

  // enrich level from /api/organization/student/{std_id} where level is 0
  const enriched = await Promise.all(
    baseItems.map(async (item) => {
      if (item.level === 0 && item.std_id) {
        const fetched = await fetchStudentLevel(item.std_id);
        return { ...item, level: fetched };
      }
      return item;
    })
  );

  return enriched;
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

function ChallengeReviewModal({
  open,
  participant,
  review,
  isLoading,
  isSaving,
  error,
  feedbackText,
  onFeedbackChange,
  onClose,
  onApprove,
}: {
  open: boolean;
  participant: ParticipantItem | null;
  review: ChallengeReviewData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
  feedbackText: string;
  onFeedbackChange: (value: string) => void;
  onClose: () => void;
  onApprove: () => void;
}) {
  if (!open || !participant) return null;

  return (
    <div className={styles.reviewOverlay} onClick={onClose}>
      <div
        className={styles.reviewCard}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.reviewHeader}>
          <div className={styles.reviewTitleWrap}>
            <div className={styles.sectionEyebrow}>Challenge review</div>
            <h3 className={styles.reviewTitle}>{participant.name}</h3>
            <div className={styles.reviewSubtitle}>
              {participant.std_id || "No student id"}
            </div>
          </div>

          <button
            type="button"
            className={styles.reviewSecondaryButton}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {isLoading ? (
          <div className={styles.reviewLoadingState}>Loading submission...</div>
        ) : error ? (
          <div className={styles.reviewErrorState}>{error}</div>
        ) : !review ? (
          <div className={styles.reviewEmptyState}>
            No challenge submission found for this participant yet.
          </div>
        ) : (
          <>
            <div className={styles.reviewGrid}>
              <div className={styles.reviewPanel}>
                <div className={styles.reviewPanelTitle}>Submission info</div>
                <DetailField label="Submitted at" value={review.submittedAt || "-"} />
                <DetailField label="Status" value={review.status || "-"} />
                <DetailField label="Score" value={review.score} />
                <DetailField label="XP" value={review.xp} />
                <DetailField label="Level" value={review.level || "-"} />
              </div>

              <div className={styles.reviewPanel}>
                <div className={styles.reviewPanelTitle}>Student submission</div>

                <div className={styles.reviewArtifactBox}>
                  {review.artifact?.type === "file" && review.artifact.url ? (
                    <a
                      href={review.artifact.url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.reviewOpenLink}
                    >
                      Open attached file
                    </a>
                  ) : review.artifact?.type === "checkin" ? (
                    <div className={styles.reviewCodeBox}>{review.artifact.label}</div>
                  ) : review.artifact?.type === "quiz" ? (
                    <pre className={styles.reviewJsonBox}>
                      {JSON.stringify(review.artifact.payload, null, 2)}
                    </pre>
                  ) : review.artifact?.type === "raw" ? (
                    <pre className={styles.reviewJsonBox}>
                      {JSON.stringify(review.artifact.payload, null, 2)}
                    </pre>
                  ) : (
                    <div className={styles.reviewEmptyMini}>No submission artifact.</div>
                  )}
                </div>

                <div className={styles.reviewNoteBox}>
                  {review.note || "No note from student."}
                </div>

                {review.skills.length > 0 && (
                  <div className={styles.reviewSkillList}>
                    {review.skills.map((skill, index) => (
                      <div
                        key={`${skill.skill_name}-${index}`}
                        className={styles.reviewSkillChip}
                      >
                        {skill.skill_name}
                        {skill.level ? ` • Level ${skill.level}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.reviewFooter}>
              <label className={styles.reviewTextareaLabel}>Feedback</label>
              <textarea
                className={styles.reviewTextarea}
                value={feedbackText}
                onChange={(event) => onFeedbackChange(event.target.value)}
                placeholder="Write feedback for this submission..."
              />

              <div className={styles.reviewActionRow}>
                <button
                  type="button"
                  className={styles.reviewSecondaryButton}
                  onClick={onClose}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={styles.reviewPrimaryButton}
                  onClick={onApprove}
                  disabled={isSaving || !review.submissionId}
                >
                  {isSaving ? "Saving..." : "Save feedback & approve"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ActivityDashboard() {
  const router = useRouter();
  const params = useParams();
  const activityId = ((params?.id as string) ?? (params?.activityId as string) ?? "") as string;

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
  const [selectedParticipant, setSelectedParticipant] =
    useState<ParticipantItem | null>(null);
  const [reviewData, setReviewData] = useState<ChallengeReviewData | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [reviewerId, setReviewerId] = useState("");

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
        const [detail, participantList, skillsFromRoute] = await Promise.all([
          fetchActivityById(activityId),
          fetchActivityParticipants(activityId),
          fetchActivitySkills(activityId),
        ]);

        if (cancelled) return;

        const mergedSkills = skillsFromRoute.length > 0 ? skillsFromRoute : detail.skills;

        setActivity({
          ...detail,
          skills: mergedSkills,
        });
        setParticipants(participantList);

        const doing = participantList.filter((item) => item.status === "Doing").length;
        const completed = participantList.filter((item) => item.status === "Completed").length;

        setStats({
          registrants: participantList.length,
          doing,
          completed,
          awaitingCheck:
            detail.activity_type === "challenge"
              ? participantList.filter((item) => item.status === "Doing").length
              : 0,
        });
      } catch (error: any) {
        if (!cancelled) {
          setLoadError(error?.message || "Failed to load activity.");
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

  useEffect(() => {
    let cancelled = false;

    fetchActiveReviewerId().then((id) => {
      if (!cancelled) setReviewerId(id);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleOpenChallengeReview = async (person: ParticipantItem) => {
    if (activity?.activity_type !== "challenge" || !person.std_id) return;

    setSelectedParticipant(person);
    setIsReviewOpen(true);
    setIsReviewLoading(true);
    setReviewError("");
    setReviewData(null);
    setFeedbackText("");

    try {
      const review = await fetchChallengeReview(activityId, person.std_id);
      setReviewData(review);
      setFeedbackText(review?.feedback || "");
      if (review?.reviewerId && !reviewerId) {
        setReviewerId(review.reviewerId);
      }
    } catch (error: any) {
      setReviewError(error?.message || "Failed to load challenge submission.");
    } finally {
      setIsReviewLoading(false);
    }
  };

  const handleCloseChallengeReview = () => {
    setIsReviewOpen(false);
    setSelectedParticipant(null);
    setReviewData(null);
    setReviewError("");
    setFeedbackText("");
  };

  const handleApproveChallengeReview = async () => {
    if (!selectedParticipant?.std_id || !reviewData?.submissionId) return;

    setIsSavingReview(true);
    setReviewError("");

    try {
      const result = await submitChallengeReviewFeedback(
        activityId,
        selectedParticipant.std_id,
        {
          submission_id: reviewData.submissionId,
          std_id: selectedParticipant.std_id,
          feedback: feedbackText,
          status: true,
        }
      );


      const nextXp = Number(result?.xp ?? reviewData.xp ?? 0);

      setParticipants((previous) =>
        previous.map((item) =>
          item.id === selectedParticipant.id
            ? {
              ...item,
              status: "Completed",
              score: nextXp || item.score,
            }
            : item
        )
      );

      setStats((previous) => ({
        ...previous,
        doing: Math.max(0, previous.doing - 1),
        completed: previous.completed + 1,
        awaitingCheck: Math.max(0, previous.awaitingCheck - 1),
      }));

      setReviewData((previous) =>
        previous
          ? {
            ...previous,
            feedback: feedbackText,
            status: "Completed",
            xp: nextXp || previous.xp,
          }
          : previous
      );
    } catch (error: any) {
      setReviewError(error?.message || "Failed to submit feedback.");
    } finally {
      setIsSavingReview(false);
    }
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
          <div key={item.label} className={styles.summaryCard}>
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

            {activity.activity_type === "meeting" &&
              (activity.meeting_info?.qrcode_checkin ? (
                <div className={styles.qrInfoSection}>
                  <div className={styles.qrInfoHeader}>Check-in code</div>
                  <CheckInQrPreview
                    value={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/student/checkin?activity=${activity.activity_id}&code=${encodeURIComponent(activity.meeting_info.qrcode_checkin)}`}
                    displayCode={activity.meeting_info.qrcode_checkin}
                  />
                </div>
              ) : (
                <DetailField label="Check-in code" value="-" />
              ))}
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
                <DetailField label="Level" value={capitalize(activity.challenge_info?.level || "-")} />
                <DetailField label="Submission type" value={activity.challenge_info?.submit_type || "-"} />
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
                          (sum, moduleItem) => sum + (moduleItem.lessons?.length ?? 0),
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
                          (sum, moduleItem) => sum + (moduleItem.quizzes?.length ?? 0),
                          0
                        )
                      )
                      : "-"
                  }
                />
                {activity.course_info?.modules && activity.course_info.modules.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #b3b3b3" }}>
                    <div className={styles.detailLabel} style={{ marginBottom: 8 }}>
                      Module breakdown
                    </div>
                    {activity.course_info.modules.map((moduleItem, idx) => (
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
                          {moduleItem.module_name || `Module ${idx + 1}`}
                        </span>
                        <span style={{ color: "#7a726b", flexShrink: 0 }}>
                          {moduleItem.lessons?.length ?? 0} lessons
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.detailGroupTitle}>Meeting details</div>
                <DetailField label="Delivery" value={capitalize(activity.meeting_info?.type || "-")} />
                <DetailField label="Location / Link" value={activity.meeting_info?.location || "-"} />
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
                  skill.id || `${skill.skill_id || "skill"}-${skill.skill_name || "unnamed"}-${index}`;

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
            {participants.map((person) => {
              const isChallengeClickable =
                activity.activity_type === "challenge" && !!person.std_id;

              const content = (
                <>
                  <div className={styles.profileWrap}>
                    {person.profileImage ? (
                      <img
                        src={person.profileImage}
                        alt={person.name || "Avatar"}
                        width={54}
                        height={54}
                        className={styles.avatarCircle}
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          const next = event.currentTarget.nextElementSibling as HTMLElement | null;
                          if (next) next.style.display = "block";
                        }}
                      />
                    ) : null}

                    <div
                      className={styles.avatarFallback}
                      style={{ display: person.profileImage ? "none" : "flex" }}
                      aria-label="No avatar"
                    />
                  </div>

                  <div className={styles.participantMainInfo}>
                    <div className={styles.participantName}>{person.name}</div>
                    <div className={styles.participantBio}>{person.bio || "No participant bio."}</div>
                  </div>

                  <div className={styles.participantScoreWrap}>
                    <Image
                      src={getLevelBadgeSrc(person.level)}
                      alt={`Level ${person.level}`}
                      width={45}
                      height={45}
                    />
                    <span>Lv.{person.level}</span>
                  </div>

                  <div className={styles.participantStatus}>
                    <div
                      className={`${styles.statusBadgeBase} ${person.status === "Doing" ? styles.statusDoing : styles.statusCompleted
                        }`}
                    >
                      {person.status}
                    </div>
                  </div>
                </>
              );

              return isChallengeClickable ? (
                <button
                  key={person.id}
                  type="button"
                  className={`${styles.participantItemRow} ${styles.clickableParticipantRow}`}
                  onClick={() => handleOpenChallengeReview(person)}
                >
                  {content}
                </button>
              ) : (
                <div key={person.id} className={styles.participantItemRow}>
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ChallengeReviewModal
        open={isReviewOpen}
        participant={selectedParticipant}
        review={reviewData}
        isLoading={isReviewLoading}
        isSaving={isSavingReview}
        error={reviewError}
        feedbackText={feedbackText}
        onFeedbackChange={setFeedbackText}
        onClose={handleCloseChallengeReview}
        onApprove={handleApproveChallengeReview}
      />
    </div>
  );
}
