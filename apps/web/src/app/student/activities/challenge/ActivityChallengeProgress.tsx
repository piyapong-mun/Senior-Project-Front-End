"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import styles from "./ActivityChallengeProgress.module.css";

type ChallengeProgressStatus = "incomplete" | "submitted" | "complete";

type SubmissionFileState = {
  fileName: string;
  previewUrl: string;
  mimeType: string;
};

type ChallengeMetaItem = {
  label: string;
  value: string;
};

type RewardSkill = {
  id: string;
  skillName: string;
  level: string;
  percentText: string;
};

type ChallengeMockItem = {
  id: string;
  title: string;
  organization: string;
  dueDate: string;
  type: "Challenge";
  difficulty: string;
  xp: number;
  description: string;
  problemStatement: string;
  expectedOutcome: string;
  deliverables: string[];
  requirements: string[];
  rewardSkills: RewardSkill[];
  defaultSubmissionNote: string;
  defaultSubmissionLink: string;
  progress: {
    hasSubmission: boolean;
    isVerified: boolean;
    submittedAt: string;
    score: number;
    xpEarned: number;
    existingFileName?: string;
  };
};

const CHALLENGE_ACTIVITIES: ChallengeMockItem[] = [
  {
    id: "challenge-build-calculator-python",
    title: "Build Calculator with Python",
    organization: "Limbus Company",
    dueDate: "25 Jan 2026",
    type: "Challenge",
    difficulty: "Intermediate",
    xp: 120,
    description:
      "Build a calculator application that supports the four basic operators, clean validation, and a readable interface. Students should explain their logic clearly and organize their code so another developer can understand it quickly.",
    problemStatement:
      "Many beginner applications can calculate values, but they often break when the input is invalid or the structure becomes harder to extend. This challenge focuses on both correctness and logic design.",
    expectedOutcome:
      "Submit a working calculator together with a short explanation of the logic, validation flow, and the main decisions used in the implementation.",
    deliverables: [
      "Source code or repository link",
      "Short explanation of the solution",
      "Optional demo video or screenshots",
    ],
    requirements: [
      "Support addition, subtraction, multiplication, and division",
      "Handle invalid input safely",
      "Use meaningful variable and function names",
      "Explain the core logic used in the solution",
    ],
    rewardSkills: [
      { id: "skill-1", skillName: "Python Programming", level: "Intermediate", percentText: "50%" },
      { id: "skill-2", skillName: "Problem Solving", level: "Intermediate", percentText: "30%" },
      { id: "skill-3", skillName: "Logical Thinking", level: "Beginner", percentText: "20%" },
    ],
    defaultSubmissionNote:
      "I used a function-based structure to separate the calculation logic from input validation and error handling.",
    defaultSubmissionLink: "https://github.com/example/python-calculator",
    progress: {
      hasSubmission: false,
      isVerified: false,
      submittedAt: "25 Jan 2026",
      score: 100,
      xpEarned: 120,
    },
  },
  {
    id: "challenge-build-calculator-cpp",
    title: "Build Calculator with C++",
    organization: "Limbus Company",
    dueDate: "26 Jan 2026",
    type: "Challenge",
    difficulty: "Intermediate",
    xp: 130,
    description:
      "Create a C++ calculator that separates calculation logic into reusable functions and validates invalid input before the program executes each operation.",
    problemStatement:
      "Console programs often work only in ideal conditions. This challenge focuses on clean structure, user feedback, and safe handling of invalid entries.",
    expectedOutcome:
      "Submit a working calculator project with a short note explaining the structure of your code and how your validation works.",
    deliverables: [
      "C++ source files",
      "Short explanation document",
      "Optional screenshot of sample output",
    ],
    requirements: [
      "Support four basic operators",
      "Prevent invalid input from crashing the program",
      "Organize logic into reusable functions",
      "Document the main calculation flow",
    ],
    rewardSkills: [
      { id: "skill-1", skillName: "C++ Programming", level: "Intermediate", percentText: "50%" },
      { id: "skill-2", skillName: "Problem Solving", level: "Intermediate", percentText: "25%" },
      { id: "skill-3", skillName: "Code Structure", level: "Applying", percentText: "25%" },
    ],
    defaultSubmissionNote:
      "I grouped each operator into a separate function and added checks before division to avoid invalid operations.",
    defaultSubmissionLink: "https://github.com/example/cpp-calculator",
    progress: {
      hasSubmission: true,
      isVerified: true,
      submittedAt: "26 Jan 2026",
      score: 95,
      xpEarned: 130,
      existingFileName: "calculator-cpp.zip",
    },
  },
  {
    id: "challenge-responsive-web-page",
    title: "Responsive Web Page Workshop",
    organization: "PeakSystems",
    dueDate: "30 Jan 2026",
    type: "Challenge",
    difficulty: "Beginner",
    xp: 90,
    description:
      "Build a responsive landing page that adapts from desktop to mobile while keeping spacing, hierarchy, and readability consistent.",
    problemStatement:
      "Layouts that look correct on a laptop often break on smaller screens. This challenge focuses on practical responsive structure and component spacing.",
    expectedOutcome:
      "Submit the page source together with a short note explaining the responsive rules you used.",
    deliverables: [
      "Source code or repository link",
      "Short responsive design explanation",
      "Optional before and after screenshots",
    ],
    requirements: [
      "Create a desktop and mobile-friendly layout",
      "Use clear section hierarchy",
      "Keep spacing consistent across breakpoints",
      "Explain the main responsive decisions",
    ],
    rewardSkills: [
      { id: "skill-1", skillName: "Responsive Design", level: "Beginner", percentText: "45%" },
      { id: "skill-2", skillName: "HTML/CSS", level: "Beginner", percentText: "35%" },
      { id: "skill-3", skillName: "UI Structure", level: "Understanding", percentText: "20%" },
    ],
    defaultSubmissionNote:
      "I used a stacked mobile layout, then expanded the sections into a multi-column grid for larger screens.",
    defaultSubmissionLink: "https://github.com/example/responsive-page",
    progress: {
      hasSubmission: true,
      isVerified: false,
      submittedAt: "30 Jan 2026",
      score: 88,
      xpEarned: 90,
      existingFileName: "responsive-layout.pdf",
    },
  },
  {
    id: "challenge-performance-analysis-case",
    title: "Performance Analysis Case",
    organization: "PeakSystems",
    dueDate: "05 Feb 2026",
    type: "Challenge",
    difficulty: "Intermediate",
    xp: 110,
    description:
      "Analyze the provided system behavior and summarize what the team should investigate first based on performance symptoms and likely bottlenecks.",
    problemStatement:
      "Teams often collect data but struggle to turn it into practical action. This challenge focuses on interpretation, prioritization, and evidence-based reasoning.",
    expectedOutcome:
      "Submit a short case analysis with your reasoning, the likely problem area, and the first recommended next step.",
    deliverables: [
      "Case analysis document",
      "Optional diagram or table",
      "Reference link if external material was used",
    ],
    requirements: [
      "Identify the likely bottleneck clearly",
      "Explain the reasoning behind your conclusion",
      "Suggest one practical next action",
      "Keep the analysis concise and readable",
    ],
    rewardSkills: [
      { id: "skill-1", skillName: "Analysis", level: "Applying", percentText: "45%" },
      { id: "skill-2", skillName: "Problem Solving", level: "Applying", percentText: "35%" },
      { id: "skill-3", skillName: "Technical Writing", level: "Understanding", percentText: "20%" },
    ],
    defaultSubmissionNote:
      "I focused on the delay pattern first, then traced which part of the workflow had the highest likelihood of becoming the bottleneck.",
    defaultSubmissionLink: "https://docs.example.com/performance-analysis-case",
    progress: {
      hasSubmission: false,
      isVerified: false,
      submittedAt: "05 Feb 2026",
      score: 100,
      xpEarned: 110,
    },
  },
  {
    id: "challenge-api-integration-practice",
    title: "API Integration Practice",
    organization: "NextDynamics",
    dueDate: "08 Feb 2026",
    type: "Challenge",
    difficulty: "Intermediate",
    xp: 115,
    description:
      "Connect a front-end form to an API endpoint, handle loading and error states, and explain the integration flow clearly.",
    problemStatement:
      "Interfaces frequently break when request state, validation, or error handling are incomplete. This challenge focuses on practical integration quality.",
    expectedOutcome:
      "Submit the integration work together with a short note describing the request flow and how the UI responds to success and failure.",
    deliverables: [
      "Source code or repository link",
      "Short integration flow explanation",
      "Optional screenshots or demo link",
    ],
    requirements: [
      "Connect the UI to an API endpoint",
      "Handle loading and error states",
      "Show clear feedback after submission",
      "Explain the request-response flow",
    ],
    rewardSkills: [
      { id: "skill-1", skillName: "API Integration", level: "Intermediate", percentText: "45%" },
      { id: "skill-2", skillName: "Frontend Logic", level: "Applying", percentText: "35%" },
      { id: "skill-3", skillName: "Validation", level: "Understanding", percentText: "20%" },
    ],
    defaultSubmissionNote:
      "I separated validation, request state, and success feedback so the form remains easy to understand and update.",
    defaultSubmissionLink: "https://github.com/example/api-integration-practice",
    progress: {
      hasSubmission: true,
      isVerified: false,
      submittedAt: "08 Feb 2026",
      score: 92,
      xpEarned: 115,
      existingFileName: "api-flow-diagram.png",
    },
  },
  {
    id: "challenge-react-component-lab",
    title: "React Component Lab",
    organization: "BlueTechnologies",
    dueDate: "13 Feb 2026",
    type: "Challenge",
    difficulty: "Intermediate",
    xp: 125,
    description:
      "Build a reusable component set with clear props, readable state flow, and consistent layout behavior across examples.",
    problemStatement:
      "Reusable components become difficult to maintain when props and state responsibilities are unclear. This challenge focuses on clarity and reuse.",
    expectedOutcome:
      "Submit the component implementation with a short explanation of the state flow and how the components were designed for reuse.",
    deliverables: [
      "Component source code",
      "Short design explanation",
      "Optional usage examples or screenshots",
    ],
    requirements: [
      "Create reusable components with clear props",
      "Keep state flow understandable",
      "Apply consistent spacing and naming",
      "Explain the structure briefly",
    ],
    rewardSkills: [
      { id: "skill-1", skillName: "React", level: "Intermediate", percentText: "50%" },
      { id: "skill-2", skillName: "Component Design", level: "Applying", percentText: "30%" },
      { id: "skill-3", skillName: "Code Readability", level: "Understanding", percentText: "20%" },
    ],
    defaultSubmissionNote:
      "I split the shared UI into smaller components and documented which props control layout and content.",
    defaultSubmissionLink: "https://github.com/example/react-component-lab",
    progress: {
      hasSubmission: true,
      isVerified: true,
      submittedAt: "13 Feb 2026",
      score: 97,
      xpEarned: 125,
      existingFileName: "component-lab-notes.pdf",
    },
  },
];

