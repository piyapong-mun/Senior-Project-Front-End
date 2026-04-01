"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./overview.module.css";

type ActivityStatus = "Incomplete" | "In progress" | "Submitted" | "Complete";
type ActivityType = "Challenge" | "Course" | "Meeting";

type ActivityItem = {
  id: string;
  title: string;
  organization: string;
  dueDate: string;
  dueDateValue: string;
  status: ActivityStatus;
  type: ActivityType;
  detailPath: string;
};

type FilterState = {
  name: string;
  fromDate: string;
  toDate: string;
  organization: string;
  type: "" | ActivityType;
  status: "" | ActivityStatus;
};

const CHALLENGE_DETAIL_PATH = "/student/activities/challenge-progress";
const COURSE_DETAIL_PATH = "/student/activities/course-progress";
const MEETING_DETAIL_PATH = "/student/activities/meeting-progress";

const ALL_ACTIVITIES: ActivityItem[] = [
  {
    id: "challenge-build-calculator-python",
    title: "Build Calculator with Python",
    organization: "Limbus Company",
    dueDate: "25 Jan 2026",
    dueDateValue: "2026-01-25",
    status: "Incomplete",
    type: "Challenge",
    detailPath: CHALLENGE_DETAIL_PATH,
  },
  {
    id: "challenge-build-calculator-cpp",
    title: "Build Calculator with C++",
    organization: "Limbus Company",
    dueDate: "26 Jan 2026",
    dueDateValue: "2026-01-26",
    status: "Complete",
    type: "Challenge",
    detailPath: CHALLENGE_DETAIL_PATH,
  },
  {
    id: "meeting-nextgen-kickoff",
    title: "NextGen Developer Kickoff",
    organization: "Limbus Company",
    dueDate: "27 Jan 2026",
    dueDateValue: "2026-01-27",
    status: "Incomplete",
    type: "Meeting",
    detailPath: MEETING_DETAIL_PATH,
  },
  {
    id: "meeting-nextgen-review",
    title: "NextGen Developer Review",
    organization: "Limbus Company",
    dueDate: "28 Jan 2026",
    dueDateValue: "2026-01-28",
    status: "Complete",
    type: "Meeting",
    detailPath: MEETING_DETAIL_PATH,
  },
  {
    id: "course-basic-python",
    title: "Basic Python",
    organization: "Limbus Company",
    dueDate: "29 Jan 2026",
    dueDateValue: "2026-01-29",
    status: "In progress",
    type: "Course",
    detailPath: COURSE_DETAIL_PATH,
  },
  {
    id: "challenge-responsive-web-page",
    title: "Responsive Web Page Workshop",
    organization: "PeakSystems",
    dueDate: "30 Jan 2026",
    dueDateValue: "2026-01-30",
    status: "Submitted",
    type: "Challenge",
    detailPath: CHALLENGE_DETAIL_PATH,
  },
  {
    id: "course-ui-layout-fundamentals",
    title: "UI Layout Fundamentals",
    organization: "BlueTechnologies",
    dueDate: "31 Jan 2026",
    dueDateValue: "2026-01-31",
    status: "Complete",
    type: "Course",
    detailPath: COURSE_DETAIL_PATH,
  },
  {
    id: "course-frontend-basics",
    title: "Frontend Basics & Web Terminology",
    organization: "NextDynamics",
    dueDate: "01 Feb 2026",
    dueDateValue: "2026-02-01",
    status: "Complete",
    type: "Course",
    detailPath: COURSE_DETAIL_PATH,
  },
  {
    id: "meeting-cyber-threat-modeling",
    title: "Cyber Threat Modeling Session",
    organization: "CyberIndustries",
    dueDate: "02 Feb 2026",
    dueDateValue: "2026-02-02",
    status: "Incomplete",
    type: "Meeting",
    detailPath: MEETING_DETAIL_PATH,
  },
  {
    id: "course-cloud-fundamentals",
    title: "Cloud Fundamentals",
    organization: "TechIndustries",
    dueDate: "03 Feb 2026",
    dueDateValue: "2026-02-03",
    status: "In progress",
    type: "Course",
    detailPath: COURSE_DETAIL_PATH,
  },
  {
    id: "challenge-performance-analysis-case",
    title: "Performance Analysis Case",
    organization: "PeakSystems",
    dueDate: "05 Feb 2026",
    dueDateValue: "2026-02-05",
    status: "Incomplete",
    type: "Challenge",
    detailPath: CHALLENGE_DETAIL_PATH,
  },
  {
    id: "meeting-weekly-standup",
    title: "Weekly Standup",
    organization: "BlueTechnologies",
    dueDate: "06 Feb 2026",
    dueDateValue: "2026-02-06",
    status: "Complete",
    type: "Meeting",
    detailPath: MEETING_DETAIL_PATH,
  },
  {
    id: "challenge-api-integration-practice",
    title: "API Integration Practice",
    organization: "NextDynamics",
    dueDate: "08 Feb 2026",
    dueDateValue: "2026-02-08",
    status: "Submitted",
    type: "Challenge",
    detailPath: CHALLENGE_DETAIL_PATH,
  },
  {
    id: "course-sql-basics",
    title: "SQL Basics",
    organization: "TechIndustries",
    dueDate: "10 Feb 2026",
    dueDateValue: "2026-02-10",
    status: "Complete",
    type: "Course",
    detailPath: COURSE_DETAIL_PATH,
  },
  {
    id: "meeting-design-critique",
    title: "Design Critique Meeting",
    organization: "PeakSystems",
    dueDate: "12 Feb 2026",
    dueDateValue: "2026-02-12",
    status: "Incomplete",
    type: "Meeting",
    detailPath: MEETING_DETAIL_PATH,
  },
  {
    id: "challenge-react-component-lab",
    title: "React Component Lab",
    organization: "BlueTechnologies",
    dueDate: "13 Feb 2026",
    dueDateValue: "2026-02-13",
    status: "Complete",
    type: "Challenge",
    detailPath: CHALLENGE_DETAIL_PATH,
  },
  {
    id: "course-git-collaboration",
    title: "Git Collaboration",
    organization: "NextDynamics",
    dueDate: "15 Feb 2026",
    dueDateValue: "2026-02-15",
    status: "In progress",
    type: "Course",
    detailPath: COURSE_DETAIL_PATH,
  },
];

