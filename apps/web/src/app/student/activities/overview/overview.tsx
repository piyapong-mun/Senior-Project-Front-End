"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
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

// Mock data removed. Component fetches real data on mount.

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
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch activities from the Backend via proxy
  useEffect(() => {
      async function fetchActivities() {
          setLoading(true);
          try {
            // passing appliedFilters.status into body for backend
            // Alternatively, leaving it empty returns all activities and we filter client-side
            const res = await fetch("/api/student/filteractivity", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(appliedFilters) // sending it off to pass downstream options
            });

            const json = await res.json();
            if (json && json.ok) {
                // Map returned structure
                const rawList = Array.isArray(json.data) ? json.data : [];
                const mapped: ActivityItem[] = rawList.map((a: any, i: number) => {
                    // Dates typically look like 2026-01-26T... 
                    let parsedDate = "Unknown Date";
                    let parsedVal = "2099-12-31";
                    const dateField = a.run_end_at || a.runEndAt || a.enroll_end_at || "";
                    if (dateField) {
                        const dt = new Date(dateField);
                        if (!isNaN(dt.getTime())) {
                          parsedDate = dt.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
                          parsedVal = typeof dateField === 'string' ? dateField.split("T")[0] : parsedVal;
                        }
                    }
                    
                    const type: ActivityType = ["Challenge", "Course", "Meeting"].includes(a.activityType || a.activity_type) ? (a.activityType || a.activity_type) : "Course";
                    let detPath = COURSE_DETAIL_PATH;
                    if (type === "Challenge") detPath = CHALLENGE_DETAIL_PATH;
                    if (type === "Meeting") detPath = MEETING_DETAIL_PATH;

                    return {
                        id: a.activityID || a.activity_id || String(i),
                        title: a.activityName || a.activity_name || "Unknown Activity",
                        organization: a.creatorOrgID || a.creator_org_id || a.organization || "No Organization",
                        dueDate: parsedDate,
                        dueDateValue: parsedVal,
                        status: ["Incomplete", "In progress", "Submitted", "Complete"].includes(a.status) ? a.status : "Incomplete",
                        type,
                        detailPath: detPath,
                    };
                });
                setActivities(mapped);
            }
          } catch (err) {
            console.error("Filter Activity Fetch Failed:", err);
          } finally {
            setLoading(false);
          }
      }
      fetchActivities();
  }, [appliedFilters]); // Re-fetch from the proxy when user applies filters


  const organizations = useMemo(
    () => Array.from(new Set(activities.map((item) => item.organization))),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    const keyword = appliedFilters.name.trim().toLowerCase();

    return activities.filter((item) => {
      const matchesName =
        !keyword ||
        item.title.toLowerCase().includes(keyword) ||
        item.organization.toLowerCase().includes(keyword);

      const matchesOrganization =
        !appliedFilters.organization || item.organization === appliedFilters.organization;

      // The backend may have already filtered by type/status based on appliedFilters payload!
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
  }, [appliedFilters, activities]);

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
          {loading ? (
             <div className={styles.emptyState}>Loading activities...</div>
          ) : filteredActivities.length > 0 ? (
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