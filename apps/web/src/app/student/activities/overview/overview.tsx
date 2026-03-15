import Link from "next/link";
import styles from "./overview.module.css";

type ActivityItem = {
    id: number;
    title: string;
    organization: string;
    dueDate: string;
    status: "Incomplete" | "Complete" | "In progress";
    type: "Challenge" | "Course" | "Meeting";
};

const ALL_ACTIVITIES: ActivityItem[] = [
    { id: 1, title: "Build Calculator with Python", organization: "Limbus Company", dueDate: "25 Jan 2026", status: "Incomplete", type: "Challenge" },
    { id: 2, title: "Build Calculator with C++", organization: "Limbus Company", dueDate: "25 Jan 2026", status: "Complete", type: "Challenge" },
    { id: 3, title: "NextGen Developer Kickoff", organization: "Limbus Company", dueDate: "25 Jan 2026", status: "Incomplete", type: "Meeting" },
    { id: 4, title: "NextGen Developer Review", organization: "Limbus Company", dueDate: "26 Jan 2026", status: "Complete", type: "Meeting" },
    { id: 5, title: "Basic Python", organization: "Limbus Company", dueDate: "27 Jan 2026", status: "Incomplete", type: "Course" },
    { id: 6, title: "Basic Python - Quiz", organization: "Limbus Company", dueDate: "28 Jan 2026", status: "Complete", type: "Course" },
    { id: 7, title: "Responsive Web Page Workshop", organization: "PeakSystems", dueDate: "29 Jan 2026", status: "In progress", type: "Challenge" },
    { id: 8, title: "UI Layout Explanation Task", organization: "BlueTechnologies", dueDate: "30 Jan 2026", status: "Complete", type: "Course" },
    { id: 9, title: "Frontend Basics & Web Terminology Quiz", organization: "NextDynamics", dueDate: "01 Feb 2026", status: "Complete", type: "Course" },
    { id: 10, title: "Cyber Threat Modeling Session", organization: "CyberIndustries", dueDate: "02 Feb 2026", status: "Incomplete", type: "Meeting" },
    { id: 11, title: "Cloud Fundamentals", organization: "TechIndustries", dueDate: "03 Feb 2026", status: "In progress", type: "Course" },
    { id: 12, title: "Performance Analysis Case", organization: "PeakSystems", dueDate: "05 Feb 2026", status: "Incomplete", type: "Challenge" },
    { id: 13, title: "Weekly Standup", organization: "BlueTechnologies", dueDate: "06 Feb 2026", status: "Complete", type: "Meeting" },
    { id: 14, title: "API Integration Practice", organization: "NextDynamics", dueDate: "08 Feb 2026", status: "In progress", type: "Challenge" },
    { id: 15, title: "SQL Basics", organization: "TechIndustries", dueDate: "10 Feb 2026", status: "Complete", type: "Course" },
    { id: 16, title: "Design Critique Meeting", organization: "PeakSystems", dueDate: "12 Feb 2026", status: "Incomplete", type: "Meeting" },
    { id: 17, title: "React Component Lab", organization: "BlueTechnologies", dueDate: "13 Feb 2026", status: "Complete", type: "Challenge" },
    { id: 18, title: "Git Collaboration", organization: "NextDynamics", dueDate: "15 Feb 2026", status: "In progress", type: "Course" },
];

function statusClass(
    status: ActivityItem["status"],
    stylesObj: typeof styles
) {
    if (status === "Complete") return stylesObj.statusComplete;
    if (status === "In progress") return stylesObj.statusProgress;
    return stylesObj.statusIncomplete;
}

export default function AllActivities() {
    return (
        <div className={styles.panel}>
            <div className={styles.headerRow}>
                <div>
                    <div className={styles.pageTitle}>All Activities</div>
                    <div className={styles.pageSubTitle}>
                        Mock data for challenge, course, and meeting activities
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
                        <input className={styles.filterInput} placeholder="Name" />
                    </div>

                    <div className={styles.dateFields}>
                        <input className={styles.filterInputSmall} placeholder="From Date" />
                        <span className={styles.dateDash}>-</span>
                        <input className={styles.filterInputSmall} placeholder="To Date" />
                    </div>

                    <div className={styles.organizationField}>
                        <select className={styles.filterSelect}>
                            <option>Organization</option>
                        </select>
                        <span className={styles.selectArrow}>V</span>
                    </div>

                    <div className={styles.typeField}>
                        <select className={styles.filterSelect}>
                            <option>Type</option>
                        </select>
                        <span className={styles.selectArrow}>V</span>
                    </div>

                    <div className={styles.statusField}>
                        <select className={styles.filterSelect}>
                            <option>Status</option>
                        </select>
                        <span className={styles.selectArrow}>V</span>
                    </div>

                    <button type="button" className={styles.searchButton}>
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
                    {ALL_ACTIVITIES.map((item) => (
                        <div key={item.id} className={styles.tableRow}>
                            <div className={styles.numCell}>{item.id}</div>
                            <div className={styles.activityCell}>{item.title}</div>
                            <div>{item.organization}</div>
                            <div>{item.dueDate}</div>
                            <div>
                                <span className={`${styles.statusBadge} ${statusClass(item.status, styles)}`}>
                                    {item.status}
                                </span>
                            </div>
                            <div>{item.type}</div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}