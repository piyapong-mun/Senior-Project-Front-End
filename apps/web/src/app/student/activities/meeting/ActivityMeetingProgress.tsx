"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import styles from "./ActivityMeetingProgress.module.css";

type MeetingStatus = "incomplete" | "complete";

type MetaItem = {
  label: string;
  value: string;
};

type RewardSkill = {
  id: string;
  skillName: string;
  level: string;
  percentText: string;
};

type MeetingMockItem = {
  id: string;
  title: string;
  organization: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  type: "Meeting";
  format: string;
  location: string;
  speaker: string;
  description: string;
  agenda: string[];
  qrCode: string;
  rewardSkills: RewardSkill[];
  progress: {
    attendanceMarked: boolean;
    isVerified: boolean;
    checkedInAt: string;
    score: number;
    xpEarned: number;
  };
};

const MEETING_ACTIVITIES: MeetingMockItem[] = [
  {
    id: "meeting-nextgen-kickoff",
    title: "NextGen Developer Kickoff",
    organization: "Limbus Company",
    dueDate: "27 Jan 2026",
    startTime: "13:00",
    endTime: "16:30",
    type: "Meeting",
    format: "On-site",
    location: "ICT Mahidol University, Building A, Floor 3, Room 305",
    speaker: "Senior Software Engineer, Limbus Company",
    description:
      "A practical session where students meet the company team, review the program structure, understand expectations, and prepare for the next stage of the activity flow.",
    agenda: [
      "Company introduction and role overview",
      "Project expectation and participation rules",
      "Q&A with the host team",
      "Check-in and attendance confirmation",
    ],
    qrCode: "MEETING-QR-2026-001",
    rewardSkills: [
      { id: "skill-1", skillName: "Communication", level: "Applying", percentText: "40%" },
      { id: "skill-2", skillName: "Professional Etiquette", level: "Understanding", percentText: "30%" },
      { id: "skill-3", skillName: "Collaboration", level: "Applying", percentText: "30%" },
    ],
    progress: {
      attendanceMarked: false,
      isVerified: false,
      checkedInAt: "27 Jan 2026",
      score: 100,
      xpEarned: 60,
    },
  },
  {
    id: "meeting-nextgen-review",
    title: "NextGen Developer Review",
    organization: "Limbus Company",
    dueDate: "28 Jan 2026",
    startTime: "15:00",
    endTime: "17:00",
    type: "Meeting",
    format: "On-site",
    location: "Limbus Company Innovation Lab, Room 4A",
    speaker: "Technical Mentor Team",
    description:
      "A follow-up review meeting where students discuss the first activity stage, share early progress, and receive structured feedback from the organization.",
    agenda: [
      "Progress sharing by students",
      "Review of common issues and blockers",
      "Feedback from the mentor team",
      "Next action plan for the remaining work",
    ],
    qrCode: "MEETING-QR-2026-002",
    rewardSkills: [
      { id: "skill-1", skillName: "Feedback Handling", level: "Applying", percentText: "35%" },
      { id: "skill-2", skillName: "Communication", level: "Applying", percentText: "35%" },
      { id: "skill-3", skillName: "Reflection", level: "Understanding", percentText: "30%" },
    ],
    progress: {
      attendanceMarked: true,
      isVerified: true,
      checkedInAt: "28 Jan 2026",
      score: 98,
      xpEarned: 70,
    },
  },
  {
    id: "meeting-cyber-threat-modeling",
    title: "Cyber Threat Modeling Session",
    organization: "CyberIndustries",
    dueDate: "02 Feb 2026",
    startTime: "10:00",
    endTime: "12:30",
    type: "Meeting",
    format: "Online",
    location: "Google Meet",
    speaker: "Security Architecture Lead",
    description:
      "Students review a guided threat modeling example and discuss how to identify likely risks, affected assets, and the first mitigation priorities.",
    agenda: [
      "Threat modeling overview",
      "Guided scenario walkthrough",
      "Risk identification practice",
      "Discussion on mitigation priorities",
    ],
    qrCode: "MEETING-QR-2026-003",
    rewardSkills: [
      { id: "skill-1", skillName: "Security Awareness", level: "Understanding", percentText: "40%" },
      { id: "skill-2", skillName: "Analysis", level: "Applying", percentText: "35%" },
      { id: "skill-3", skillName: "Discussion", level: "Applying", percentText: "25%" },
    ],
    progress: {
      attendanceMarked: false,
      isVerified: false,
      checkedInAt: "02 Feb 2026",
      score: 100,
      xpEarned: 65,
    },
  },
  {
    id: "meeting-weekly-standup",
    title: "Weekly Standup",
    organization: "BlueTechnologies",
    dueDate: "06 Feb 2026",
    startTime: "09:30",
    endTime: "10:00",
    type: "Meeting",
    format: "Online",
    location: "Microsoft Teams",
    speaker: "Project Coordinator",
    description:
      "A short weekly synchronization meeting used to update the team, surface blockers, and confirm the next focus for the current activity week.",
    agenda: [
      "What was completed this week",
      "Current blockers or risks",
      "Team dependency check",
      "Next week priorities",
    ],
    qrCode: "MEETING-QR-2026-004",
    rewardSkills: [
      { id: "skill-1", skillName: "Team Communication", level: "Applying", percentText: "40%" },
      { id: "skill-2", skillName: "Accountability", level: "Understanding", percentText: "30%" },
      { id: "skill-3", skillName: "Planning", level: "Understanding", percentText: "30%" },
    ],
    progress: {
      attendanceMarked: true,
      isVerified: true,
      checkedInAt: "06 Feb 2026",
      score: 100,
      xpEarned: 50,
    },
  },
  {
    id: "meeting-design-critique",
    title: "Design Critique Meeting",
    organization: "PeakSystems",
    dueDate: "12 Feb 2026",
    startTime: "14:00",
    endTime: "15:30",
    type: "Meeting",
    format: "On-site",
    location: "PeakSystems Studio, Floor 2",
    speaker: "Senior Product Designer",
    description:
      "Students present the current design direction, explain their decisions, and receive comments focused on usability, hierarchy, and clarity.",
    agenda: [
      "Design presentation by students",
      "Critique from the product team",
      "Discussion on improvement priorities",
      "Summary and next revision plan",
    ],
    qrCode: "MEETING-QR-2026-005",
    rewardSkills: [
      { id: "skill-1", skillName: "Presentation", level: "Applying", percentText: "35%" },
      { id: "skill-2", skillName: "Feedback Handling", level: "Applying", percentText: "35%" },
      { id: "skill-3", skillName: "Design Communication", level: "Understanding", percentText: "30%" },
    ],
    progress: {
      attendanceMarked: false,
      isVerified: false,
      checkedInAt: "12 Feb 2026",
      score: 100,
      xpEarned: 55,
    },
  },
];

