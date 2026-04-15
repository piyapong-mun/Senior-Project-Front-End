"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import styles from "./page.module.css";
import { Suspense } from "react";

function MeetingProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId");
  const [meeting, setMeeting] = useState<any>(null);
  const [qrOrigin, setQrOrigin] = useState("");

  useEffect(() => {
    setQrOrigin(typeof window !== 'undefined' ? window.location.origin : "");
  }, []);

  //==============================
  // fetch activity data
  //==============================
  useEffect(() => {
    async function fetchActivity() {
      const res = await fetch(`/api/student/meeting?activity_id=${activityId}`);
      const json = await res.json();

      if (json.ok) {
        setMeeting(json.data);
        console.log("meeting data:", json.data);
      }
    }
    if (activityId) {
      fetchActivity();
    }
  }, [activityId]);

  const currentStatus = meeting?.submission_info?.Status === "" ? "In Progress" : meeting?.submission_info ? meeting?.submission_info?.Status : "In Progress";

  const getStatusClass = (status: string) => {
    if (!status) return styles.statusInProgress;
    const s = status.toLowerCase();
    if (s === "complete" || s === "completed") return styles.statusComplete;
    if (s === "incomplete") return styles.statusRed;
    return styles.statusInProgress;
  };

  const isComplete = currentStatus?.toLowerCase() === "complete" || currentStatus?.toLowerCase() === "completed";

  // Formatted dates
  const dueDate = useMemo(() => {
    if (!meeting?.activity?.RunEndAt) return "----";
    const date = new Date(meeting.activity.RunEndAt);
    return date.toLocaleDateString('en-GB'); // dd/mm/yyyy
  }, [meeting?.activity?.RunEndAt]);

  const submitDate = useMemo(() => {
    if (!meeting?.submission_info?.SubmittedAt) return "----";
    const date = new Date(meeting.submission_info.SubmittedAt);
    return date.toLocaleDateString('en-GB');
  }, [meeting?.submission_info?.SubmittedAt]);

  // Score & EXP fallbacks
  const score = meeting?.submission_info?.Score || 0;
  const exp = meeting?.submission_info?.XP || 0;

  console.log("meeting:", meeting);

  console.log("qr:", `${qrOrigin}/student/activities/meeting-submit?activity_id=${activityId || ""}&qrdata=${meeting?.meeting_info?.qrcode_checkin || "checkin"}`);

  console.log("qrdata:", meeting?.meeting_info?.qrcode_checkin || "checkin");

  return (
    <div className={styles.container}>
      {/* HEADER CARD */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>
            {meeting?.activity?.ActivityName || "Loading..."}
          </h1>
          <button className={styles.backButton} onClick={() => router.back()}>
            Back
          </button>
        </div>
        <p className={styles.description}>
          {meeting?.activity?.Description === "" ? "No description" : meeting?.activity?.Description}
        </p>

        <div className={styles.infoGrid}>
          <div className={styles.infoColumn}>
            <p>Hours : <span>{meeting?.activity?.Hours}</span></p>
            <p>Due date: <span>{dueDate}</span></p>
          </div>
          <div className={styles.infoColumn}>
            <p>Status : <span className={getStatusClass(currentStatus)}>{currentStatus}</span></p>
            <p>Type : <span>Meeting</span></p>
          </div>
        </div>
      </section>

      {/* CONGRATULATIONS BANNER */}
      {isComplete && (
        <section className={`${styles.card} ${styles.congratsBanner}`}>
          <h2 className={styles.congratsTitle}>Congratulations !!!</h2>
          <div className={styles.congratsStats}>
            <span>Submit Date : {submitDate}</span>
            {/* <span>Score : {score}</span> */}
            <span>EXP : {exp}</span>
          </div>
        </section>
      )}

      {/* QR CODE CARD */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Meeting QR Code</h2>

        <div className={styles.qrContainer}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrOrigin ? `${qrOrigin}/student/activities/meeting-submit?activity_id=${activityId || ""}&qrdata=${meeting?.meeting_info?.qrcode_checkin || "checkin"}` : "")}`}
            alt="Meeting QR Code"
            className={styles.qrCode}
            style={{ filter: isComplete ? 'blur(10px)' : 'none', transition: 'filter 0.3s ease' }}
          />
        </div>
      </section>
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
