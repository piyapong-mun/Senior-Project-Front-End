"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import styles from "./page.module.css";

type CheckinState = "loading" | "confirm" | "submitting" | "success" | "error" | "invalid";

interface ActivityInfo {
  activity_name: string;
  activity_type: string;
  hours: number;
  meeting_info?: {
    type: string;
    location: string;
    speaker: string;
    speaker_position: string;
  };
}

function CheckinContent() {
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activity") ?? "";
  const code = searchParams.get("code") ?? "";

  const [state, setState] = useState<CheckinState>("loading");
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");
  const [xpEarned, setXpEarned] = useState(0);

  // ตรวจ params ก่อน
  useEffect(() => {
    if (!activityId || !code) {
      setState("invalid");
      return;
    }
    fetchActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, code]);

  async function fetchActivity() {
    setState("loading");
    try {
      const res = await fetch(`/api/student/activity/${activityId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Activity not found");
      const data = await res.json();
      const raw = data?.activity ?? data ?? {};
      const info = raw?.commonInfo ?? raw?.common_info ?? raw;
      const meetingInfo = raw?.meeting_info ?? raw?.meetingInfo ?? info?.meeting_info ?? info?.meetingInfo;
      setActivity({
        activity_name: String(info?.activity_name ?? raw?.activity_name ?? ""),
        activity_type: String(info?.activity_type ?? raw?.activity_type ?? "meeting"),
        hours: Number(info?.activity_hours ?? info?.hours ?? raw?.hours ?? 0),
        meeting_info: meetingInfo
          ? {
              type: String(meetingInfo?.type ?? ""),
              location: String(meetingInfo?.location ?? ""),
              speaker: String(meetingInfo?.speaker ?? ""),
              speaker_position: String(meetingInfo?.speaker_position ?? ""),
            }
          : undefined,
      });
      setState("confirm");
    } catch {
      setState("invalid");
    }
  }

  async function handleCheckin() {
    setState("submitting");
    try {
      const res = await fetch("/api/student/checkin/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: activityId, qrcode_checkin: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Check-in failed");
      }
      setXpEarned(Number(data?.xp ?? activity?.hours ?? 0));
      setSubmittedAt(new Date().toLocaleString("th-TH"));
      setState("success");
    } catch (err: any) {
      setErrorMsg(err?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setState("error");
    }
  }

  // ── Invalid / missing params ──────────────────────────────
  if (state === "invalid") {
    return (
      <div className={styles.stateCard}>
        <div className={styles.stateIcon}>✕</div>
        <div className={styles.stateTitle}>QR Code ไม่ถูกต้อง</div>
        <div className={styles.stateText}>
          ลิงก์นี้ไม่มีข้อมูลกิจกรรมที่ถูกต้อง กรุณาสแกน QR Code ใหม่อีกครั้ง
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className={styles.stateCard}>
        <div className={styles.loadingSpinner} />
        <div className={styles.stateText}>กำลังโหลดข้อมูลกิจกรรม...</div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className={`${styles.stateCard} ${styles.stateCardSuccess}`}>
        <div className={styles.successIcon}>✓</div>
        <div className={styles.stateTitle}>Check-in สำเร็จ!</div>
        <div className={styles.activityNameSuccess}>{activity?.activity_name}</div>
        <div className={styles.successMeta}>
          <div className={styles.successMetaItem}>
            <span className={styles.successMetaLabel}>เวลา</span>
            <span className={styles.successMetaValue}>{submittedAt}</span>
          </div>
          <div className={styles.successMetaItem}>
            <span className={styles.successMetaLabel}>XP ที่ได้รับ</span>
            <span className={`${styles.successMetaValue} ${styles.xpValue}`}>+{xpEarned} XP</span>
          </div>
        </div>
        <div className={styles.successNote}>
          สถานะกิจกรรมจะอัปเดตโดยอัตโนมัติในระบบ
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className={`${styles.stateCard} ${styles.stateCardError}`}>
        <div className={styles.stateIcon}>✕</div>
        <div className={styles.stateTitle}>Check-in ไม่สำเร็จ</div>
        <div className={styles.stateText}>{errorMsg}</div>
        <button className={styles.retryButton} onClick={() => setState("confirm")}>
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  // ── Confirm ───────────────────────────────────────────────
  const deliveryLabel =
    activity?.meeting_info?.type === "online" ? "Online" :
    activity?.meeting_info?.type === "onsite" ? "Onsite" :
    activity?.meeting_info?.type ?? "-";

  return (
    <div className={styles.confirmCard}>
      <div className={styles.confirmHeader}>
        <div className={styles.confirmEyebrow}>Meeting Check-in</div>
        <div className={styles.confirmActivityName}>{activity?.activity_name ?? "-"}</div>
      </div>

      <div className={styles.confirmDivider} />

      <div className={styles.confirmDetails}>
        {activity?.meeting_info?.location && (
          <div className={styles.confirmDetailRow}>
            <span className={styles.confirmDetailLabel}>Location</span>
            <span className={styles.confirmDetailValue}>{activity.meeting_info.location}</span>
          </div>
        )}
        {activity?.meeting_info?.speaker && (
          <div className={styles.confirmDetailRow}>
            <span className={styles.confirmDetailLabel}>Speaker</span>
            <span className={styles.confirmDetailValue}>
              {activity.meeting_info.speaker}
              {activity.meeting_info.speaker_position
                ? ` — ${activity.meeting_info.speaker_position}`
                : ""}
            </span>
          </div>
        )}
        <div className={styles.confirmDetailRow}>
          <span className={styles.confirmDetailLabel}>Format</span>
          <span className={styles.confirmDetailValue}>{deliveryLabel}</span>
        </div>
        <div className={styles.confirmDetailRow}>
          <span className={styles.confirmDetailLabel}>XP ที่จะได้รับ</span>
          <span className={`${styles.confirmDetailValue} ${styles.confirmXp}`}>
            +{activity?.hours ?? 0} XP
          </span>
        </div>
      </div>

      <div className={styles.confirmDivider} />

      <div className={styles.codeRow}>
        <span className={styles.codeLabel}>Check-in code</span>
        <span className={styles.codeValue}>{code}</span>
      </div>

      <button
        className={styles.checkinButton}
        onClick={handleCheckin}
        disabled={state === "submitting"}
      >
        {state === "submitting" ? "กำลังยืนยัน..." : "ยืนยัน Check-in"}
      </button>

      <div className={styles.confirmNote}>
        กดปุ่มเพื่อยืนยันการเข้าร่วมกิจกรรมนี้ สถานะจะอัปเดตในระบบโดยอัตโนมัติ
      </div>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <div className={styles.page}>
      <div className={styles.logoArea}>
        <span className={styles.logoText}>VCEP</span>
      </div>
      <Suspense fallback={
        <div className={styles.stateCard}>
          <div className={styles.loadingSpinner} />
        </div>
      }>
        <CheckinContent />
      </Suspense>
    </div>
  );
}