const QR_SIZE = 21;

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

function isInsideFinder(row: number, col: number, size: number) {
  const topLeft = row < 7 && col < 7;
  const topRight = row < 7 && col >= size - 7;
  const bottomLeft = row >= size - 7 && col < 7;
  return topLeft || topRight || bottomLeft;
}

function isFinderDark(row: number, col: number, size: number) {
  let localRow = row;
  let localCol = col;

  if (row < 7 && col >= size - 7) {
    localCol = col - (size - 7);
  } else if (row >= size - 7 && col < 7) {
    localRow = row - (size - 7);
  }

  const isOuter = localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6;
  const isCenter = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4;
  return isOuter || isCenter;
}

function getQrCellIsDark(row: number, col: number, size: number) {
  if (isInsideFinder(row, col, size)) {
    return isFinderDark(row, col, size);
  }

  const isTimingRow = row === 6 && col > 7 && col < size - 8;
  const isTimingCol = col === 6 && row > 7 && row < size - 8;

  if (isTimingRow || isTimingCol) {
    return (row + col) % 2 === 0;
  }

  const seed = (row * 11 + col * 17 + row * col) % 7;
  return seed === 0 || seed === 1 || ((row + col) % 5 === 0 && row % 2 === 0);
}

function QrPreview({ value }: { value: string }) {
  const qrCells = useMemo(() => {
    return Array.from({ length: QR_SIZE * QR_SIZE }, (_, index) => {
      const row = Math.floor(index / QR_SIZE);
      const col = index % QR_SIZE;
      return {
        key: `${row}-${col}`,
        isDark: getQrCellIsDark(row, col, QR_SIZE),
      };
    });
  }, []);

  return (
    <div className={styles.qrCard}>
      <div className={styles.qrFrame}>
        <div className={styles.qrGrid} aria-label="Generated meeting QR code">
          {qrCells.map((cell) => (
            <span
              key={cell.key}
              className={`${styles.qrCell} ${cell.isDark ? styles.qrCellDark : ""}`}
            />
          ))}
        </div>
      </div>
      <div className={styles.qrLabel}>Meeting QR Code</div>
      <div className={styles.qrValue}>{value}</div>
    </div>
  );
}

