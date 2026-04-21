"use client";

import { useMemo, useState, useEffect } from "react";
import styles from "./ActivityDashboard.module.css";
import Link from "next/link";
import StudentCalendar, {
  type StudentCalendarSiteEvent,
} from "@/components/shared/student/StudentCalendar";
import AllActivities from "./overview/overview";

type StatCard = {
  label: string;
  value: number;
  breakdown: { label: string; value: number }[];
};

type Skill = {
  id: string;
  name: string;
  level: number;
  bloomPhase: string;
  fillPercent: number;
};

const BLOOM_PHASE_LABELS: Record<number, string> = {
  1: "Remember",
  2: "Understand",
  3: "Apply",
  4: "Analyze",
  5: "Evaluate",
  6: "Create",
};

type Company = {
  id: string;
  name: string;
  subtitle: string;
  logoText: string;
  accent: string;
  logoUrl: string;
};

const CHALLENGE_DETAIL_PATH = "/student/activities/challenge-progress";
const COURSE_DETAIL_PATH = "/student/activities/course-progress";
const MEETING_DETAIL_PATH = "/student/activities/meeting-progress";

type ActivityRow = {
  id: string;
  activity_name: string;
  difficulty: string;
  activity_type: string;
  hours: number;
  status: string;
  detailPath: string;
  organization: string;
};

const STATS: StatCard[] = [];
const ACCENTS = ["#efc36f", "#f28c28", "#4e86ff", "#9acb7d", "#f7aa8d"];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function toNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeType(activity: any) {
  const raw = String(
    activity?.ActivityType ||
    activity?.Activity_type ||
    activity?.activity_type ||
    "course"
  ).toLowerCase();

  if (["challenge", "course", "meeting"].includes(raw)) return raw;
  return "course";
}

function normalizeActivityId(activity: any, index: number) {
  return (
    activity?.ActivityID ||
    activity?.Activity_id ||
    activity?.activity_id ||
    activity?.activityId ||
    `act-${index}`
  );
}

function normalizeOrgId(activity: any) {
  return (
    activity?.CreatorOrgID ||
    activity?.Creator_org_id ||
    activity?.creator_org_id ||
    activity?.org_id ||
    activity?.OrgID ||
    ""
  );
}

function normalizeActivityStatus(activity: any) {
  const raw = String(
    activity?.submission_status ||
    activity?.SubmissionStatus ||
    activity?.status ||
    activity?.Status ||
    ""
  ).toLowerCase();

  if (raw === "completed" || raw === "complete") return "Completed";
  if (raw === "submitted") return "Submitted";
  if (raw === "incomplete" || raw === "failed" || raw === "fail") {
    return "Incomplete";
  }
  return "In progress";
}

function buildOrgMap(orgList: any[]) {
  return new Map(
    orgList.map((org: any) => [
      String(org?.org_id || org?.OrgID || org?.id || ""),
      org,
    ])
  );
}

function pickOrganizationBio(org: any) {
  return String(
    org?.about_org ||
    org?.org_profile ||
    org?.org_bio ||
    org?.bio ||
    org?.org_description ||
    org?.description ||
    ""
  ).trim();
}

const ASSETS_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_ASSETS_PUBLIC_BASE ||
  "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com";

function toPublicAssetUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) return raw;

  return `${ASSETS_PUBLIC_BASE.replace(/\/$/, "")}/${raw.replace(/^\/+/, "")}`;
}

function pickOrganizationLogo(org: any) {
  return toPublicAssetUrl(
    org?.logo ||
    org?.org_logo ||
    org?.org_logo_url ||
    org?.logo_url ||
    org?.profile_image_url ||
    org?.image_url ||
    ""
  );
}

function getActivityIdForStats(activity: any, index: number) {
  return String(
    activity?.ActivityID ||
    activity?.Activity_id ||
    activity?.activity_id ||
    activity?.activityId ||
    `act-${index}`
  );
}

function getActivityStatusForStats(activity: any) {
  return String(
    activity?.submission_status ||
    activity?.SubmissionStatus ||
    activity?.status ||
    activity?.Status ||
    ""
  ).toLowerCase();
}

function getActivityTypeForStats(activity: any) {
  return String(
    activity?.ActivityType ||
    activity?.Activity_type ||
    activity?.activity_type ||
    "other"
  ).toLowerCase();
}

function getStatusRank(status: string) {
  if (status === "completed" || status === "complete") return 5;
  if (status === "submitted") return 4;
  if (status === "in progress" || status === "in_progress") return 3;
  if (status === "failed" || status === "fail" || status === "incomplete") {
    return 2;
  }
  return 1;
}

