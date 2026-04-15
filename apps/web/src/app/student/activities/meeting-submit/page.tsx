"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MeetingSubmitContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activity_id");
  const qrData = searchParams.get("qrdata");
  
  const [status, setStatus] = useState("Submitting your check-in...");
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (!activityId) {
      setStatus("Error: Missing activity ID");
      return;
    }

    if (hasTriggered) return;
    setHasTriggered(true);

    const submitQrData = async () => {
      try {
        const formData = new FormData();
        formData.append("activity_id", activityId);
        if (qrData) {
          formData.append("qrdata", qrData);
        }
        // Force file update string off for simple QR check-in
        formData.append("is_file_update", "false");

        const res = await fetch("/api/student/submission/meeting", {
          method: "POST",
          body: formData,
        });
        
        const json = await res.json();
        if (json.ok) {
          setStatus("Success! Redirecting...");
          router.push(`/student/activities/meeting-progress?activityId=${activityId}`);
        } else {
          setStatus(`Failed to submit: ${json.message || "Unknown error"}`);
        }
      } catch (err) {
        setStatus("An error occurred during submission.");
      }
    };

    submitQrData();
  }, [activityId, qrData, hasTriggered, router]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F3EEE8",
      fontFamily: "inherit"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        textAlign: "center"
      }}>
        <h2 style={{ color: "#111827", marginBottom: "16px", fontWeight: "600" }}>{status}</h2>
        <div style={{ color: "#6b7280", fontSize: "0.95rem" }}>
          Please wait while we process your QR code data.
        </div>
      </div>
    </div>
  );
}

export default function MeetingSubmitPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading application...</div>}>
      <MeetingSubmitContent />
    </Suspense>
  );
}