export default function ActivityMeetingProgress() {
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId") || MEETING_ACTIVITIES[0].id;

  const selectedMeeting =
    MEETING_ACTIVITIES.find((item) => item.id === activityId) || MEETING_ACTIVITIES[0];

  const meetingStatus: MeetingStatus =
    selectedMeeting.progress.attendanceMarked && selectedMeeting.progress.isVerified
      ? "complete"
      : "incomplete";

  const metaItems = useMemo<MetaItem[]>(
    () => [
      { label: "Organization", value: selectedMeeting.organization },
      { label: "Due date", value: selectedMeeting.dueDate },
      { label: "Type", value: selectedMeeting.type },
      { label: "Format", value: selectedMeeting.format },
      { label: "Time", value: `${selectedMeeting.startTime} - ${selectedMeeting.endTime}` },
      { label: "Status", value: meetingStatus === "complete" ? "Complete" : "Incomplete" },
    ],
    [meetingStatus, selectedMeeting]
  );

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <section className={`${styles.panel} ${styles.summaryPanel}`}>
          <div className={styles.topRow}>
            <div>
              <div className={styles.eyebrow}>Student Activity</div>
              <h1 className={styles.title}>{selectedMeeting.title}</h1>
            </div>

            <div className={styles.headerActions}>
              <StatusPill status={meetingStatus} />
              <Link href="/student/activities/overview" className={styles.backButton}>
                Back
              </Link>
            </div>
          </div>

          <p className={styles.description}>{selectedMeeting.description}</p>

          <div className={styles.metaGrid}>
            {metaItems.map((item) => (
              <div key={item.label} className={styles.metaCard}>
                <div className={styles.metaLabel}>{item.label}</div>
                <div className={styles.metaValue}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className={styles.rewardSkillsSection}>
            <div className={styles.rewardSkillsTitle}>Skills you will receive</div>
            <div className={styles.rewardSkillsList}>
              {selectedMeeting.rewardSkills.map((skill) => (
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
            <div className={styles.detailValue}>{selectedMeeting.speaker}</div>
          </div>

          <div className={styles.detailRow}>
            <div className={styles.detailLabel}>Location</div>
            <div className={styles.detailValue}>{selectedMeeting.location}</div>
          </div>

          <div className={styles.sectionDivider} />

          <div className={styles.sectionTitle}>Agenda</div>
          <ul className={styles.agendaList}>
            {selectedMeeting.agenda.map((item) => (
              <li key={item} className={styles.agendaItem}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.column}>
        {meetingStatus === "complete" ? (
          <section className={`${styles.panel} ${styles.successPanel}`}>
            <div className={styles.successTitle}>Congratulations !!!</div>
            <div className={styles.successMetaRow}>
              <span>Checked in: {selectedMeeting.progress.checkedInAt}</span>
              <span>Score: {selectedMeeting.progress.score}</span>
              <span>XP: +{selectedMeeting.progress.xpEarned}</span>
            </div>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.qrPanel}`}>
          <div className={styles.sectionTitle}>Meeting QR Code</div>
          <QrPreview value={selectedMeeting.qrCode} />
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