export default function ActivityDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/student/activitystats", {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.message || "Failed to load activity stats");
        }

        setData(json.data);
      } catch (err: any) {
        console.error("Failed to load activity stats", err);
        setError(err?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const stats = useMemo(() => {
    if (!data) return STATS;

    const rawList: any[] = Array.isArray(data?.all_activities)
      ? data.all_activities
      : [];

    const uniqueMap = new Map<string, any>();

    rawList.forEach((activity: any, index: number) => {
      const id = getActivityIdForStats(activity, index);
      const currentStatus = getActivityStatusForStats(activity);

      if (!uniqueMap.has(id)) {
        uniqueMap.set(id, activity);
        return;
      }

      const existing = uniqueMap.get(id);
      const existingStatus = getActivityStatusForStats(existing);

      if (getStatusRank(currentStatus) >= getStatusRank(existingStatus)) {
        uniqueMap.set(id, activity);
      }
    });

    const allList = Array.from(uniqueMap.values());
    const total = allList.length;

    const completedList = allList.filter((a: any) => {
      const s = getActivityStatusForStats(a);
      return s === "completed" || s === "complete";
    });

    const failedList = allList.filter((a: any) => {
      const s = getActivityStatusForStats(a);
      return s === "failed" || s === "fail" || s === "incomplete";
    });

    const submittedList = allList.filter((a: any) => {
      const s = getActivityStatusForStats(a);
      return s === "submitted";
    });

    const inProgressList = allList.filter((a: any) => {
      const s = getActivityStatusForStats(a);
      return ![
        "completed",
        "complete",
        "failed",
        "fail",
        "incomplete",
        "submitted",
      ].includes(s);
    });

    function breakdownByType(list: any[]) {
      const map: Record<string, number> = {};

      list.forEach((a: any) => {
        const type = getActivityTypeForStats(a);
        map[type] = (map[type] || 0) + 1;
      });

      const entries = Object.entries(map).map(([label, value]) => ({
        label,
        value,
      }));

      return entries.length ? entries : [{ label: "N/A", value: 0 }];
    }

    const inProgressCount = inProgressList.length + submittedList.length;

    return [
      {
        label: "Totals",
        value: total,
        breakdown: breakdownByType(allList),
      },
      {
        label: "Success",
        value: completedList.length,
        breakdown: breakdownByType(completedList),
      },
      {
        label: "In progress",
        value: inProgressCount,
        breakdown: breakdownByType([...inProgressList, ...submittedList]),
      },
      {
        label: "Unsuccessful",
        value: failedList.length,
        breakdown: breakdownByType(failedList),
      },
    ];
  }, [data]);

  const skills = useMemo(() => {
    const list: any[] = Array.isArray(data?.skill_levels)
      ? data.skill_levels
      : [];

    return list.map((s: any, i: number) => {
      const rawLevel = toNumber(
        s?.skill_level ?? s?.bloom_level ?? s?.level,
        1
      );

      const level = Math.min(6, Math.max(1, Math.round(rawLevel)));

      return {
        id: String(s?.skill_id || `s${i}`),
        name: String(s?.skill_name || "Unknown"),
        level,
        bloomPhase: BLOOM_PHASE_LABELS[level] || "Unknown",
        fillPercent: (level / 6) * 100,
      };
    });
  }, [data]);

  const companies = useMemo(() => {
    const orgList: any[] = Array.isArray(data?.org_list) ? data.org_list : [];
    const allActivities: any[] = Array.isArray(data?.all_activities)
      ? data.all_activities
      : [];

    const activityOrgIds = new Set(
      allActivities
        .map((activity: any) => String(normalizeOrgId(activity)))
        .filter(Boolean)
    );

    const unique = new Map<string, Company>();

    orgList.forEach((org: any, index: number) => {
      const orgId = String(org?.org_id || org?.OrgID || org?.id || "");
      if (!orgId) return;
      if (activityOrgIds.size > 0 && !activityOrgIds.has(orgId)) return;
      if (unique.has(orgId)) return;

      const name = String(org?.org_name || "Unknown");
      const subtitle = pickOrganizationBio(org);
      const logoUrl = pickOrganizationLogo(org);

      unique.set(orgId, {
        id: orgId,
        name,
        subtitle,
        logoText: name.substring(0, 2).toUpperCase(),
        accent: ACCENTS[index % ACCENTS.length],
        logoUrl,
      });
    });

    if (unique.size === 0) {
      allActivities.forEach((activity: any, index: number) => {
        const orgName = String(activity?.organization || "").trim();
        if (!orgName) return;

        const orgId = String(normalizeOrgId(activity) || `fallback-org-${index}`);
        if (unique.has(orgId)) return;

        unique.set(orgId, {
          id: orgId,
          name: orgName,
          subtitle: "",
          logoText: orgName.substring(0, 2).toUpperCase(),
          accent: ACCENTS[index % ACCENTS.length],
          logoUrl: "",
        });
      });
    }

    return Array.from(unique.values());
  }, [data]);

  const siteEvents = useMemo<StudentCalendarSiteEvent[]>(() => {
    const schedules: any[] = Array.isArray(data?.schedules) ? data.schedules : [];
    const colors = ["blue", "yellow", "pink", "orange"] as const;

    return schedules.map((s: any, i: number) => ({
      id: String(s?.activity_id || s?.ActivityID || `evt-${i}`),
      title: String(s?.activity_name || "Scheduled Event"),
      startAt: s?.run_start_at || s?.RunStartAt || new Date().toISOString(),
      calendarColor: colors[i % colors.length],
    }));
  }, [data]);

  const activities = useMemo(() => {
    const list: any[] = Array.isArray(data?.all_activities)
      ? data.all_activities
      : [];
    if (list.length === 0) return [];

    const seen = new Set<string>();
    const orgMap = buildOrgMap(Array.isArray(data?.org_list) ? data.org_list : []);

    return list
      .filter((a: any, i: number) => {
        const id = String(normalizeActivityId(a, i));
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((a: any, i: number) => {
        const type = normalizeType(a);

        let detailPath = COURSE_DETAIL_PATH;
        if (type === "challenge") detailPath = CHALLENGE_DETAIL_PATH;
        if (type === "meeting") detailPath = MEETING_DETAIL_PATH;

        const orgId = String(normalizeOrgId(a));
        const org = orgMap.get(orgId);

        return {
          id: String(normalizeActivityId(a, i)),
          activity_name: String(
            a?.ActivityName || a?.Activity_name || a?.activity_name || "Activity"
          ),
          difficulty: "—",
          activity_type: type,
          hours: toNumber(a?.Hours ?? a?.hours, 0),
          status: normalizeActivityStatus(a),
          detailPath,
          organization: org?.org_name || a?.organization || "—",
        };
      });
  }, [data]);

  if (loading) {
    return (
      <div className={styles.dash}>
        <div style={{ padding: 24 }}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dash}>
        <div style={{ padding: 24, color: "#b42318" }}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.dash}>
      <div className={styles.leftRail}>
        <StatSummary stats={stats} />
        <SkillProgressGraph skills={skills} />
        <ActivityOverviewTable activities={activities} />
      </div>

      <div className={styles.rightRail}>
        <CompanyPanel companies={companies} />
        <StudentCalendar siteEvents={siteEvents} />
      </div>
    </div>
  );
}

function StatSummary({ stats }: { stats: StatCard[] }) {
  return (
    <section className={styles.statsShell}>
      <div className={styles.statsGrid}>
        {stats.map((card, index) => (
          <div key={card.label} className={styles.statWrap}>
            <article className={styles.statCard}>
              <div className={styles.statValue}>{card.value}</div>
              <div className={styles.statLabel}>{card.label}</div>

              <div className={styles.statBottom}>
                {card.breakdown.map((item) => (
                  <div key={item.label} className={styles.statBottomCol}>
                    <div className={styles.statBreakdownLabel}>{item.label}</div>
                    <div className={styles.statBreakdownValue}>{item.value}</div>
                  </div>
                ))}
              </div>
            </article>

            {index < stats.length - 1 && <div className={styles.statDivider} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillProgressGraph({ skills }: { skills: Skill[] }) {
  return (
    <section className={styles.skillCard}>
      <div className={styles.skillHead}>
        <div className={styles.skillTitle}>Skill Progress graph</div>
      </div>

      <div className={styles.skillViewport}>
        {skills.length === 0 ? (
          <div style={{ padding: "20px 0", fontSize: 13, color: "#888" }}>
            No skill progress data yet.
          </div>
        ) : (
          <div
            className={styles.skillScroll}
            role="region"
            aria-label="Skill progress list"
          >
            <div className={styles.skillRow}>
              {skills.map((skill, i) => (
                <div key={skill.id} className={styles.skillCol}>
                  <div className={styles.skillPct}>Level {skill.level}</div>
                  <div className={styles.skillPhase}>{skill.bloomPhase}</div>

                  <div className={styles.skillTube}>
                    <div
                      className={cx(
                        styles.skillFill,
                        i % 16 === 0 && styles.trackGreenWide,
                        i % 16 === 1 && styles.trackPink,
                        i % 16 === 2 && styles.trackYellow,
                        i % 16 === 3 && styles.trackGreen,
                        i % 16 === 4 && styles.trackSoftPink,
                        i % 16 === 5 && styles.trackBlue,
                        i % 16 === 6 && styles.trackOrange,
                        i % 16 === 7 && styles.trackRose,
                        i % 16 === 8 && styles.trackSoftPink,
                        i % 16 === 9 && styles.trackBlue,
                        i % 16 === 10 && styles.trackOrange,
                        i % 16 === 11 && styles.trackRose,
                        i % 16 === 12 && styles.trackSoftPink,
                        i % 16 === 13 && styles.trackBlue,
                        i % 16 === 14 && styles.trackOrange,
                        i % 16 === 15 && styles.trackRose
                      )}
                      style={{ height: `${skill.fillPercent}%` }}
                    />
                  </div>

                  <div
                    className={styles.skillLabel}
                    title={`${skill.name} - Level ${skill.level} (${skill.bloomPhase})`}
                  >
                    {skill.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CompanyLogo({
  company,
}: {
  company: Company;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (company.logoUrl && !imageFailed) {
    return (
      <div
        className={styles.companyLogo}
        style={{ borderColor: company.accent }}
      >
        <div className={styles.companyLogoFrame}>
          <img
            src={company.logoUrl}
            alt={company.name}
            className={styles.companyLogoImg}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.companyLogo}
      style={{ borderColor: company.accent }}
    >
      <div
        className={styles.companyLogoInner}
        style={{ background: company.accent }}
      >
        {company.logoText}
      </div>
    </div>
  );
}

function CompanyPanel({ companies }: { companies: Company[] }) {
  return (
    <section className={styles.companyCard}>
      <div className={styles.companyHead}>
        <div className={styles.sectionTitle}>Participating organizations</div>
      </div>

      <div className={styles.companyList}>
        {companies.length === 0 ? (
          <div style={{ padding: "8px 0", fontSize: 13, color: "#888" }}>
            No organizations found.
          </div>
        ) : (
          companies.map((company) => (
            <div key={company.id} className={styles.companyItem}>
              <CompanyLogo company={company} />

              <div className={styles.companyInfo}>
                <div className={styles.companyName}>{company.name}</div>
                <div className={styles.companySubtitle}>
                  {company.subtitle || "No organization bio"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ActivityOverviewTable({ activities }: { activities: ActivityRow[] }) {
  function statusPillClass(status: string) {
    const s = status.toLowerCase();
    if (s === "completed" || s === "complete") return styles.statusPillJoin;
    if (s === "submitted" || s === "in progress") return styles.statusPillPending;
    return styles.statusPillEnded;
  }

  return (
    <section className={styles.activityCard}>
      <div className={styles.activityHead}>
        <div className={styles.activityTitle}>Activity Overview</div>
      </div>

      <div className={styles.activityScrollArea}>
        <div className={styles.activityTable}>
          {activities.length === 0 ? (
            <div
              style={{
                padding: "16px 0",
                fontSize: 13,
                color: "#888",
                textAlign: "center",
              }}
            >
              No activities yet.
            </div>
          ) : (
            activities.map((row) => (
              <Link
                key={row.id}
                href={`${row.detailPath}?activityId=${row.id}`}
                className={styles.activityRowLink}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <article className={styles.activityRow}>
                  <div className={styles.activityRowBg} />

                  <div className={styles.activityIconCell} aria-hidden>
                    <img
                      src="/images/icons/jigsaw-icon.png"
                      alt=""
                      className={styles.activityBadgeImgFull}
                    />
                  </div>

                  <div className={styles.activityTitleCell}>
                    <div className={styles.activityName}>{row.activity_name}</div>
                  </div>

                  <div className={styles.activityMetaCol}>
                    <div className={styles.activityMetaLabel}>Category</div>
                    <div className={styles.activityMetaValue}>
                      {row.activity_type}
                    </div>
                  </div>

                  <div className={styles.activityMetaCol}>
                    <div className={styles.activityMetaLabel}>Hours</div>
                    <div className={styles.activityMetaValue}>{row.hours}</div>
                  </div>

                  <div className={styles.activityStatusCol}>
                    <div
                      className={`${styles.statusPill} ${statusPillClass(
                        row.status
                      )}`}
                    >
                      {row.status}
                    </div>
                  </div>

                  <div className={styles.activityDivider1} />
                  <div className={styles.activityDivider2} />
                  <div className={styles.activityDivider3} />
                  <div className={styles.activityDivider4} />
                </article>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}