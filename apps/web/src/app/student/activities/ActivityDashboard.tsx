"use client";

import { useMemo } from "react";
import styles from "./ActivityDashboard.module.css";
import Link from "next/link";
import StudentCalendar, {
    type StudentCalendarSiteEvent,
} from "@/components/shared/student/StudentCalendar";

type StatCard = {
    label: string;
    value: number;
    breakdown: { label: string; value: number }[];
};

type Skill = { id: string; name: string; percent: number };

type Company = {
    id: string;
    name: string;
    subtitle: string;
    logoText: string;
    accent: string;
};

type ActivityRow = {
    id: string;
    title: string;
    difficulty: string;
    category: string;
    xp: number;
    status: "can join" | "ended" | "pending";
};


const STATS: StatCard[] = [
    {
        label: "Totals",
        value: 15,
        breakdown: [
            { label: "course", value: 3 },
            { label: "task", value: 8 },
            { label: "meeting", value: 4 },
        ],
    },
    {
        label: "Success",
        value: 3,
        breakdown: [
            { label: "course", value: 0 },
            { label: "task", value: 3 },
            { label: "meeting", value: 0 },
        ],
    },
    {
        label: "In progress",
        value: 11,
        breakdown: [
            { label: "course", value: 3 },
            { label: "task", value: 5 },
            { label: "meeting", value: 4 },
        ],
    },
    {
        label: "Unsuccessful",
        value: 1,
        breakdown: [
            { label: "course", value: 0 },
            { label: "task", value: 0 },
            { label: "meeting", value: 0 },
        ],
    },
];

const MOCK_SKILLS: Skill[] = [
    { id: "s1", name: "HTML", percent: 85 },
    { id: "s2", name: "CSS", percent: 70 },
    { id: "s3", name: "JavaScript", percent: 55 },
    { id: "s4", name: "React", percent: 42 },
    { id: "s5", name: "TypeScript", percent: 35 },
    { id: "s6", name: "UI/UX", percent: 60 },
    { id: "s7", name: "Git", percent: 50 },
    { id: "s8", name: "API", percent: 40 },
    { id: "s9", name: "Testing", percent: 25 },
    { id: "s10", name: "SQL", percent: 45 },
    { id: "s11", name: "Cloud", percent: 20 },
    { id: "s12", name: "Soft Skills", percent: 65 },
    { id: "s13", name: "TypeScript", percent: 35 },
    { id: "s14", name: "UI/UX", percent: 60 },
    { id: "s15", name: "Git", percent: 50 },
    { id: "s16", name: "API", percent: 40 },
];

const COMPANIES: Company[] = [
    { id: "c1", name: "NextDynamics", subtitle: "Quality work requires attention to detail.", logoText: "ND", accent: "#efc36f" },
    { id: "c2", name: "BlueTechnologies", subtitle: "Knowledge grows when wisdom meets experience.", logoText: "BT", accent: "#f28c28" },
    { id: "c3", name: "TechIndustries", subtitle: "You are not too early. Strokes arrive at the right street.", logoText: "TI", accent: "#4e86ff" },
    { id: "c4", name: "CyberIndustries", subtitle: "Every challenge presents an opportunity for growth.", logoText: "CI", accent: "#9acb7d" },
    { id: "c5", name: "PeakSystems", subtitle: "Great design balances form and function.", logoText: "PS", accent: "#f7aa8d" },
    { id: "c6", name: "NextDynamics", subtitle: "Curiosity turns effort into results.", logoText: "ND", accent: "#efc36f" },
    { id: "c7", name: "CyberIndustries", subtitle: "Every challenge presents an opportunity for growth.", logoText: "CI", accent: "#9acb7d" },
    { id: "c8", name: "PeakSystems", subtitle: "Great design balances form and function.", logoText: "PS", accent: "#f7aa8d" },
    { id: "c9", name: "NextDynamics", subtitle: "Curiosity turns effort into results.", logoText: "ND", accent: "#efc36f" },
];

const MOCK_SITE_EVENTS: StudentCalendarSiteEvent[] = [
    { id: "a1", title: "Frontend Basics & Web Terminology Quiz", startAt: new Date().toISOString(), calendarColor: "blue" },
    { id: "a2", title: "UI Layout Explanation Task", startAt: new Date().toISOString(), calendarColor: "yellow" },
    { id: "a3", title: "Responsive Web Page Workshop", startAt: new Date(Date.now() + 2 * 86400000).toISOString(), calendarColor: "pink" },
    { id: "a4", title: "Frontend Performance Analysis Case", startAt: new Date(Date.now() + 5 * 86400000).toISOString(), calendarColor: "orange" },
];

const ACTIVITIES: ActivityRow [] =[
    { id: "a1", title: "Frontend Basics & Web Terminology Quiz", difficulty: "Beginner", category: "Course", xp: 20, status: "can join" },
    { id: "a2", title: "UI Layout Explanation Task", difficulty: "Beginner", category: "Course", xp: 15, status: "can join" },
    { id: "a3", title: "Responsive Web Page Workshop", difficulty: "Intermediate", category: "Challenge", xp: 50, status: "can join" },
    { id: "a4", title: "Frontend Performance Analysis Case", difficulty: "Advanced", category: "Challenge", xp: 65, status: "pending" },
];

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

