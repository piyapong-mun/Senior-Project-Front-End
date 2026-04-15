"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
import styles from "./page.module.css";
import { Suspense } from "react";

function ChallengeProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId");
  const [challenge, setChallenge] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isFileUpdate, setIsFileUpdate] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  //==============================
  // fetch activity data
  //==============================
  useEffect(() => {
    async function fetchActivity() {
      const res = await fetch(`/api/student/challenge?activity_id=${activityId}`);
      const json = await res.json();

      if (json.ok) {
        setChallenge(json.data);
        console.log("challenge", json.data);
      }
    }
    fetchActivity();
  }, [activityId]);

  // Change artifact []byte form go to json
  const artifact = useMemo(() => {
    const art = challenge?.submission_info?.Artifact;
    if (!art) return [];

    // The 'art' string from Go []byte is base64 encoded by default.
    // Decode base64 to utf-8 string, then parse the JSON
    const decodedStr = Buffer.from(art, "base64").toString("utf-8");
    return JSON.parse(decodedStr);
  }, [challenge]);

  const currentStatus = challenge?.submission_info ? challenge?.submission_info?.Status : "In Progress";
  const getStatusClass = (status: string) => {
    if (!status) return styles.statusRed;
    const s = status.toLowerCase();
    if (s === "complete" || s === "completed") return styles.statusGreen;
    if (s === "in progress") return styles.statusBlue;
    return styles.statusRed;
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setIsFileUpdate(true);
    }
  };

  // console.log(artifact);

  // ==================
  // Submit
  // ==================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("activity_id", activityId || "");
    formData.append("description", description);
    formData.append("file", file || "");
    formData.append("file_submission", artifact.file_submission || "");
    formData.append("is_file_update", isFileUpdate.toString());

    const res = await fetch("/api/student/submission/challenge", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (json.ok) {
      router.push("/student/activities");
    }
  }


  //==============================
  // fetch file submission (from s3 path -> blob -> file)
  //==============================
  // ใช้ useEffect ( เนื่องจากหากมีการ re-render จะทำให้ fetch file ใหม่ทุกครั้ง ป้องกัน File ไม่อัพเดท )
  useEffect(() => {
    async function fetchFile() {
      if (artifact?.text_submission) {
        setDescription(artifact.text_submission);
      }
      if (artifact?.file_submission) {
        const PATH = artifact.file_submission;
        const res = await fetch("https://miro.medium.com/v2/resize:fit:4800/format:webp/1*1nTjDBAC2kYVlLLmEc8BKw.png");
        console.log(res);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], "Click to Open", { type: "text/plain" });
          setFile(file);
        }
      }
    }
    fetchFile();
  }, [artifact]);

  //===============================
  // Check if the submission is complete
  //===============================
  // const currentStatus = challenge?.submission_info?.Status === "" ? "In Progress" : challenge?.submission_info ? challenge?.submission_info?.Status : "In Progress";
  useEffect(() => {
    console.log(currentStatus);
    if (currentStatus.toLowerCase() === "completed" || currentStatus.toLowerCase() === "complete") {
      setIsComplete(true);
    }
  }, [challenge])

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>
            {challenge?.activity.ActivityName || "Loading..."}
          </h1>
          <button className={styles.backButton} onClick={() => router.back()}>
            Back
          </button>
        </div>
        <p className={styles.description}>
          {challenge?.challenge_info.problem_statement || "Loading..."}
        </p>

        <div className={styles.infoGrid}>
          <div className={styles.infoColumn}>
            <p>Hours : <span>{challenge?.activity.Hours}</span></p>
            <p>Due date: <span>{challenge?.activity.IsOpenEnded ? "----" : `${challenge?.activity.RunEndAt.split("T")[0]} ${challenge?.activity.RunEndAt.split("T")[1].split("Z")[0]}`}</span></p>
          </div>
          <div className={styles.infoColumn}>
            <p>Status : <span className={getStatusClass(currentStatus)}>{currentStatus}</span></p>
            <p>Type : <span>Challenge</span></p>
          </div>
        </div>
      </section>
      {isComplete && (
        <section className={`${styles.card} ${styles.feedbackGreen}`}>
          <h2 className={styles.sectionTitle}>Feedback</h2>
          <div className={styles.feedbackComment}>
            <p>"{challenge?.feedback_info?.feedback}"</p>
          </div>
          <div className={styles.rewardContainer}>
            <div className={`${styles.rewardBadge} ${challenge?.feedback_info?.status ? styles.badgePass : styles.badgeFail}`}>
              <span className={styles.badgeLabel}>Status</span>
              <span className={styles.badgeValue}>
                {challenge?.feedback_info?.status ? "Pass" : "Fail"}
              </span>
            </div>
            <div className={`${styles.rewardBadge} ${styles.badgeXp}`}>
              <span className={styles.badgeLabel}>XP Earned</span>
              <span className={styles.badgeValue}>
                +{challenge?.submission_info?.XP || 0}
              </span>
            </div>
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Submission</h2>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea className={styles.textarea} rows={5} value={description} onChange={handleDescriptionChange} disabled={isComplete}></textarea>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Upload File</label>
            <div className={styles.uploadArea}>
              {/* Display selected file name */}
              {file && <span className={styles.fileName}>
                <a href={artifact.file_submission} target="_blank" rel="noopener noreferrer">
                  {file.name}
                </a></span>}

              {/* The actual hidden input */}
              <input
                type="file"
                id="file-upload"
                className={styles.hiddenInput}
                disabled={isComplete}
                onChange={handleFileChange}
              />

              {/* The visible button (label) */}
              <label htmlFor="file-upload" className={styles.customUploadButton}>
                {file ? "Change File" : "Select Document"}
              </label>

            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
            {/* Log isComplete */}
            {/* <p>{isComplete.toString()}</p> */}
            <button type="submit" className={styles.submitButton} disabled={isComplete}>Submit</button>
          </div>
        </section>
      </form>
    </div>
  );
}

export default function ChallengeProgress() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChallengeProgressContent />
    </Suspense>
  );
}
