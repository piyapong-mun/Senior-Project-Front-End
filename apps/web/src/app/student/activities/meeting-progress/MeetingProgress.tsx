"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type RewardSkillItem = {
  id: string;
  skillName: string;
  level: string;
  percentText: string;
};

type MeetingStatus = "complete" | "incomplete";

function formatDate(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
}

function formatDateTime(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleDateString("en-GB")} ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatTime(value: any) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function normalizeAgenda(raw: any): string[] {
  const list = toArray(raw);

  return list
    .map((item: any) => {
      if (typeof item === "string") return item.trim();
      return String(
        item?.title ??
          item?.name ??
          item?.text ??
          item?.agenda ??
          item?.detail ??
          ""
      ).trim();
    })
    .filter(Boolean);
}

function normalizeRewardSkills(raw: any): RewardSkillItem[] {
  return toArray(raw)
    .map((item: any, index: number) => ({
      id: String(item?.id ?? item?.skill_id ?? `skill-${index}`),
      skillName: String(item?.skillName ?? item?.skill_name ?? "Unknown skill"),
      level: String(item?.level ?? item?.skill_level ?? "—"),
      percentText: String(
        item?.percentText ??
          (item?.percent !== undefined && item?.percent !== null
            ? `${item.percent}%`
            : "—")
      ),
    }))
    .filter((item: RewardSkillItem) => item.skillName.trim().length > 0);
}

function getStatusKey(status: string): MeetingStatus {
  const s = status.toLowerCase();
  if (s === "complete" || s === "completed") return "complete";
  return "incomplete";
}

function StatusPill({ status }: { status: MeetingStatus }) {
  return (
    <span
      className={`${styles.statusPill} ${
        status === "complete" ? styles.statusComplete : styles.statusIncomplete
      }`}
    >
      {status === "complete" ? "Complete" : "Incomplete"}
    </span>
  );
}

function QrPreview({
  qrUrl,
  qrValue,
  blur,
}: {
  qrUrl: string;
  qrValue: string;
  blur: boolean;
}) {
  return (
    <div className={styles.qrCard}>
      <div className={styles.qrFrame}>
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="Meeting QR Code"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "contain",
              filter: blur ? "blur(10px)" : "none",
              transition: "filter 0.3s ease",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "rgba(0,0,0,0.5)",
              textAlign: "center",
            }}
          >
            QR unavailable
          </div>
        )}
      </div>

      <div className={styles.qrLabel}>Meeting QR Code</div>
      <div className={styles.qrValue}>{qrValue || "—"}</div>
    </div>
  );
}

function MeetingProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId");

  const [meeting, setMeeting] = useState<any>(null);
  const [qrOrigin, setQrOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQrOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    async function fetchActivity() {
      if (!activityId) {
        setError("Activity ID not found");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/student/meeting?activity_id=${activityId}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || "Failed to load meeting");
        }

        setMeeting(json.data);
      } catch (err: any) {
        console.error("Failed to load meeting:", err);
        setError(err?.message || "Failed to load meeting");
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, [activityId]);

  const activity = meeting?.activity ?? {};
  const meetingInfo = meeting?.meeting_info ?? {};
  const submissionInfo = meeting?.submission_info ?? {};
  const orgInfo = meeting?.org_info ?? meeting?.organization_info ?? meeting?.organization ?? {};

  const currentStatus: string =
    submissionInfo?.Status === ""
      ? "In Progress"
      : submissionInfo?.Status || "In Progress";

  const meetingStatus = getStatusKey(currentStatus);
  const isComplete = meetingStatus === "complete";

  const description =
    activity?.Description ||
    meetingInfo?.description ||
    meetingInfo?.meeting_detail ||
    "No description";

  const organizationName =
    orgInfo?.org_name ||
    activity?.OrganizationName ||
    activity?.organization ||
    meetingInfo?.organization ||
    "—";

  const dueDate = activity?.IsOpenEnded
    ? "Open Ended"
    : activity?.RunEndAt
    ? formatDateTime(activity.RunEndAt)
    : "—";

  const startRaw = activity?.RunStartAt || meetingInfo?.start_time || meetingInfo?.StartTime;
  const endRaw = activity?.RunEndAt || meetingInfo?.end_time || meetingInfo?.EndTime;

  const formatValue =
    meetingInfo?.format ||
    meetingInfo?.meeting_format ||
    meetingInfo?.location_type ||
    (meetingInfo?.meeting_link ? "Online" : meetingInfo?.location ? "On-site" : "—");

  const timeRange =
    startRaw && endRaw ? `${formatTime(startRaw)} - ${formatTime(endRaw)}` : "—";

  const speaker =
    meetingInfo?.speaker ||
    meetingInfo?.host ||
    meetingInfo?.presenter ||
    meetingInfo?.moderator ||
    "—";

  const location =
    meetingInfo?.location ||
    meetingInfo?.meeting_link ||
    meetingInfo?.link ||
    activity?.Location ||
    "—";

  const checkedInAt =
    submissionInfo?.SubmittedAt ||
    submissionInfo?.submitted_at ||
    meetingInfo?.checked_in_at ||
    activity?.RunStartAt ||
    "";

  const score = Number(submissionInfo?.Score ?? submissionInfo?.score ?? 0);
  const exp = Number(submissionInfo?.XP ?? submissionInfo?.xp ?? 0);

  const rewardSkills = useMemo(
    () =>
      normalizeRewardSkills(
        meetingInfo?.reward_skills ??
          meetingInfo?.RewardSkills ??
          activity?.reward_skills ??
          meeting?.reward_skills
      ),
    [meetingInfo, activity, meeting]
  );

  const agenda = useMemo(
    () =>
      normalizeAgenda(
        meetingInfo?.agenda ??
          meetingInfo?.Agenda ??
          meetingInfo?.agendas ??
          meetingInfo?.topics
      ),
    [meetingInfo]
  );

  const qrData = String(
    meetingInfo?.qrcode_checkin ??
      meetingInfo?.qrCode ??
      meetingInfo?.qr_code ??
      "checkin"
  );

  const qrTarget = qrOrigin
    ? `${qrOrigin}/student/activities/meeting-submit?activity_id=${activityId || ""}&qrdata=${qrData}`
    : "";

  const qrImageUrl = qrTarget
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        qrTarget
      )}`
    : "";

  const metaItems = [
    { label: "Organization", value: organizationName },
    { label: "Due date", value: dueDate },
    { label: "Type", value: "Meeting" },
    { label: "Format", value: formatValue || "—" },
    { label: "Time", value: timeRange },
    { label: "Status", value: isComplete ? "Complete" : "Incomplete" },
  ];

  if (loading) {
    return <div className={styles.page}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.page}>{error}</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <section className={`${styles.panel} ${styles.summaryPanel}`}>
          <div className={styles.topRow}>
            <div>
              <div className={styles.eyebrow}>Student Activity</div>
              <h1 className={styles.title}>
                {activity?.ActivityName || "Meeting"}
              </h1>
            </div>

            <div className={styles.headerActions}>
              <StatusPill status={meetingStatus} />
              <button className={styles.backButton} onClick={() => router.back()}>
                Back
              </button>
            </div>
          </div>

          <p className={styles.description}>{description}</p>

          <div className={styles.metaGrid}>
            {metaItems.map((item) => (
              <div key={item.label} className={styles.metaCard}>
                <div className={styles.metaLabel}>{item.label}</div>
                <div className={styles.metaValue}>{item.value}</div>
              </div>
            ))}
          </div>

          {rewardSkills.length > 0 && (
            <div className={styles.rewardSkillsSection}>
              <div className={styles.rewardSkillsTitle}>Skills you will receive</div>
              <div className={styles.rewardSkillsList}>
                {rewardSkills.map((skill) => (
                  <div key={skill.id} className={styles.rewardSkillRow}>
                    <div className={styles.rewardSkillName}>{skill.skillName}</div>
                    <div className={styles.rewardSkillLevel}>{skill.level}</div>
                    <div className={styles.rewardSkillPercent}>{skill.percentText}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.previewStateRow}>
            <span className={styles.previewStateLabel}>Preview state</span>
            <div className={styles.previewStateGroup} aria-label="Preview state display only">
              <span
                className={`${styles.previewStateBadge} ${
                  meetingStatus === "incomplete" ? styles.previewStateBadgeActive : ""
                }`}
              >
                Incomplete
              </span>
              <span
                className={`${styles.previewStateBadge} ${
                  meetingStatus === "complete" ? styles.previewStateBadgeActive : ""
                }`}
              >
                Complete
              </span>
            </div>
          </div>

          <div className={styles.previewStateHint}>
            This status updates automatically after attendance has been marked and verified.
          </div>
        </section>

        <section className={`${styles.panel} ${styles.detailPanel}`}>
          <div className={styles.sectionTitle}>Meeting details</div>

          <div className={styles.detailRow}>
            <div className={styles.detailLabel}>Speaker / Host</div>
            <div className={styles.detailValue}>{speaker}</div>
          </div>

          <div className={styles.detailRow}>
            <div className={styles.detailLabel}>Location</div>
            <div className={styles.detailValue}>{location}</div>
          </div>

          {agenda.length > 0 && (
            <>
              <div className={styles.sectionDivider} />
              <div className={styles.sectionTitle}>Agenda</div>
              <ul className={styles.agendaList}>
                {agenda.map((item) => (
                  <li key={item} className={styles.agendaItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className={styles.column}>
        {isComplete ? (
          <section className={`${styles.panel} ${styles.successPanel}`}>
            <div className={styles.successTitle}>Congratulations !!!</div>
            <div className={styles.successMetaRow}>
              <span>Checked in: {formatDate(checkedInAt)}</span>
              <span>Score: {score}</span>
              <span>XP: +{exp}</span>
            </div>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.qrPanel}`}>
          <div className={styles.sectionTitle}>Meeting QR Code</div>

          <QrPreview qrUrl={qrImageUrl} qrValue={qrData} blur={isComplete} />

          <div className={styles.qrHint}>
            Show this QR code at the meeting check-in point or use it to confirm attendance.
          </div>
        </section>

        <section className={`${styles.panel} ${styles.noticePanel}`}>
          <div className={styles.sectionTitle}>Attendance notes</div>

          <div className={styles.noticeCard}>
            <div className={styles.noticeTitle}>Before the meeting</div>
            <div className={styles.noticeText}>
              Arrive 10-15 minutes early, prepare your student ID, and review the meeting topic before joining.
            </div>
          </div>

          <div className={styles.noticeCard}>
            <div className={styles.noticeTitle}>After the meeting</div>
            <div className={styles.noticeText}>
              Wait for attendance confirmation and verification from the organization before the activity status changes.
            </div>
          </div>

          <div className={styles.infoBox}>
            Attendance status cannot be changed manually on this page.
          </div>
        </section>
      </div>
    </div>
  );
}

export default function MeetingProgress() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MeetingProgressContent />
    </Suspense>
  );
}