export default function ActivityDashboard() {
    const skills = useMemo(() => MOCK_SKILLS, []);

    return (
        <div className={styles.dash}>
            <div className={styles.leftRail}>
                <StatSummary />
                <SkillProgressGraph skills={skills} />
                <ActivityOverviewTable />
            </div>

            <div className={styles.rightRail}>
                <CompanyPanel />
                <StudentCalendar siteEvents={MOCK_SITE_EVENTS} />
            </div>
        </div>
    );
}

function StatSummary() {
    return (
        <section className={styles.statsShell}>
            <div className={styles.statsGrid}>
                {STATS.map((card, index) => (
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

                        {index < STATS.length - 1 && <div className={styles.statDivider} />}
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
                <div className={styles.skillScroll} role="region" aria-label="Skill progress list">
                    <div className={styles.skillRow}>
                        {skills.map((skill, i) => (
                            <div key={skill.id} className={styles.skillCol}>
                                <div className={styles.skillPct}>{skill.percent}%</div>

                                <div className={styles.skillTube}>
                                    <div
                                        className={cx(
                                            styles.skillFill,
                                            i === 0 && styles.trackGreenWide,
                                            i === 1 && styles.trackPink,
                                            i === 2 && styles.trackYellow,
                                            i === 3 && styles.trackGreen,
                                            i === 4 && styles.trackSoftPink,
                                            i === 5 && styles.trackBlue,
                                            i === 6 && styles.trackOrange,
                                            i === 7 && styles.trackRose,
                                            i === 8 && styles.trackSoftPink,
                                            i === 9 && styles.trackBlue,
                                            i === 10 && styles.trackOrange,
                                            i === 11 && styles.trackRose,
                                            i === 12 && styles.trackSoftPink,
                                            i === 13 && styles.trackBlue,
                                            i === 14 && styles.trackOrange,
                                            i === 15 && styles.trackRose
                                        )}
                                        style={{ height: `${skill.percent}%` }}
                                    />
                                </div>

                                <div className={styles.skillLabel} title={skill.name}>
                                    {skill.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function CompanyPanel() {
    return (
        <section className={styles.companyCard}>
            <div className={styles.companyList}>
                {COMPANIES.map((company) => (
                    <div key={company.id} className={styles.companyItem}>
                        <div className={styles.companyLogo} style={{ borderColor: company.accent }}>
                            <div className={styles.companyLogoInner} style={{ background: company.accent }}>
                                {company.logoText}
                            </div>
                        </div>

                        <div className={styles.companyInfo}>
                            <div className={styles.companyName}>{company.name}</div>
                            <div className={styles.companySubtitle}>{company.subtitle}</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function ActivityOverviewTable() {
    return (
        <section className={styles.activityCard}>
            <div className={styles.activityHead}>
                <div className={styles.activityTitle}>Activity Overview</div>
                <Link href="/student/activities/overview" className={styles.viewAllLink}>
                    view all
                </Link>
            </div>

            <div className={styles.activityScrollArea}>
                <div className={styles.activityTable}>
                    {ACTIVITIES.map((row) => (
                        <article key={row.id} className={styles.activityRow}>
                            <div className={styles.activityRowBg} />

                            <div className={styles.activityIconCell} aria-hidden>
                                <img
                                    src="/images/icons/jigsaw-icon.png"
                                    alt=""
                                    className={styles.activityBadgeImgFull}
                                />
                            </div>

                            <div className={styles.activityTitleCell}>
                                <div className={styles.activityName}>{row.title}</div>
                            </div>

                            <div className={styles.activityMetaCol}>
                                <div className={styles.activityMetaLabel}>difficulty</div>
                                <div
                                    className={
                                        row.difficulty === "Intermediate"
                                            ? styles.activityMetaValueWide
                                            : styles.activityMetaValue
                                    }
                                >
                                    {row.difficulty}
                                </div>
                            </div>

                            <div className={styles.activityMetaCol}>
                                <div className={styles.activityMetaLabel}>Category</div>
                                <div className={styles.activityMetaValue}>{row.category}</div>
                            </div>

                            <div className={styles.activityMetaCol}>
                                <div className={styles.activityMetaLabel}>XP</div>
                                <div className={styles.activityMetaValue}>{row.xp}</div>
                            </div>

                            <div className={styles.activityStatusCol}>
                                <div
                                    className={`${styles.statusPill} ${row.status === "pending" ? styles.statusPillPending : styles.statusPillHidden
                                        }`}
                                >
                                    pending
                                </div>

                                <div
                                    className={`${styles.statusPill} ${row.status === "can join" ? styles.statusPillJoin : styles.statusPillHidden
                                        }`}
                                >
                                    Can join
                                </div>

                                <div
                                    className={`${styles.statusPill} ${row.status === "ended" ? styles.statusPillEnded : styles.statusPillHidden
                                        }`}
                                >
                                    ended
                                </div>
                            </div>

                            <div className={styles.activityDivider1} />
                            <div className={styles.activityDivider2} />
                            <div className={styles.activityDivider3} />
                            <div className={styles.activityDivider4} />
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}


