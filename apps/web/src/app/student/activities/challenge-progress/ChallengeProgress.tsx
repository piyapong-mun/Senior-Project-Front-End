"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { Suspense } from "react";
import styles from "./page.module.css";

function ChallengeProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId");
  const [challenge, setChallenge] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isFileUpdate, setIsFileUpdate] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // ==============================
  // Fetch activity data
  // ==============================
  useEffect(() => {
    async function fetchActivity() {
      const res = await fetch(`/api/student/challenge?activity_id=${activityId}`);
      const json = await res.json();
      if (json.ok) {
        setChallenge(json.data);
      }
    }
    fetchActivity();
  }, [activityId]);

  // Decode artifact []byte from Go (base64 → JSON)
  const artifact = useMemo(() => {
    const art = challenge?.submission_info?.Artifact;
    if (!art) return [];
    const decodedStr = Buffer.from(art, "base64").toString("utf-8");
    return JSON.parse(decodedStr);
  }, [challenge]);

  const currentStatus: string = challenge?.submission_info
    ? challenge?.submission_info?.Status || "In Progress"
    : "In Progress";

  // Map status → pill style
  const getStatusPillClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "complete" || s === "completed") return `${styles.statusPill} ${styles.statusComplete}`;
    if (s === "submitted") return `${styles.statusPill} ${styles.statusSubmitted}`;
    return `${styles.statusPill} ${styles.statusIncomplete}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setIsFileUpdate(true);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setIsFileUpdate(false);
  };

  // ==================
  // Submit
  // ==================
  const handleSubmit = async () => {
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
  };

  // ==============================
  // Prefill existing submission
  // ==============================
  useEffect(() => {
    async function fetchFile() {
      if (artifact?.text_submission) {
        setDescription(artifact.text_submission);
      }
      if (artifact?.file_submission) {
        const res = await fetch(artifact.file_submission);
        if (res.ok) {
          const blob = await res.blob();
          const fetched = new File([blob], "Click to Open", { type: "text/plain" });
          setFile(fetched);
        }
      }
    }
    fetchFile();
  }, [artifact]);

  // ==============================
  // Check completion
  // ==============================
  useEffect(() => {
    if (
      currentStatus.toLowerCase() === "completed" ||
      currentStatus.toLowerCase() === "complete"
    ) {
      setIsComplete(true);
    }
  }, [challenge]);

  const isReadOnly = isComplete;
  const canSubmit = description.trim().length > 0 && !isReadOnly;

  // Meta items
  const dueDate = challenge?.activity?.IsOpenEnded
    ? "Open Ended"
    : challenge?.activity?.RunEndAt
    ? `${challenge.activity.RunEndAt.split("T")[0]} ${challenge.activity.RunEndAt.split("T")[1]?.split("Z")[0] ?? ""}`
    : "—";

  const metaItems = [
    { label: "Type", value: "Challenge" },
    { label: "Hours", value: challenge?.activity?.Hours ?? "—" },
    { label: "Due Date", value: dueDate },
    { label: "Difficulty", value: challenge?.challenge_info?.difficulty ?? "—" },
    { label: "XP Reward", value: challenge?.challenge_info?.xp ? `+${challenge.challenge_info.xp} XP` : "—" },
    { label: "Status", value: currentStatus },
  ];

  const rewardSkills: any[] = challenge?.challenge_info?.reward_skills ?? [];
  const deliverables: string[] = challenge?.challenge_info?.deliverables ?? [];
  const requirements: string[] = challenge?.challenge_info?.requirements ?? [];

  return (
    <div className={styles.page}>
      {/* ─── LEFT COLUMN ─────────────────────────────────── */}
      <div className={styles.column}>
        {/* Summary panel */}
        <section className={`${styles.panel} ${styles.summaryPanel}`}>
          <div className={styles.eyebrow}>Challenge</div>

          <div className={styles.topRow}>
            <h1 className={styles.title}>
              {challenge?.activity?.ActivityName ?? "Loading..."}
            </h1>
            <div className={styles.headerActions}>
              <span className={getStatusPillClass(currentStatus)}>{currentStatus}</span>
              <button className={styles.backButton} onClick={() => router.back()}>
                Back
              </button>
            </div>
          </div>

          <p className={styles.description}>
            {challenge?.challenge_info?.problem_statement ?? "Loading..."}
          </p>

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
                {rewardSkills.map((skill: any, i: number) => (
                  <div key={i} className={styles.rewardSkillRow}>
                    <div className={styles.rewardSkillName}>{skill.skillName ?? skill.skill_name}</div>
                    <div className={styles.rewardSkillLevel}>{skill.level}</div>
                    <div className={styles.rewardSkillPercent}>{skill.percentText ?? skill.percent}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Problem / Expected outcome */}
        <section className={`${styles.panel} ${styles.contentPanel}`}>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>Problem statement</div>
            <p className={styles.sectionText}>
              {challenge?.challenge_info?.problem_statement ?? "—"}
            </p>
          </div>

          <div className={styles.sectionDivider} />

          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>Expected outcome</div>
            <p className={styles.sectionText}>
              {challenge?.challenge_info?.expected_outcome ?? "—"}
            </p>
          </div>
        </section>

        {/* Requirements & Deliverables */}
        {(requirements.length > 0 || deliverables.length > 0) && (
          <section className={`${styles.panel} ${styles.requirementsPanel}`}>
            {requirements.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Requirements</div>
                <ul className={styles.requirementList}>
                  {requirements.map((item: string) => (
                    <li key={item} className={styles.requirementItem}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {deliverables.length > 0 && (
              <div className={styles.deliverableWrap}>
                {deliverables.map((item: string) => (
                  <span key={item} className={styles.deliverableChip}>{item}</span>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ─── RIGHT COLUMN ────────────────────────────────── */}
      <div className={styles.column}>
        {/* Congratulations / feedback panel */}
        {isComplete && (
          <section className={`${styles.panel} ${styles.successPanel}`}>
            <div className={styles.successTitle}>Congratulations !!!</div>

            {challenge?.feedback_info?.feedback && (
              <div className={styles.successCard} style={{ marginBottom: 10 }}>
                <div className={styles.successCardLabel}>Feedback</div>
                <div className={styles.successCardValue}>
                  {challenge.feedback_info.feedback}
                </div>
              </div>
            )}

            <div className={styles.successCard}>
              <div className={styles.successCardLabel}>Result</div>
              <div className={styles.successCardValue}>
                {challenge?.feedback_info?.status ? "Pass" : "Fail"}
              </div>
            </div>

            <div className={styles.successMetaRow}>
              {challenge?.activity?.RunEndAt && (
                <span>Submitted: {challenge.activity.RunEndAt.split("T")[0]}</span>
              )}
              <span>XP: +{challenge?.submission_info?.XP ?? 0}</span>
            </div>
          </section>
        )}

        {/* Submission form */}
        <section className={`${styles.panel} ${styles.submissionPanel}`}>
          <div className={styles.sectionTitle}>Submission</div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Description</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain your idea, logic, and important implementation notes"
              disabled={isReadOnly}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Upload File</label>
            <div className={styles.uploadBox}>
              {file ? (
                <div className={styles.uploadFileCard}>
                  <div>
                    <div className={styles.uploadFileName}>
                      <a
                        href={artifact.file_submission}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {file.name}
                      </a>
                    </div>
                    <div className={styles.uploadFileHint}>Attached to this submission</div>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      className={styles.inlineTextButton}
                      onClick={handleRemoveFile}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.uploadEmpty}>No file uploaded yet</div>
              )}

              {!isReadOnly && (
                <label className={styles.uploadButton}>
                  Upload
                  <input
                    type="file"
                    className={styles.hiddenInput}
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>

          <div className={styles.actionRow}>
            {!isReadOnly && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {currentStatus.toLowerCase() === "submitted"
                  ? "Update submission"
                  : "Submit challenge"}
              </button>
            )}
          </div>
        </section>

        {/* Tips panel */}
        <section className={`${styles.panel} ${styles.tipPanel}`}>
          <div className={styles.sectionTitle}>Submission tips</div>
          <div className={styles.tipList}>
            <div className={styles.tipItem}>
              Use a short explanation for the core logic and validation flow.
            </div>
            <div className={styles.tipItem}>
              If you submit a repository, make sure the main entry file is easy to find.
            </div>
            <div className={styles.tipItem}>
              Screenshots or a demo video help reviewers understand the finished result faster.
            </div>
          </div>
        </section>
      </div>
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
