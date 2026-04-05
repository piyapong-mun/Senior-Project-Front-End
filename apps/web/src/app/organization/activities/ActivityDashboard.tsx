"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import styles from "./ActivityDashboard.module.css";

/* =========================
   Types  (ตาม API response จาก GET /activity/org/{org_id})
========================= */
interface SkillItem {
  skill_id: string;
  skill_name: string;
  skill_level: number;
}

interface ActivityDetail {
  activity_id: string;
  activity_name: string;
  activity_type: string; // "meeting" | "course" | "challenge"
  activity_detail: string;
  status: string; // "draft" | "published"
  visibility: string;
  hours: number;
  max_participants: number;
  is_open_ended: boolean;
  enroll_start_at: string;
  enroll_end_at: string;
  run_start_at: string;
  run_end_at: string;
  skills: SkillItem[];
  // Meeting-specific
  meeting_info?: {
    type: string;
    location: string;
    speaker: string;
    speaker_position: string;
    qrcode_checkin: string;
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

/* =========================
   Helpers
========================= */
const SKILL_LEVEL_LABELS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"];

function formatDate(isoString: string) {
  if (!isoString) return "-";
  try {
    return new Date(isoString).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return isoString;
  }
}

function formatDateRange(start: string, end: string) {
  if (!start && !end) return "-";
  return `${formatDate(start)} → ${formatDate(end)}`;
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

/* =========================
   API Route helper
========================= */
async function fetchActivityById(activityId: string): Promise<ActivityDetail> {
  const res = await fetch(`/api/organization/activity/${activityId}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Failed to load activity (${res.status})`);
  // API returns { activity: { commonInfo: {...}, ... } } or flat object depending on endpoint
  // Handle both shapes
  const raw = data?.activity ?? data;
  const info = raw?.commonInfo ?? raw;
  return {
    activity_id: info.activity_id ?? activityId,
    activity_name: info.activity_name ?? "",
    activity_type: info.activity_type ?? "",
    activity_detail: info.activity_detail ?? "",
    status: info.status ?? "draft",
    visibility: info.visibility ?? "public",
    hours: info.activity_hours ?? info.hours ?? 0,
    max_participants: info.activity_max_participants ?? info.max_participants ?? 0,
    is_open_ended: info.is_open_ended ?? false,
    enroll_start_at: info.activity_enroll_start_at ?? info.enroll_start_at ?? "",
    enroll_end_at: info.activity_enroll_end_at ?? info.enroll_end_at ?? "",
    run_start_at: info.activity_start_at ?? info.run_start_at ?? "",
    run_end_at: info.activity_end_at ?? info.run_end_at ?? "",
    skills: Array.isArray(info.skills) ? info.skills : [],
    meeting_info: info.meeting_info,
  };
}

async function fetchActivityParticipants(activityId: string): Promise<ParticipantItem[]> {
  const res = await fetch(`/api/organization/activity/${activityId}/participants`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const list = Array.isArray(data?.participants) ? data.participants : [];
  return list.map((p: any) => ({
    id: p.user_id ?? p.id ?? String(Math.random()),
    name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.name || "Unknown",
    bio: p.bio ?? p.about ?? "",
    profileImage: p.profile_image ?? p.avatar ?? "/images/avatar%20picture/default.png",
    score: p.score ?? p.xp ?? 0,
    status: p.status === "completed" ? "Completed" : "Doing",
  }));
}

async function patchActivityStatus(activityId: string, status: "draft" | "published"): Promise<void> {
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

async function patchActivityType(activityId: string, activityType: string): Promise<void> {
  const res = await fetch(`/api/organization/activity/${activityId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activity_type: activityType }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update activity type");
  }
}

/* =========================
   Main Component
========================= */
export default function ActivityDashboard() {
  const router = useRouter();
  const params = useParams();
  // รองรับทั้ง /organization/activities/[id] หรือ page ที่รับ activityId
  const activityId = (params?.id as string) ?? (params?.activityId as string) ?? "";

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [stats, setStats] = useState<ActivityStats>({ registrants: 0, doing: 0, completed: 0, awaitingCheck: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // UI state
  const [selectedTypeTab, setSelectedTypeTab] = useState<"Meetings" | "Courses" | "Challenges">("Meetings");
  const [isStatusSaving, setIsStatusSaving] = useState(false);

  /* --- Load data --- */
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
        const [detail, pList] = await Promise.all([
          fetchActivityById(activityId),
          fetchActivityParticipants(activityId),
        ]);

        if (cancelled) return;

        setActivity(detail);
        setParticipants(pList);

        // Map type to tab
        const typeLabel = getActivityTypeLabel(detail.activity_type);
        if (typeLabel === "Meetings" || typeLabel === "Courses" || typeLabel === "Challenges") {
          setSelectedTypeTab(typeLabel as any);
        }

        // Compute stats from participants
        const doing = pList.filter((p) => p.status === "Doing").length;
        const completed = pList.filter((p) => p.status === "Completed").length;
        setStats({
          registrants: pList.length,
          doing,
          completed,
          awaitingCheck: detail.activity_type === "challenge" ? pList.filter((p) => p.status === "Doing").length : 0,
        });
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || "Failed to load activity.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [activityId]);

  /* --- Status toggle --- */
  const handleStatusToggle = async (newStatus: "draft" | "published") => {
    if (!activity || isStatusSaving) return;
    if (activity.status === newStatus) return;
    setIsStatusSaving(true);
    try {
      await patchActivityStatus(activityId, newStatus);
      setActivity((prev) => prev ? { ...prev, status: newStatus } : prev);
    } catch (err: any) {
      alert(err?.message || "Failed to update status");
    } finally {
      setIsStatusSaving(false);
    }
  };

  /* --- Navigate to edit page --- */
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

  /* --- Loading / Error States --- */
  if (isLoading) {
    return (
      <div className={styles.container} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ textAlign: "center", color: "#888" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div>Loading activity...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.container}>
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "20px 24px", color: "#b91c1c" }}>
          <strong>Error:</strong> {loadError}
          <br />
          <button
            style={{ marginTop: 12, padding: "8px 16px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
            onClick={() => router.back()}
          >
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
      {/* SECTION 1: TOP STATS & STATUS */}
      <div className={styles.topGrid}>
        {/* Stats card */}
        <div className={styles.participantsStatsCard}>
          <div className={styles.activityTitleHeader}>{activity.activity_name}</div>
          <div className={styles.statsItemsWrapper}>
            <div className={styles.statItemBox}>
              <div className={styles.statItemBg} />
              <div className={styles.statItemLabelWrap}>Registrants</div>
              <div className={styles.statItemValueWrap}>{stats.registrants}</div>
            </div>
            <div className={styles.verticalDivider} />
            <div className={styles.statItemBox}>
              <div className={styles.statItemBg} />
              <div className={styles.statItemLabelWrap}>Doing activities</div>
              <div className={styles.statItemValueWrap}>{stats.doing}</div>
            </div>
            <div className={styles.verticalDivider} />
            <div className={styles.statItemBox}>
              <div className={styles.statItemBg} />
              <div className={styles.statItemLabelWrap}>Completed</div>
              <div className={styles.statItemValueWrap}>{stats.completed}</div>
            </div>
            <div className={styles.verticalDivider} />
            <div className={styles.statItemBox}>
              <div className={styles.statItemBg} />
              <div className={styles.statSubLabelNote}>(only challenge)</div>
              <div className={styles.statItemLabelWrap}>Awaiting check</div>
              <div className={styles.statValueWithNote}>{stats.awaitingCheck}</div>
            </div>
          </div>
        </div>

        {/* Status & Type toggle */}
        <div className={styles.statusToggleCard}>
          <div className={styles.publishStatusRow}>
            <button
              className={`${styles.statusTabBtn} ${!isPublished ? styles.activePublished : ""}`}
              onClick={() => handleStatusToggle("draft")}
              disabled={isStatusSaving}
            >
              Draft
            </button>
            <div className={styles.shortVerticalDivider} />
            <button
              className={`${styles.statusTabBtn} ${isPublished ? styles.activePublished : ""}`}
              onClick={() => handleStatusToggle("published")}
              disabled={isStatusSaving}
            >
              Published
            </button>
          </div>
          <div className={styles.horizontalDivider} />
          <div className={styles.activityTypeRow}>
            {(["Meetings", "Courses", "Challenges"] as const).map((type, idx) => (
              <Fragment key={type}>
                {idx > 0 && <div className={styles.shortVerticalDivider} />}
                <button
                  className={`${styles.typeTabBtn} ${selectedTypeTab === type ? styles.activeType : ""}`}
                  onClick={() => setSelectedTypeTab(type)}
                >
                  {type}
                </button>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: ACTIVITY DETAILS */}
      <section className={styles.detailsCard}>
        <div className={styles.detailsHeader}>
          <p className={styles.descriptionText}>{activity.activity_detail || "No description provided."}</p>
          <button className={styles.editIconButton} onClick={handleEdit} title="Edit activity">
            <Image src="/images/icons/button03-icon.png" alt="Edit" width={40} height={34} />
          </button>
        </div>

        <div className={styles.horizontalDivider} />

        <div className={styles.metaGrid}>
          <div>
            <span className={styles.metaLabel}>Category: </span>
            <span className={styles.metaValue}>{typeLabel}</span><br />
            <span className={styles.metaLabel}>XP / Hours: </span>
            <span className={styles.metaValue}>{activity.hours}</span><br />
            <span className={styles.metaLabel}>Max Participants: </span>
            <span className={styles.metaValue}>{activity.max_participants === 0 ? "Unlimited" : activity.max_participants}</span><br />
            <span className={styles.metaLabel}>Visibility: </span>
            <span className={styles.metaValue}>{capitalize(activity.visibility)}</span><br />
            <span className={styles.metaLabel}>Join Mode: </span>
            <span className={styles.metaValue}>{activity.is_open_ended ? "Join Anytime" : "Scheduled"}</span>
          </div>

          <div>
            <span className={styles.metaLabel}>Enrollment: </span>
            <span className={styles.metaValue}>{formatDateRange(activity.enroll_start_at, activity.enroll_end_at)}</span><br />
            <span className={styles.metaLabel}>Activity Run: </span>
            <span className={styles.metaValue}>{formatDateRange(activity.run_start_at, activity.run_end_at)}</span>

            {/* Meeting-specific info */}
            {activity.meeting_info && (
              <>
                <br />
                <span className={styles.metaLabel}>Location: </span>
                <span className={styles.metaValue}>{activity.meeting_info.location || "-"}</span><br />
                {activity.meeting_info.speaker && (
                  <>
                    <span className={styles.metaLabel}>Speaker: </span>
                    <span className={styles.metaValue}>{activity.meeting_info.speaker}</span>
                    {activity.meeting_info.speaker_position && (
                      <span className={styles.metaValue}> — {activity.meeting_info.speaker_position}</span>
                    )}
                    <br />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Skills */}
        {activity.skills.length > 0 && (
          <div className={styles.skillsContainer}>
            <span className={styles.skillsSectionLabel}>Skills</span>
            <div className={styles.skillsWrapperBox}>
              {activity.skills.map((skill) => (
                <div key={skill.skill_id} className={styles.skillBadgeItem}>
                  <div className={styles.skillNameText}>{skill.skill_name}</div>
                  <div className={styles.skillLevelText}>({SKILL_LEVEL_LABELS[skill.skill_level] ?? `Level ${skill.skill_level}`})</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: PARTICIPANTS LIST */}
      <section className={styles.participantsListCard}>
        {participants.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 14 }}>
            No participants yet.
          </div>
        ) : (
          <div className={styles.scrollContainer}>
            {participants.map((person) => (
              <div key={person.id} className={styles.participantItemRow}>
                <div className={styles.profileWrap}>
                  <Image
                    src={person.profileImage}
                    alt="Avatar"
                    width={50}
                    height={50}
                    className={styles.avatarCircle}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/images/avatar%20picture/default.png"; }}
                  />
                </div>
                <div className={styles.participantMainInfo}>
                  <div className={styles.participantName}>{person.name}</div>
                  <div className={styles.participantBio}>{person.bio}</div>
                </div>
                <div className={styles.participantScoreWrap}>
                  <Image src="/images/icons/badge04.png" alt="Badge" width={30} height={30} />
                  <span>{person.score}</span>
                </div>
                <div className={styles.participantStatus}>
                  <div className={`${styles.statusBadgeBase} ${person.status === "Doing" ? styles.statusDoing : styles.statusCompleted}`}>
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