const EMPTY_FILTERS: FilterState = {
  name: "",
  fromDate: "",
  toDate: "",
  organization: "",
  type: "",
  status: "",
};

function statusClass(status: ActivityStatus, stylesObj: typeof styles) {
  if (status === "Complete") return stylesObj.statusComplete;
  if (status === "In progress" || status === "Submitted") return stylesObj.statusProgress;
  return stylesObj.statusIncomplete;
}

function matchesDateRange(itemDate: string, fromDate: string, toDate: string) {
  const itemTime = new Date(`${itemDate}T00:00:00`).getTime();
  const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
  const toTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

  if (fromTime !== null && itemTime < fromTime) return false;
  if (toTime !== null && itemTime > toTime) return false;
  return true;
}

function getActivityHref(item: ActivityItem) {
  return `${item.detailPath}?activityId=${item.id}`;
}

export default function AllActivities() {
  const [draftFilters, setDraftFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);

  const organizations = useMemo(
    () => Array.from(new Set(ALL_ACTIVITIES.map((item) => item.organization))),
    []
  );

  const filteredActivities = useMemo(() => {
    const keyword = appliedFilters.name.trim().toLowerCase();

    return ALL_ACTIVITIES.filter((item) => {
      const matchesName =
        !keyword ||
        item.title.toLowerCase().includes(keyword) ||
        item.organization.toLowerCase().includes(keyword);

      const matchesOrganization =
        !appliedFilters.organization || item.organization === appliedFilters.organization;

      const matchesType = !appliedFilters.type || item.type === appliedFilters.type;
      const matchesStatus = !appliedFilters.status || item.status === appliedFilters.status;
      const matchesDate = matchesDateRange(
        item.dueDateValue,
        appliedFilters.fromDate,
        appliedFilters.toDate
      );

      return (
        matchesName &&
        matchesOrganization &&
        matchesType &&
        matchesStatus &&
        matchesDate
      );
    });
  }, [appliedFilters]);

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.pageTitle}>All Activities</div>
          <div className={styles.pageSubTitle}>
            Click any activity row in overview to open its mock progress page.
          </div>
        </div>

        <Link href="/student/activities" className={styles.backButton}>
          Back
        </Link>
      </div>

      <section className={styles.filterCard}>
        <div className={styles.filterTitle}>Filter</div>

        <div className={styles.filterLayout}>
          <div className={styles.nameField}>
            <input
              className={styles.filterInput}
              placeholder="Activity or organization name"
              value={draftFilters.name}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
            />
          </div>

          <div className={styles.dateFields}>
            <input
              type="date"
              className={styles.filterInputSmall}
              value={draftFilters.fromDate}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  fromDate: event.target.value,
                }))
              }
            />
            <span className={styles.dateDash}>-</span>
            <input
              type="date"
              className={styles.filterInputSmall}
              value={draftFilters.toDate}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  toDate: event.target.value,
                }))
              }
            />
          </div>

          <div className={styles.organizationField}>
            <select
              className={styles.filterSelect}
              value={draftFilters.organization}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  organization: event.target.value,
                }))
              }
            >
              <option value="">Organization</option>
              {organizations.map((organization) => (
                <option key={organization} value={organization}>
                  {organization}
                </option>
              ))}
            </select>
            <span className={styles.selectArrow}>V</span>
          </div>

          <div className={styles.typeField}>
            <select
              className={styles.filterSelect}
              value={draftFilters.type}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  type: event.target.value as FilterState["type"],
                }))
              }
            >
              <option value="">Type</option>
              <option value="Challenge">Challenge</option>
              <option value="Course">Course</option>
              <option value="Meeting">Meeting</option>
            </select>
            <span className={styles.selectArrow}>V</span>
          </div>

          <div className={styles.statusField}>
            <select
              className={styles.filterSelect}
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  status: event.target.value as FilterState["status"],
                }))
              }
            >
              <option value="">Status</option>
              <option value="Incomplete">Incomplete</option>
              <option value="In progress">In progress</option>
              <option value="Submitted">Submitted</option>
              <option value="Complete">Complete</option>
            </select>
            <span className={styles.selectArrow}>V</span>
          </div>

          <button
            type="button"
            className={styles.searchButton}
            onClick={() => setAppliedFilters(draftFilters)}
          >
            Search
          </button>
        </div>
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div>No.</div>
          <div>Activity</div>
          <div>Organization</div>
          <div>Due Date</div>
          <div>Status</div>
          <div>Type</div>
        </div>

        <div className={styles.tableBody}>
          {filteredActivities.length > 0 ? (
            filteredActivities.map((item, index) => (
              <Link
                key={item.id}
                href={getActivityHref(item)}
                className={`${styles.tableRow} ${styles.tableRowLink}`}
              >
                <div className={styles.numCell}>{index + 1}</div>
                <div className={styles.activityCell}>{item.title}</div>
                <div>{item.organization}</div>
                <div>{item.dueDate}</div>
                <div>
                  <span className={`${styles.statusBadge} ${statusClass(item.status, styles)}`}>
                    {item.status}
                  </span>
                </div>
                <div>{item.type}</div>
              </Link>
            ))
          ) : (
            <div className={styles.emptyState}>
              No activities matched the selected filters.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}