const STATUS_TEXT: Record<ChallengeProgressStatus, string> = {
  incomplete: "Incomplete",
  submitted: "Submitted",
  complete: "Complete",
};

function createEmptyFileState(fileName = ""): SubmissionFileState {
  return {
    fileName,
    previewUrl: "",
    mimeType: "",
  };
}

function MetaGrid({ items }: { items: ChallengeMetaItem[] }) {
  return (
    <div className={styles.metaGrid}>
      {items.map((item) => (
        <div key={item.label} className={styles.metaCard}>
          <div className={styles.metaLabel}>{item.label}</div>
          <div className={styles.metaValue}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: ChallengeProgressStatus }) {
  return (
    <span
      className={`${styles.statusPill} ${
        status === "complete"
          ? styles.statusComplete
          : status === "submitted"
          ? styles.statusSubmitted
          : styles.statusIncomplete
      }`}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}

export default function ActivityChallengeProgress() {
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId") || CHALLENGE_ACTIVITIES[0].id;

  const selectedChallenge =
    CHALLENGE_ACTIVITIES.find((item) => item.id === activityId) || CHALLENGE_ACTIVITIES[0];

  const [hasSubmitted, setHasSubmitted] = useState<boolean>(selectedChallenge.progress.hasSubmission);
  const [submissionNotice, setSubmissionNotice] = useState("");
  const [submissionNote, setSubmissionNote] = useState(selectedChallenge.defaultSubmissionNote);
  const [submissionLink, setSubmissionLink] = useState(selectedChallenge.defaultSubmissionLink);
  const [uploadedFile, setUploadedFile] = useState<SubmissionFileState>(
    createEmptyFileState(selectedChallenge.progress.existingFileName || "")
  );
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setHasSubmitted(selectedChallenge.progress.hasSubmission);
    setSubmissionNotice("");
    setSubmissionNote(selectedChallenge.defaultSubmissionNote);
    setSubmissionLink(selectedChallenge.defaultSubmissionLink);
    setUploadedFile(createEmptyFileState(selectedChallenge.progress.existingFileName || ""));
    setUploadError("");
  }, [selectedChallenge]);

  useEffect(() => {
    return () => {
      if (uploadedFile.previewUrl) {
        URL.revokeObjectURL(uploadedFile.previewUrl);
      }
    };
  }, [uploadedFile.previewUrl]);

  const activityStatus: ChallengeProgressStatus = selectedChallenge.progress.isVerified
    ? "complete"
    : hasSubmitted
    ? "submitted"
    : "incomplete";

  const metaItems = useMemo<ChallengeMetaItem[]>(
    () => [
      { label: "Organization", value: selectedChallenge.organization },
      { label: "Due date", value: selectedChallenge.dueDate },
      { label: "Type", value: selectedChallenge.type },
      { label: "Difficulty", value: selectedChallenge.difficulty },
      { label: "XP reward", value: `${selectedChallenge.xp} XP` },
      { label: "Current status", value: STATUS_TEXT[activityStatus] },
    ],
    [activityStatus, selectedChallenge]
  );

  const isReadOnly = activityStatus === "complete";
  const canSubmit = Boolean(
    submissionNote.trim() || submissionLink.trim() || uploadedFile.fileName
  );

  const handleUploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextUrl = URL.createObjectURL(file);

    if (uploadedFile.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }

    setUploadedFile({
      fileName: file.name,
      previewUrl: nextUrl,
      mimeType: file.type,
    });
    setUploadError("");
    event.target.value = "";
  };

  const handleRemoveFile = () => {
    if (uploadedFile.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }
    setUploadedFile(createEmptyFileState());
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      setUploadError("Please add a note, link, or file before submitting.");
      return;
    }

    setUploadError("");
    setHasSubmitted(true);
    setSubmissionNotice(
      "Your submission has been sent. Preview state changes to Complete only after review and verification."
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <section className={`${styles.panel} ${styles.summaryPanel}`}>
          <div className={styles.topRow}>
            <div>
              <div className={styles.eyebrow}>Student Activity</div>
              <h1 className={styles.title}>{selectedChallenge.title}</h1>
            </div>

            <div className={styles.headerActions}>
              <StatusPill status={activityStatus} />
              <Link href="/student/activities/overview" className={styles.backButton}>
                Back
              </Link>
            </div>
          </div>

          <p className={styles.description}>{selectedChallenge.description}</p>

          <MetaGrid items={metaItems} />

          <div className={styles.rewardSkillsSection}>
            <div className={styles.rewardSkillsTitle}>Skills you will receive</div>
            <div className={styles.rewardSkillsList}>
              {selectedChallenge.rewardSkills.map((skill) => (
                <div key={skill.id} className={styles.rewardSkillRow}>
                  <div className={styles.rewardSkillName}>{skill.skillName}</div>
                  <div className={styles.rewardSkillLevel}>{skill.level}</div>
                  <div className={styles.rewardSkillPercent}>{skill.percentText}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.previewStateRow}>
            <span className={styles.previewStateLabel}>Preview state</span>
            <div className={styles.previewStateGroup} aria-label="Preview state display only">
              <span
                className={`${styles.previewStateBadge} ${
                  activityStatus === "incomplete" ? styles.previewStateBadgeActive : ""
                }`}
              >
                Incomplete
              </span>
              <span
                className={`${styles.previewStateBadge} ${
                  activityStatus === "submitted" ? styles.previewStateBadgeActive : ""
                }`}
              >
                Submitted
              </span>
              <span
                className={`${styles.previewStateBadge} ${
                  activityStatus === "complete" ? styles.previewStateBadgeActive : ""
                }`}
              >
                Complete
              </span>
            </div>
          </div>

          <div className={styles.previewStateHint}>
            This status updates automatically after a real submission is sent and after the reviewer verifies it.
          </div>
        </section>

        <section className={`${styles.panel} ${styles.contentPanel}`}>
          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>Problem statement</div>
            <p className={styles.sectionText}>{selectedChallenge.problemStatement}</p>
          </div>

          <div className={styles.sectionDivider} />

          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>Expected outcome</div>
            <p className={styles.sectionText}>{selectedChallenge.expectedOutcome}</p>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.requirementsPanel}`}>
          <div className={styles.sectionTitle}>Requirements</div>
          <ul className={styles.requirementList}>
            {selectedChallenge.requirements.map((item) => (
              <li key={item} className={styles.requirementItem}>
                {item}
              </li>
            ))}
          </ul>

          <div className={styles.deliverableWrap}>
            {selectedChallenge.deliverables.map((item) => (
              <span key={item} className={styles.deliverableChip}>
                {item}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.column}>
        {activityStatus === "complete" ? (
          <section className={`${styles.panel} ${styles.successPanel}`}>
            <div className={styles.successTitle}>Congratulations !!!</div>
            <div className={styles.successCard}>
              <div className={styles.successCardLabel}>Certificate</div>
              <div className={styles.successCardValue}>Download Certificate</div>
            </div>
            <div className={styles.successMetaRow}>
              <span>Submitted: {selectedChallenge.progress.submittedAt}</span>
              <span>Score: {selectedChallenge.progress.score}</span>
              <span>XP: +{selectedChallenge.progress.xpEarned}</span>
            </div>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.submissionPanel}`}>
          <div className={styles.sectionTitle}>Submission</div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Description</label>
            <textarea
              className={styles.textarea}
              value={submissionNote}
              onChange={(event) => setSubmissionNote(event.target.value)}
              placeholder="Explain your idea, logic, and important implementation notes"
              disabled={isReadOnly}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Reference Link</label>
            <input
              className={styles.input}
              value={submissionLink}
              onChange={(event) => setSubmissionLink(event.target.value)}
              placeholder="GitHub / Figma / Demo link"
              disabled={isReadOnly}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Upload File</label>
            <div className={styles.uploadBox}>
              {uploadedFile.fileName ? (
                <div className={styles.uploadFileCard}>
                  <div>
                    <div className={styles.uploadFileName}>{uploadedFile.fileName}</div>
                    <div className={styles.uploadFileHint}>Attached to this submission</div>
                  </div>

                  {!isReadOnly ? (
                    <button
                      type="button"
                      className={styles.inlineTextButton}
                      onClick={handleRemoveFile}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className={styles.uploadEmpty}>No file uploaded yet</div>
              )}

              {!isReadOnly ? (
                <label className={styles.uploadButton}>
                  upload
                  <input
                    type="file"
                    className={styles.hiddenInput}
                    onChange={handleUploadFile}
                  />
                </label>
              ) : null}
            </div>
          </div>

          {uploadError ? <div className={styles.errorText}>{uploadError}</div> : null}
          {submissionNotice ? <div className={styles.infoText}>{submissionNotice}</div> : null}

          <div className={styles.actionRow}>
            {!isReadOnly ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {activityStatus === "submitted" ? "Update submission" : "Submit challenge"}
              </button>
            ) : null}
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