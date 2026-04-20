"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, Suspense } from "react";
import styles from "./page.module.css";

function decodeArtifact(artifactBase64: string | undefined | null) {
  if (!artifactBase64) return {};

  try {
    const binary = atob(artifactBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Failed to decode artifact:", error);
    return {};
  }
}

function getFileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || "";
    const last = pathname.split("/").pop() || "Attached file";
    return decodeURIComponent(last);
  } catch {
    return "Attached file";
  }
}

function ChallengeProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId");

  const [challenge, setChallenge] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localFileUrl, setLocalFileUrl] = useState("");
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [existingFileName, setExistingFileName] = useState("");
  const [isFileUpdate, setIsFileUpdate] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`/api/student/challenge?activity_id=${activityId}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.ok) {
          setChallenge(json.data);
        }
      } catch (error) {
        console.error("Failed to load challenge:", error);
      }
    }

    if (activityId) {
      fetchActivity();
    }
  }, [activityId]);

  const artifact = useMemo(() => {
    return decodeArtifact(challenge?.submission_info?.Artifact);
  }, [challenge]);

  const currentStatus: string = challenge?.submission_info
    ? challenge?.submission_info?.Status || "In Progress"
    : "In Progress";

  const getStatusPillClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "complete" || s === "completed") {
      return `${styles.statusPill} ${styles.statusComplete}`;
    }
    if (s === "submitted") {
      return `${styles.statusPill} ${styles.statusSubmitted}`;
    }
    return `${styles.statusPill} ${styles.statusIncomplete}`;
  };

  useEffect(() => {
    if (artifact?.text_submission) {
      setDescription(String(artifact.text_submission));
    } else {
      setDescription("");
    }

    if (artifact?.file_submission) {
      const url = String(artifact.file_submission);
      setExistingFileUrl(url);
      setExistingFileName(getFileNameFromUrl(url));
    } else {
      setExistingFileUrl("");
      setExistingFileName("");
    }
  }, [artifact]);

  useEffect(() => {
    if (!file) {
      setLocalFileUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalFileUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    const s = currentStatus.toLowerCase();
    setIsComplete(s === "completed" || s === "complete");
  }, [currentStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setIsFileUpdate(true);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setLocalFileUrl("");
    setExistingFileUrl("");
    setExistingFileName("");
    setIsFileUpdate(true);
  };

  const handleSubmit = async () => {
    try {
      const formData = new FormData();
      formData.append("activity_id", activityId || "");
      formData.append("description", description);
      formData.append("file_submission", existingFileUrl || "");
      formData.append("is_file_update", isFileUpdate.toString());

      if (file) {
        formData.append("file", file);
      }

      const res = await fetch("/api/student/submission/challenge", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (json.ok) {
        router.push("/student/activities");
        return;
      }

      console.error("Submit failed:", json);
    } catch (error) {
      console.error("Submit failed:", error);
    }
  };

  const isReadOnly = isComplete;
  const canSubmit = description.trim().length > 0 && !isReadOnly;

  const dueDate = challenge?.activity?.IsOpenEnded
    ? "Open Ended"
    : challenge?.activity?.RunEndAt
    ? `${challenge.activity.RunEndAt.split("T")[0]} ${
        challenge.activity.RunEndAt.split("T")[1]?.split("Z")[0] ?? ""
      }`
    : "—";

  const metaItems = [
    { label: "Type", value: "Challenge" },
    { label: "Hours", value: challenge?.activity?.Hours ?? "—" },
    { label: "Due Date", value: dueDate },
    { label: "Difficulty", value: challenge?.challenge_info?.difficulty ?? "—" },
    {
      label: "XP Reward",
      value: challenge?.challenge_info?.xp
        ? `+${challenge.challenge_info.xp} XP`
        : "—",
    },
    { label: "Status", value: currentStatus },
  ];

  const rewardSkills: any[] = challenge?.challenge_info?.reward_skills ?? [];
  const deliverables: string[] = challenge?.challenge_info?.deliverables ?? [];
  const requirements: string[] = challenge?.challenge_info?.requirements ?? [];

  const displayFileName = file?.name || existingFileName;
  const displayFileUrl = file ? localFileUrl : existingFileUrl;

  return (
    <div className={styles.page}>
      <div className={styles.column}>
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
                    <div className={styles.rewardSkillName}>
                      {skill.skillName ?? skill.skill_name}
                    </div>
                    <div className={styles.rewardSkillLevel}>
                      {skill.level ?? skill.skill_level ?? "—"}
                    </div>
                    <div className={styles.rewardSkillPercent}>
                      {skill.percentText ?? skill.percent ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

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

        {(requirements.length > 0 || deliverables.length > 0) && (
          <section className={`${styles.panel} ${styles.requirementsPanel}`}>
            {requirements.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Requirements</div>
                <ul className={styles.requirementList}>
                  {requirements.map((item: string) => (
                    <li key={item} className={styles.requirementItem}>
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {deliverables.length > 0 && (
              <div className={styles.deliverableWrap}>
                {deliverables.map((item: string) => (
                  <span key={item} className={styles.deliverableChip}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className={styles.column}>
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
              {displayFileName ? (
                <div className={styles.uploadFileCard}>
                  <div>
                    <div className={styles.uploadFileName}>
                      {displayFileUrl ? (
                        <a href={displayFileUrl} target="_blank" rel="noopener noreferrer">
                          {displayFileName}
                        </a>
                      ) : (
                        <span>{displayFileName}</span>
                      )}
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