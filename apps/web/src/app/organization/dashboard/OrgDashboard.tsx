"use client";

import Image from "next/image";
import { Fragment, useMemo, useState, useEffect, type ChangeEvent, useCallback } from "react";
import { ORGANIZATION_SIDEBAR_ITEMS } from "@/lib/config/organization/routes";
import styles from "./OrgDashboard.module.css";

// Backend Json Type
import { OrgDashboard, EmployeeInfo, ActivityStatsInfo, SkillStatsInfo, UniversityStatsInfo, ActivityInfo, CompleteStatsInfo } from "@/app/api/org/dashboard/route";


type OrgForm = {
    orgName: string;
    companySize: string;
    businessType: string;
    location: string;
    aboutUs: string;

    logoFile: File | null;
    logoPreview: string | null;

    email: string;
    phone: string;
    website: string;

    linkedin: string;
    facebook: string;
    instagram: string;
    youtube: string;
    tiktok: string;
};

type Employee = {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    phone: string;
    email: string;
    canCheckChallenge: boolean;
    avatarIndex: number; // 0..n
};

const AVATARS = [
    "/images/avatar%20picture/avatar1.png",
    "/images/avatar%20picture/avatar2.png",
    "/images/avatar%20picture/avatar3.png",
];

const emptyEmp = (id: string): Employee => ({
    id,
    firstName: "",
    lastName: "",
    position: "",
    phone: "",
    email: "",
    canCheckChallenge: false,
    avatarIndex: 0,
});


type StatsTab = "all" | "participants" | "skills";
type ActivityFilter = "all" | "Meetings" | "Courses" | "Challenges";
type ActivityStatusTone = "pending" | "join" | "ended";

type GraphBar = {
    label: string;
    value: number;
};

type OrgActivityRow = {
    id: string;
    title: string;
    difficulty: string;
    category: string;
    kind: Exclude<ActivityFilter, "all">;
    xp: number;
    statusTone: ActivityStatusTone;
};

const PARTICIPANT_BARS: GraphBar[] = [
    { label: "Chulalongkorn\nUniversity", value: 45 },
    { label: "Thammasat\nUniversity", value: 78 },
    { label: "Kasetsart\nUniversity", value: 52 },
    { label: "KMUTNB", value: 34 },
    { label: "Mahidol\nUniversity", value: 48 },
    { label: "KMUTNB", value: 67 },
    { label: "BU", value: 55 },
];

const SKILL_BARS: GraphBar[] = [
    { label: "Data", value: 5 },
    { label: "Communication", value: 11 },
    { label: "UX/UI", value: 6 },
    { label: "Frontend", value: 9 },
    { label: "Backend", value: 8 },
];

const ORG_ACTIVITY_ROWS: OrgActivityRow[] = [
    {
        id: "a1",
        title: "Frontend Basics & Web Terminology Quiz",
        difficulty: "Beginner",
        category: "Course",
        kind: "Courses",
        xp: 20,
        statusTone: "join",
    },
    {
        id: "a2",
        title: "UI Layout Explanation Task",
        difficulty: "Beginner",
        category: "Course",
        kind: "Courses",
        xp: 15,
        statusTone: "pending",
    },
    {
        id: "a3",
        title: "Responsive Web Page Workshop",
        difficulty: "Intermediate",
        category: "Challenge",
        kind: "Challenges",
        xp: 50,
        statusTone: "join",
    },
    {
        id: "a4",
        title: "Frontend Performance Analysis Case",
        difficulty: "Advanced",
        category: "Challenge",
        kind: "Challenges",
        xp: 65,
        statusTone: "pending",
    },
    {
        id: "a5",
        title: "UX Feedback Review Meeting",
        difficulty: "Beginner",
        category: "Meeting",
        kind: "Meetings",
        xp: 10,
        statusTone: "ended",
    },
    {
        id: "a6",
        title: "Design Handoff Review Session",
        difficulty: "Intermediate",
        category: "Meeting",
        kind: "Meetings",
        xp: 18,
        statusTone: "join",
    },
];

const PARTICIPANTS = [
    {
        id: "p1",
        name: "Charlotte Garcia",
        subtitle: "Dedicated professional in marketing. Bringing fresh perspectives and committed to creating impact through thoughtful collaboration.",
        score: 45,
        avatarBg: "#f1d6d8",
        initials: "CG",
    },
    {
        id: "p2",
        name: "Emma Williams",
        subtitle: "Creative direction focused on lively ideas and execution. Committed to crafting work that feels clear, polished, and memorable.",
        score: 45,
        avatarBg: "#efd0bf",
        initials: "EW",
    },
    {
        id: "p3",
        name: "James Taylor",
        subtitle: "Results-driven professional in business development with a track record of success. Committed to building impactful solutions.",
        score: 43,
        avatarBg: "#c7dce7",
        initials: "JT",
    },
    {
        id: "p4",
        name: "Alexander Davis",
        subtitle: "Dedicated product perspective with strong collaboration skills and a practical approach to improving team outcomes.",
        score: 42,
        avatarBg: "#e5d7c8",
        initials: "AD",
    },
    {
        id: "p5",
        name: "Olivia Davis",
        subtitle: "Ideas powered by collaboration and clarity. Focused on thoughtful problem solving and steady professional growth.",
        score: 41,
        avatarBg: "#d8e7f1",
        initials: "OD",
    },
];

const MONTH_DONUT_LABELS = [
    { label: "Jan", value: 3 },
    { label: "Feb", value: 5 },
    { label: "Mar", value: 4 },
    { label: "Apr", value: 6 },
];

const TYPE_DONUT_LABELS = [
    { label: "Meetings", value: 4 },
    { label: "Courses", value: 8 },
    { label: "Challenges", value: 3 },
];

export default function OrgDashboardPage() {
    const [isEditOrgOpen, setIsEditOrgOpen] = useState(false);
    const [isSavedOpen, setIsSavedOpen] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [orgSaving, setOrgSaving] = useState(false);

    const [orgDraft, setOrgDraft] = useState<OrgForm>({
        orgName: "PeakSystems",
        companySize: "50-100 employees",
        businessType: "Technology / Software",
        location: "Philadelphia, PA",
        aboutUs:
            "Quality work requires attention to detail. The best solutions often come from collaboration. Simple ideas can have profound impacts. Every challenge presents an opportunity for growth.",
        logoFile: null,
        logoPreview: null,
        email: "emmadavis@hotmail.com",
        phone: "(746) 807-2977",
        website: "https://peaksystems.example",
        linkedin: "",
        facebook: "",
        instagram: "",
        youtube: "",
        tiktok: "",
    });

    const [summary, setSummary] = useState({
        totalActivities: 15,
        totalParticipants: 32,
        meetings: 4,
        courses: 8,
        challenges: 3,
        published: 15,
        draft: 2,
    });

    const [employees, setEmployees] = useState<Employee[]>([
        {
            id: "e1",
            firstName: "Sophia",
            lastName: "Brown",
            position: "HR",
            phone: "0812345678",
            email: "sophia@company.com",
            canCheckChallenge: true,
            avatarIndex: 0,
        },
    ]);

    const [participantRows, setParticipantRows] = useState(PARTICIPANTS);
    const [activityRows, setActivityRows] = useState<OrgActivityRow[]>(ORG_ACTIVITY_ROWS);
    const [activeEmployeeEmail, setActiveEmployeeEmail] = useState<string>("");

    const setOrgField =
        (key: keyof OrgForm) =>
            (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setOrgDraft((prev) => ({ ...prev, [key]: e.target.value }));
            };

    const [cropOpen, setCropOpen] = useState(false);
    const [cropUrl, setCropUrl] = useState<string | null>(null);
    const [cropZoom, setCropZoom] = useState(1);
    const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
    const [imgNat, setImgNat] = useState({ w: 0, h: 0 });

    const cropBoxSize = 320;

    const openLogoCrop = (e: ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        if (!f) return;

        const url = URL.createObjectURL(f);
        setCropUrl(url);
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
        setCropOpen(true);

        e.currentTarget.value = "";
    };

    const openEditOrg = () => setIsEditOrgOpen(true);
    const closeEditOrg = () => setIsEditOrgOpen(false);

    const handleSaveOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            const formData = new FormData();

            // Use Active-Account to get org_id
            const activeAccount = await fetch("/api/organization/active-account", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const activeAccountData = await activeAccount.json();
            const orgId = activeAccountData.org_id;

            formData.append("orgId", orgId);
            formData.append("orgName", orgDraft.orgName);
            formData.append("companySize", orgDraft.companySize);
            formData.append("businessType", orgDraft.businessType);
            formData.append("location", orgDraft.location);
            formData.append("aboutUs", orgDraft.aboutUs);
            formData.append("email", orgDraft.email);
            formData.append("phone", orgDraft.phone);
            formData.append("website", orgDraft.website);
            formData.append("linkedin", orgDraft.linkedin);
            formData.append("facebook", orgDraft.facebook);
            formData.append("instagram", orgDraft.instagram);
            formData.append("youtube", orgDraft.youtube);
            formData.append("tiktok", orgDraft.tiktok);

            if (orgDraft.logoFile) {
                formData.append("logoFile", orgDraft.logoFile);
            }

            const res = await fetch("/api/organization/update", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to update organization");
            }

            setIsEditOrgOpen(false);
            setIsSavedOpen(true);
            setTimeout(() => setIsSavedOpen(false), 2000);

            await fetchOrgDashboard();
        } catch (error: any) {
            setError(error.message);
        } finally {
            setSaving(false);
        }
    };

    const closeSaved = () => setIsSavedOpen(false);

    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState<Employee>(() => emptyEmp("draft"));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>("");

    const setDraftField =
        (k: keyof Employee) =>
            (e: ChangeEvent<HTMLInputElement>) => {
                const v =
                    e.target.type === "checkbox"
                        ? (e.target as HTMLInputElement).checked
                        : e.target.value;

                setDraft((prev) => ({ ...prev, [k]: v } as Employee));
            };

    const setDraftAvatar = (i: number) => setDraft((p) => ({ ...p, avatarIndex: i }));

    const openAdd = () => {
        setError("");
        setDraft(emptyEmp("draft"));
        setIsOpen(true);
    };

    const closeAdd = () => {
        if (saving) return;
        setIsOpen(false);
    };

    const [statsTab, setStatsTab] = useState<StatsTab>("participants");
    const [selectedActivityKind, setSelectedActivityKind] = useState<ActivityFilter>("all");
    const [isActivityTypeOpen, setIsActivityTypeOpen] = useState(false);

    function toStringValue(value: unknown, fallback = "") {
        const text = String(value ?? "").trim();
        return text || fallback;
    }

    function toNumber(value: unknown, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function toAvatarIndex(value: unknown) {
        const raw = String(value ?? "").trim();
        if (!raw) return 0;
        const match = raw.match(/(\d+)/);
        if (!match) return 0;
        return Math.max(0, (Number(match[1]) || 1) - 1) % 3;
    }

    function deriveActivityKind(value: unknown): Exclude<ActivityFilter, "all"> {
        const raw = String(value ?? "").trim().toLowerCase();
        if (raw.includes("meeting")) return "Meetings";
        if (raw.includes("course")) return "Courses";
        return "Challenges";
    }

    function deriveStatusTone(value: unknown): ActivityStatusTone {
        const raw = String(value ?? "").trim().toLowerCase();
        if (
            raw.includes("end") ||
            raw.includes("close") ||
            raw.includes("complete") ||
            raw.includes("finish")
        ) {
            return "ended";
        }

        if (
            raw.includes("join") ||
            raw.includes("open") ||
            raw.includes("active") ||
            raw.includes("publish") ||
            raw.includes("public")
        ) {
            return "join";
        }

        return "pending";
    }

    async function refreshDashboard() {
        try {
            setPageLoading(true);
            setPageError("");

            const response = await fetch("/api/organization/dashboard", {
                method: "GET",
                cache: "no-store",
                credentials: "include",
            });

            const json = await response.json().catch(() => ({}));

            if (!response.ok || !json?.ok) {
                throw new Error(json?.message || "Failed to load organization dashboard");
            }

            const data = json?.data ?? {};
            const org = data?.org ?? {};
            const summaryData = data?.summary ?? {};

            setOrgDraft((prev) => ({
                ...prev,
                orgName: toStringValue(org?.orgName, prev.orgName),
                companySize: toStringValue(org?.companySize, prev.companySize),
                businessType: toStringValue(org?.businessType, prev.businessType),
                location: toStringValue(org?.location, prev.location),
                aboutUs: toStringValue(org?.aboutUs, prev.aboutUs),
                logoPreview: org?.logoPreview ?? prev.logoPreview,
                email: toStringValue(org?.email, prev.email),
                phone: toStringValue(org?.phone, prev.phone),
                website: toStringValue(org?.website, prev.website),
                linkedin: toStringValue(org?.linkedin, prev.linkedin),
                facebook: toStringValue(org?.facebook, prev.facebook),
                instagram: toStringValue(org?.instagram, prev.instagram),
                youtube: toStringValue(org?.youtube, prev.youtube),
                tiktok: toStringValue(org?.tiktok, prev.tiktok),
            }));

            setSummary({
                totalActivities: toNumber(summaryData?.totalActivities, ORG_ACTIVITY_ROWS.length),
                totalParticipants: toNumber(summaryData?.totalParticipants, PARTICIPANTS.length),
                meetings: toNumber(summaryData?.meetings, ORG_ACTIVITY_ROWS.filter((item) => item.kind === "Meetings").length),
                courses: toNumber(summaryData?.courses, ORG_ACTIVITY_ROWS.filter((item) => item.kind === "Courses").length),
                challenges: toNumber(summaryData?.challenges, ORG_ACTIVITY_ROWS.filter((item) => item.kind === "Challenges").length),
                published: toNumber(summaryData?.published, ORG_ACTIVITY_ROWS.filter((item) => item.statusTone === "join").length),
                draft: toNumber(summaryData?.draft, ORG_ACTIVITY_ROWS.filter((item) => item.statusTone === "pending").length),
            });

            const nextActivities: OrgActivityRow[] = Array.isArray(data?.activities) && data.activities.length > 0
                ? data.activities.map((item: any, index: number) => ({
                    id: toStringValue(item?.id, `activity-${index}`),
                    title: toStringValue(item?.title, "Activity"),
                    difficulty: toStringValue(item?.difficulty, "-"),
                    category: toStringValue(item?.category, deriveActivityKind(item?.kind || item?.category)),
                    kind: deriveActivityKind(item?.kind || item?.category),
                    xp: toNumber(item?.xp, 0),
                    statusTone: deriveStatusTone(item?.statusTone || item?.status),
                }))
                : ORG_ACTIVITY_ROWS;
            setActivityRows(nextActivities);

            const nextParticipants = Array.isArray(data?.participants) && data.participants.length > 0
                ? data.participants.map((person: any, index: number) => ({
                    id: toStringValue(person?.id, `participant-${index}`),
                    name: toStringValue(person?.name, `Participant ${index + 1}`),
                    subtitle: toStringValue(person?.subtitle, "Participant"),
                    score: toNumber(person?.score, 0),
                    avatarBg: toStringValue(person?.avatarBg, PARTICIPANTS[index % PARTICIPANTS.length]?.avatarBg || "#f1d6d8"),
                    initials: toStringValue(person?.initials, "PT"),
                }))
                : PARTICIPANTS;
            setParticipantRows(nextParticipants);

            const nextEmployees: Employee[] = Array.isArray(data?.employees) && data.employees.length > 0
                ? data.employees.map((emp: any, index: number) => ({
                    id: toStringValue(emp?.id ?? emp?.empId, `employee-${index}`),
                    firstName: toStringValue(emp?.firstName),
                    lastName: toStringValue(emp?.lastName),
                    position: toStringValue(emp?.position),
                    phone: toStringValue(emp?.phone),
                    email: toStringValue(emp?.email),
                    canCheckChallenge: Boolean(emp?.canCheckChallenge),
                    avatarIndex: toAvatarIndex(emp?.avatarChoice ?? emp?.avatarIndex),
                }))
                : employees;
            setEmployees(nextEmployees);

            const activeEmail = toStringValue(data?.account?.email).toLowerCase();
            if (activeEmail) {
                setActiveEmployeeEmail(activeEmail);
            }
        } catch (e: any) {
            setPageError(e?.message || "Failed to load organization dashboard");
        } finally {
            setPageLoading(false);
        }
    }

    //     const handleSaveOrg = async () => {
    //         try {
    //             setOrgSaving(true);

    //             const response = await fetch("/api/organization", {
    //                 method: "POST",
    //                 headers: {
    //                     "Content-Type": "application/json",
    //                 },
    //                 credentials: "include",
    //                 body: JSON.stringify({
    //                     orgName: orgDraft.orgName,
    //                     companySize: orgDraft.companySize,
    //                     businessType: orgDraft.businessType,
    //                     location: orgDraft.location,
    //                     aboutUs: orgDraft.aboutUs,
    //                     email: orgDraft.email,
    //                     phone: orgDraft.phone,
    //                     website: orgDraft.website,
    //                     linkedin: orgDraft.linkedin,
    //                     facebook: orgDraft.facebook,
    //                     instagram: orgDraft.instagram,
    //                     youtube: orgDraft.youtube,
    //                     tiktok: orgDraft.tiktok,
    //                     logo: orgDraft.logoPreview,
    //                 }),
    //             });

    //             const json = await response.json().catch(() => ({}));

    //             if (!response.ok || !json?.ok) {
    //                 throw new Error(json?.message || "Failed to save organization");
    //             }

    //             await refreshDashboard();
    //             setIsEditOrgOpen(false);
    //             setIsSavedOpen(true);
    //         } catch (e: any) {
    //             alert(e?.message || "Failed to save organization");
    //         } finally {
    //             setOrgSaving(false);
    //         }
    //     };

    const submitAdd = async () => {
        setError("");

        if (!draft.firstName.trim() || !draft.lastName.trim()) {
            setError("Please fill first name and last name.");
            return;
        }
        if (!draft.email.trim()) {
            setError("Please fill email.");
            return;
        }

        setSaving(true);
        try {
            // const r = await fetch("/api/organization/employees/invite", {
            const r = await fetch("/api/organization/employees/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    email: draft.email.trim().toLowerCase(),
                    firstName: draft.firstName.trim(),
                    lastName: draft.lastName.trim(),
                    position: draft.position.trim(),
                    phone: draft.phone.trim(),
                    canCheckChallenge: draft.canCheckChallenge,
                    avatarIndex: draft.avatarIndex,
                }),
            });

            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d?.ok) {
                setError(d?.message || "Invite failed");
                return;
            }

            await refreshDashboard();
            setIsOpen(false);
        } catch (e: any) {
            setError(e?.message || "Failed to add employee");
        } finally {
            setSaving(false);
        }
    };

    const MAX_EMP = 3;
    const shownEmployees = employees.slice(0, MAX_EMP);
    const canAddMore = shownEmployees.length < MAX_EMP;

    // const filteredOrgActivities = useMemo(() => {
    //     // if (selectedActivityKind === "all") return ORG_ACTIVITY_ROWS;
    //     // return ORG_ACTIVITY_ROWS.filter((item) => item.kind === selectedActivityKind);
    //     if (selectedActivityKind === "all") return UPDATED_ACTIVITY_ROWS;
    //     return UPDATED_ACTIVITY_ROWS.filter((item) => item.kind === selectedActivityKind);
    // }, [selectedActivityKind]);

    useEffect(() => {
        (async () => {
            const r = await fetch("/api/organization/active-account");
            const d = await r.json().catch(() => ({}));
            if (r.ok && d?.ok) setActiveEmployeeEmail(String(d.email || "").toLowerCase());
        })();
    }, []);

    // =======================
    // Update Org API
    // =======================
    //---------------------------------------------------------------------------------------------------------
    const handleUpdateOrg = async () => {
        try {
            setSaving(true);
            // setError(null);

            const formData = new FormData();
            formData.append("orgName", orgDraft.orgName);
            formData.append("companySize", orgDraft.companySize);
            formData.append("businessType", orgDraft.businessType);
            formData.append("location", orgDraft.location);
            formData.append("aboutUs", orgDraft.aboutUs);
            formData.append("email", orgDraft.email);
            formData.append("phone", orgDraft.phone);
            formData.append("website", orgDraft.website);
            formData.append("linkedin", orgDraft.linkedin);
            formData.append("facebook", orgDraft.facebook);
            formData.append("instagram", orgDraft.instagram);
            formData.append("youtube", orgDraft.youtube);
            formData.append("tiktok", orgDraft.tiktok);

            if (orgDraft.logoFile) {
                formData.append("logoFile", orgDraft.logoFile);
            }

            const res = await fetch("/api/organization/update", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to update organization");
            }

            setIsEditOrgOpen(false);
            setIsSavedOpen(true);
            setTimeout(() => setIsSavedOpen(false), 2000);

            // Refresh org data
            await fetchOrgDashboard();

        } catch (error: any) {
            setError(error.message);
        } finally {
            setSaving(false);
        }
    };
    //---------------------------------------------------------------------------------------------------------

    // =======================
    // Load and Update Data
    // =======================
    //---------------------------------------------------------------------------------------------------------
    const [orgDashboard, setOrgDashboard] = useState<OrgDashboard | null>(null);

    const [updatedMonthDonutLabels, setUpdatedMonthDonutLabels] = useState<any[]>([]);

    const [updatedTypeDonutLabels, setUpdatedTypeDonutLabels] = useState<any[]>([]);

    // ไม่ Rerender ถ้าไม่จำเป็น เพราะโหลดข้อมูลเยอะ
    const fetchOrgDashboard = useCallback(async () => {
        const res = await fetch("/api/org/dashboard");
        const resJson = await res.json();
        const data = resJson.data.orgDashboard;
        setOrgDashboard(data);

        if (data && Array.isArray(data.employees_info)) {
            const mapped = data.employees_info.map((emp: any) => ({
                id: emp.emp_id,
                firstName: emp.first_name || "",
                lastName: emp.last_name || "",
                position: emp.position || "",
                phone: emp.phone || "",
                email: emp.email || "",
                canCheckChallenge: emp.is_reviewer,
                avatarIndex: 0,
            }));
            setEmployees(mapped);
        }

        return data;
    }, [])

    // Update Activity Rows
    const updatedActivityRows = useMemo(() => {
        function mapstatusTone(state: string) {
            if (state === "pending") return "pending";
            if (state === "can join") return "join";
            if (state === "ended") return "ended";
            return "pending";
        }
        return orgDashboard?.activity_info.map((activity) => ({
            id: activity.activity_id,
            title: activity.activity_name,
            hours: activity.hours,
            category: activity.activity_type,
            kind: activity.activity_type,
            xp: 0,
            statusTone: mapstatusTone(activity.state),
        })) ?? [];
    }, [orgDashboard])

    // Filter Activity Rows
    const filteredOrgActivities = useMemo(() => {
        return updatedActivityRows.filter((activity) => {
            if (selectedActivityKind === "all") return true;
            return activity.kind === selectedActivityKind;
        });
    }, [updatedActivityRows, selectedActivityKind]);

    // Update Participants
    const updatedParticipants = useMemo(() => {
        var participantCounter = 0;
        return orgDashboard?.complete_stats_info.map((participant) => ({
            id: participantCounter++,
            name: participant.first_name + " " + participant.last_name,
            subtitle: "None",
            score: participant.xp,
            avatarBg: "#f1d6d8",
            initials: participant.first_name[0] + participant.last_name[0],
        })) ?? [];
    }, [orgDashboard])

    // Update Skill Bars
    const updatedSkillBars = useMemo(() => {
        return orgDashboard?.skill_stats_info.map((skill) => ({
            label: skill.skill_name,
            value: skill.number,
        })) ?? [];
    }, [orgDashboard])

    // Update University Bars
    const updatedParticipantBars = useMemo(() => {
        return orgDashboard?.university_stats_info.map((participant) => ({
            label: participant.university,
            value: participant.number,
        })) ?? [];
    }, [orgDashboard])

    // Fetch Data
    useEffect(() => {
        const init = async () => {
            try {

                const data = await fetchOrgDashboard();

                if (data) {
                    // 1. จัดการข้อมูลพนักงาน (ป้องกัน Error .map())
                    const employeeList = (data.employees_info ?? []).map((employee: any) => ({
                        id: employee.emp_id,
                        firstName: employee.first_name,
                        lastName: employee.last_name,
                        position: employee.position,
                        phone: employee.phone,
                        email: "None", // ใน JSON ไม่มี email รายบุคคล
                        canCheckChallenge: employee.is_reviewer, // ใช้ค่าจาก API
                        avatarIndex: 0,
                    }));
                    setEmployees(employeeList);

                    // 2. จัดการข้อมูล Org Draft
                    // หมายเหตุ: contact ใน JSON เป็น stringified JSON ต้อง parse ก่อน
                    let contactInfo = { email: "none", phone: "none" };
                    try {
                        if (data.contact) contactInfo = JSON.parse(data.contact);
                    } catch (e) {
                        console.error("Parse contact error", e);
                    }

                    setOrgDraft({
                        orgName: data.org_name ?? "",
                        companySize: data.size ?? "",
                        businessType: "none",
                        location: "none",
                        aboutUs: data.about_org ?? "",
                        logoFile: null,
                        logoPreview: data.logo || null,
                        email: contactInfo.email,
                        phone: contactInfo.phone,
                        website: data.website_url ?? "",
                        linkedin: "none",
                        facebook: "none",
                        instagram: "none",
                        youtube: "none",
                        tiktok: "none",
                    });

                }
            } catch (error) {
                console.error("Error fetching org dashboard:", error);
            }
        };
        init();
    }, []);

    // const filteredOrgActivities = useMemo(() => {
    //     // if (selectedActivityKind === "all") return ORG_ACTIVITY_ROWS;
    //     // return ORG_ACTIVITY_ROWS.filter((item) => item.kind === selectedActivityKind);
    //     if (selectedActivityKind === "all") return updatedActivityRows;
    //     return updatedActivityRows.filter((item) => item.kind === selectedActivityKind);
    // }, [selectedActivityKind]);

    //---------------------------------------------------------------------------------------------------------

    return (

        <main className={styles.main}>
            {/* ===== Row 1: Org profile + summary cards + avatar box ===== */}
            <section className={styles.topGrid}>
                {/* Org profile card */}
                <div className={styles.orgCard}>
                    <div className={styles.orgCardBg} />

                    <button
                        className={styles.orgEditBtn}
                        type="button"
                        aria-label="Edit organization"
                        onClick={openEditOrg}
                    >
                        <Image
                            src="/images/icons/button03-icon.png"
                            alt=""
                            fill
                            sizes="40px"
                            className={styles.orgEditBtnIcon}
                        />
                    </button>

                    <div className={styles.orgCardContent}>
                        <div className={styles.orgLogoBox}>
                            <div className={styles.orgLogoCircle} aria-hidden="true">
                                {orgDraft.logoPreview ? (
                                    <img
                                        src={orgDraft.logoPreview}
                                        alt="Organization logo"
                                        className={styles.orgLogoImg}
                                    />
                                ) : (
                                    <div className={styles.orgLogoMark} />
                                )}
                            </div>
                        </div>

                        <div className={styles.orgInfoWrap}>
                            <h1 className={styles.orgName}>{orgDraft.orgName}</h1>

                            <p className={styles.orgDesc}>{orgDraft.aboutUs}</p>

                            <div className={styles.orgMetaGrid}>
                                <div className={styles.orgPhone}>Phone: {orgDraft.phone}</div>
                                <div className={styles.orgEmail}>Email: {orgDraft.email}</div>
                                <div className={styles.orgAddress}>Address: {orgDraft.location}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary cards */}
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardBg} />

                    <div className={styles.summaryTopBox}>
                        <div className={styles.summaryTopBoxBg} />

                        <div className={styles.summaryTotalValue}>{orgDashboard?.activity_stats_info.total_activity}</div>
                        <div className={styles.summaryTotalLabel}>Total Activities</div>

                        <div className={styles.summaryMiniStat}>
                            <div className={styles.summaryMiniLabel}>challenge</div>
                            <div className={styles.summaryMiniValue}>{orgDashboard?.activity_stats_info.total_challenge}</div>
                        </div>

                        <div className={styles.summaryMiniStat}>
                            <div className={styles.summaryMiniLabel}>courses</div>
                            <div className={styles.summaryMiniValue}>{orgDashboard?.activity_stats_info.total_course}</div>
                        </div>

                        <div className={styles.summaryMiniStat}>
                            <div className={styles.summaryMiniLabel}>meetings</div>
                            <div className={styles.summaryMiniValue}>{orgDashboard?.activity_stats_info.total_meeting}</div>
                        </div>
                    </div>

                    <div className={styles.summaryBottom}>
                        <div className={styles.summaryParticipantIconWrap}>
                            <img
                                src="/images/icons/body-icon.png"
                                alt=""
                                className={styles.summaryParticipantIcon}
                                onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                            />
                        </div>

                        <div className={styles.summaryParticipantText}>
                            <div className={styles.summaryParticipantValue}>{orgDashboard?.activity_stats_info.total_participant}</div>
                            <div className={styles.summaryParticipantLabel}>Total Participants</div>
                        </div>
                    </div>
                </div>

                {/* Avatar box */}
                <div className={styles.avatarBox}>
                    <div className={styles.buildingWrap}>
                        <img
                            className={styles.buildingImg}
                            src="/images/buildings/building1.png"
                            alt="Organization building"
                            onError={(e) => {
                                // กันกรณีไม่มีไฟล์รูปในโปรเจกต์: จะไม่พัง layout
                                (e.currentTarget as HTMLImageElement).style.opacity = "0";
                            }}
                        />
                    </div>

                    <div className={styles.avatarRow}>
                        {shownEmployees.map((emp) => {
                            const isActive = emp.email === activeEmployeeEmail; // หรือเทียบ id/sub ก็ได้
                            return (
                                <button
                                    key={emp.id}
                                    type="button"
                                    className={styles.avatarTile}
                                    onClick={() => {
                                        // setActiveEmployeeEmail(emp.email);
                                    }}
                                    aria-label={`${emp.firstName} ${emp.lastName}`}
                                    title={`${emp.firstName} ${emp.lastName}`}
                                >
                                    <img
                                        src={AVATARS[emp.avatarIndex] || AVATARS[0]}
                                        alt={`${emp.firstName} avatar`}
                                        className={`${styles.avatarThumb} ${isActive ? styles.avatarThumbActive : ""}`}
                                    />
                                    <div className={styles.avatarName}>
                                        {emp.firstName} {emp.lastName}
                                    </div>
                                </button>
                            );
                        })}

                        {/* ปุ่ม + แสดงเมื่อยังไม่ครบ 3 คน */}
                        {canAddMore && (
                            <button type="button" className={styles.addEmpBtn} onClick={openAdd} aria-label="Add employee">
                                +
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary of activities */}
                <div className={styles.summaryOfActivities}>
                    <div className={styles.summaryOfActivitiesBg} />

                    <div className={styles.summaryOfActivitiesInner}>
                        <div className={`${styles.summaryActivityBox} ${styles.summaryActivityBoxDual}`}>
                            <div className={styles.summaryActivityBoxBg} />
                            <div className={styles.summaryActivityTopValue}>{summary.published}</div>
                            <div className={styles.summaryActivityTopLabel}>Published</div>
                            <div className={styles.summaryActivitySplit} />
                            <div className={styles.summaryActivityBottomValue}>{summary.draft}</div>
                            <div className={styles.summaryActivityBottomLabel}>Draft</div>
                        </div>

                        <div className={styles.summaryActivityDivider} />

                        <div className={styles.summaryActivityBox}>
                            <div className={styles.summaryActivityBoxBg} />
                            <div className={styles.summaryActivityValue}>{orgDashboard?.activity_stats_info.total_meeting}</div>
                            <div className={styles.summaryActivityLabel}>Meetings</div>
                        </div>

                        <div className={styles.summaryActivityDivider} />

                        <div className={styles.summaryActivityBox}>
                            <div className={styles.summaryActivityBoxBg} />
                            <div className={styles.summaryActivityValue}>{orgDashboard?.activity_stats_info.total_course}</div>
                            <div className={styles.summaryActivityLabel}>Courses</div>
                        </div>

                        <div className={styles.summaryActivityDivider} />

                        <div className={styles.summaryActivityBox}>
                            <div className={styles.summaryActivityBoxBg} />
                            <div className={styles.summaryActivityValue}>{orgDashboard?.activity_stats_info.total_challenge}</div>
                            <div className={styles.summaryActivityLabel}>Challenges</div>
                        </div>
                    </div>
                </div>

            </section>

            {/* ===== Row 2: Figma-like contents + participants list ===== */}
            <section className={styles.midGrid}>
                <div className={styles.dashboardContent}>
                    <section className={styles.statisticsGraphCard}>
                        <div className={styles.statisticsGraphBg} />

                        <div className={styles.statisticsTabs}>
                            <div className={styles.statisticsTabsDividerLeft} />
                            <div className={styles.statisticsTabsDividerRight} />
                            <div className={styles.statisticsTabsUnderline} />

                            <button
                                type="button"
                                className={`${styles.statisticsTabBtn} ${statsTab === "all" ? styles.statisticsTabBtnActive : ""}`}
                                onClick={() => setStatsTab("all")}
                            >
                                All activity statistics
                            </button>

                            <button
                                type="button"
                                className={`${styles.statisticsTabBtn} ${statsTab === "participants" ? styles.statisticsTabBtnActive : ""}`}
                                onClick={() => setStatsTab("participants")}
                            >
                                Statistics of participants
                            </button>

                            <button
                                type="button"
                                className={`${styles.statisticsTabBtn} ${statsTab === "skills" ? styles.statisticsTabBtnActive : ""}`}
                                onClick={() => setStatsTab("skills")}
                            >
                                skill statistics
                            </button>
                        </div>

                        {statsTab === "all" ? (
                            <div className={styles.allStatisticsBody}>
                                <div className={styles.allStatisticsToggleRow}>
                                    <div className={styles.allStatisticsToggle}>By Month</div>
                                    <div className={styles.allStatisticsToggle}>Activity types</div>
                                </div>

                                <div className={styles.donutSection}>
                                    <div className={styles.donutBlock}>
                                        <div
                                            className={styles.donutRing}
                                            style={{
                                                background:
                                                    "conic-gradient(#a8dcb3 0 40%, #ffd286 40% 66%, #66bdce 66% 86%, #cdb4db 86% 100%)",
                                            }}
                                        >
                                            <div className={styles.donutHole}>15</div>
                                        </div>

                                        <div className={styles.donutLegendGrid}>
                                            {MONTH_DONUT_LABELS.map((item) => (
                                                <div key={item.label} className={styles.donutLegendItem}>
                                                    <span className={styles.donutLegendValue}>{item.value}</span>
                                                    <span className={styles.donutLegendLabel}>{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.donutSectionDivider} />

                                    <div className={styles.donutBlock}>
                                        <div
                                            className={styles.donutRing}
                                            style={{
                                                background:
                                                    "conic-gradient(#a8dcb3 0 54%, #ffd286 54% 80%, #66bdce 80% 100%)",
                                            }}
                                        >
                                            <div className={styles.donutHole}>15</div>
                                        </div>

                                        <div className={styles.donutLegendGridSingle}>
                                            {TYPE_DONUT_LABELS.map((item) => (
                                                <div key={item.label} className={styles.donutLegendItemWide}>
                                                    <span className={styles.donutLegendValue}>{item.value}</span>
                                                    <span className={styles.donutLegendLabel}>{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.statisticsBarsWrap}>
                                <div className={styles.statisticsBarsBaseline} />

                                <div className={styles.statisticsBarsRow}>
                                    {/* {(statsTab === "participants" ? PARTICIPANT_BARS : SKILL_BARS).map((item, index) => { */}
                                    {(statsTab === "participants" ? updatedParticipantBars : updatedSkillBars).map((item, index) => {
                                        const max = statsTab === "participants" ? 80 : 12;
                                        const barHeight = Math.max(42, (item.value / max) * 120);
                                        return (
                                            <div key={`${item.label}-${index}`} className={styles.statisticsBarItem}>
                                                <div className={styles.statisticsBarValue} style={{ bottom: `${barHeight + 34}px` }}>{item.value}</div>
                                                <div className={styles.statisticsBar} style={{ height: `${barHeight}px` }} />
                                                <div className={styles.statisticsBarLabel}>
                                                    {item.label.split("\n").map((line) => (
                                                        <span key={line}>{line}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className={styles.activityOverviewCard}>
                        <div className={styles.activityOverviewBg} />

                        <div className={styles.activityOverviewHeader}>
                            <div className={styles.activityOverviewTitle}>Activity Overview</div>

                            <button
                                type="button"
                                className={styles.activityOverviewAddBtn}
                                aria-label="Select activity type"
                                onClick={() => setIsActivityTypeOpen(true)}
                            >
                                +
                            </button>
                        </div>

                        <div className={styles.activityOverviewScroll}>
                            {filteredOrgActivities.map((item) => (
                                <div key={item.id} className={styles.activityTableRow}>
                                    <div className={styles.activityThumbWrap}>
                                        <div className={styles.activityThumbCard}>
                                            <div className={styles.activityThumbPieceTop} />
                                            <div className={styles.activityThumbPieceBottom} />
                                        </div>
                                    </div>

                                    <div className={styles.activityNameCell}>{item.title}</div>
                                    <div className={styles.activityDivider} />

                                    {/* <div className={styles.activityInfoCell}>
                                        <div className={styles.activityInfoHead}>difficulty</div>
                                        <div className={styles.activityInfoValue}>{item.difficulty}</div>
                                    </div> */}
                                    <div className={styles.activityDivider} />

                                    <div className={styles.activityInfoCell}>
                                        <div className={styles.activityInfoHead}>Category</div>
                                        <div className={styles.activityInfoValue}>{item.category}</div>
                                    </div>
                                    <div className={styles.activityDivider} />

                                    <div className={styles.activityInfoCellXp}>
                                        <div className={styles.activityInfoHead}>Hours</div>
                                        <div className={styles.activityInfoValue}>{item.hours}</div>
                                    </div>
                                    <div className={styles.activityDivider} />

                                    <div className={styles.activityStatusColumn}>
                                        <div className={`${styles.activityStatusBadge} ${item.statusTone === "pending" ? styles.activityStatusBadgePending : ""}`}>
                                            pending
                                        </div>
                                        <div className={`${styles.activityStatusBadge} ${item.statusTone === "join" ? styles.activityStatusBadgeJoin : ""}`}>
                                            Can join
                                        </div>
                                        <div className={`${styles.activityStatusBadge} ${item.statusTone === "ended" ? styles.activityStatusBadgeEnded : ""}`}>
                                            ended
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className={styles.sideParticipantsCol}>
                    <section className={styles.rightPanel}>
                        <h3 className={styles.rightTitle}>Participants</h3>

                        <div className={styles.studentsListScroller}>
                            {/* {PARTICIPANTS.map((person) => ( */}
                            {updatedParticipants.map((person) => (
                                <button
                                    key={person.id}
                                    type="button"
                                    className={styles.studentRowButton}
                                    aria-label={person.name}
                                    title={person.name}
                                >
                                    <div className={styles.studentRowCard}>
                                        <div className={styles.studentAvatar} style={{ background: person.avatarBg }}>
                                            <span className={styles.studentAvatarInitials}>{person.initials}</span>
                                        </div>

                                        <div className={styles.studentMeta}>
                                            <div className={styles.studentName}>{person.name}</div>
                                            <div className={styles.studentSubtitle}>{person.subtitle}</div>
                                        </div>

                                        <div className={styles.studentScoreArea}>
                                            <div className={styles.studentScore}>{person.score}</div>
                                            <div className={styles.studentMedal} aria-hidden="true">
                                                <span className={styles.studentMedalRibbonLeft} />
                                                <span className={styles.studentMedalRibbonRight} />
                                                <span className={styles.studentMedalBadge} />
                                                <span className={styles.studentMedalCore}>★</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            </section>

            {isActivityTypeOpen && (
                <div className={styles.figmaPopupOverlay} onClick={() => setIsActivityTypeOpen(false)}>
                    <div
                        className={styles.activityTypePopup}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Select activity type"
                    >
                        <div className={styles.activityTypePopupBg} />
                        <div className={styles.activityTypePopupInner}>
                            {(["Meetings", "Courses", "Challenges"] as const).map((item, index) => (
                                <Fragment key={item}>
                                    {index > 0 && <div className={styles.activityTypePopupDivider} />}
                                    <button
                                        type="button"
                                        className={styles.activityTypePopupItem}
                                        onClick={() => {
                                            setSelectedActivityKind(item);
                                            setIsActivityTypeOpen(false);
                                        }}
                                    >
                                        <div className={styles.activityTypePopupItemBox} />
                                        <div className={styles.activityTypePopupItemText}>{item}</div>
                                    </button>
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Modal: Add employee ===== */}
            {isOpen && (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Add employee</h2>
                            <button className={styles.modalClose} type="button" onClick={closeAdd} aria-label="Close">
                                ✕
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.grid2}>
                                <input
                                    className={styles.input}
                                    placeholder="First name"
                                    value={draft.firstName}
                                    onChange={setDraftField("firstName")}
                                />
                                <input
                                    className={styles.input}
                                    placeholder="Last name"
                                    value={draft.lastName}
                                    onChange={setDraftField("lastName")}
                                />
                            </div>

                            <div className={styles.grid2}>
                                <input
                                    className={styles.input}
                                    placeholder="Position"
                                    value={draft.position}
                                    onChange={setDraftField("position")}
                                />
                                <input
                                    className={styles.input}
                                    placeholder="Phone number"
                                    value={draft.phone}
                                    onChange={setDraftField("phone")}
                                />
                            </div>

                            <input
                                className={styles.input}
                                placeholder="Email"
                                value={draft.email}
                                onChange={setDraftField("email")}
                            />

                            <div className={styles.hr} />

                            <label className={styles.checkRow}>
                                <input
                                    className={styles.checkInput}
                                    type="checkbox"
                                    checked={draft.canCheckChallenge}
                                    onChange={setDraftField("canCheckChallenge")}
                                />
                                <span className={styles.checkText}>Can check challenge activities</span>
                            </label>

                            <div className={styles.avatarPickTitle}>Avatar</div>
                            <div className={styles.avatarPickRow}>
                                {AVATARS.map((src, i) => {
                                    const on = draft.avatarIndex === i;
                                    return (
                                        <button
                                            key={src}
                                            type="button"
                                            className={`${styles.avatarPickBtn} ${on ? styles.avatarPickBtnOn : ""}`}
                                            onClick={() => setDraftAvatar(i)}
                                            aria-label={`Select avatar ${i + 1}`}
                                        >
                                            <img src={src} alt={`avatar ${i + 1}`} className={styles.avatarPickImg} />
                                        </button>
                                    );
                                })}
                            </div>

                            {error && <div className={styles.errorText}>{error}</div>}
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.secondaryBtn} type="button" onClick={closeAdd} disabled={saving}>
                                Cancel
                            </button>
                            <button className={styles.primaryBtn} type="button" onClick={submitAdd} disabled={saving}>
                                {saving ? "Saving..." : "Send invite"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isEditOrgOpen && (
                <div className={styles.orgPopupOverlay} onClick={closeEditOrg}>
                    <div
                        className={styles.orgPopupCard}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Edit organization information"
                    >
                        <div className={styles.orgPopupInner}>
                            <div className={styles.orgPopupScroll}>
                                <div className={styles.popupSectionTitle}>Basic Information</div>

                                <div className={styles.popupGridOrgName}>
                                    <input
                                        className={styles.popupInput}
                                        placeholder="Organization Name"
                                        value={orgDraft.orgName}
                                        onChange={setOrgField("orgName")}
                                    />
                                    <input
                                        className={styles.popupInput}
                                        placeholder="Company Size"
                                        value={orgDraft.companySize}
                                        onChange={setOrgField("companySize")}
                                    />
                                </div>

                                <input
                                    className={styles.popupInput}
                                    placeholder="Business Type"
                                    value={orgDraft.businessType}
                                    onChange={setOrgField("businessType")}
                                />

                                <input
                                    className={styles.popupInput}
                                    placeholder="Location"
                                    value={orgDraft.location}
                                    onChange={setOrgField("location")}
                                />

                                <div className={styles.popupAboutLogo}>
                                    <textarea
                                        className={styles.popupTextarea}
                                        placeholder="About Us"
                                        value={orgDraft.aboutUs}
                                        onChange={setOrgField("aboutUs")}
                                    />

                                    <div className={styles.popupLogoBox}>
                                        {!orgDraft.logoPreview && (
                                            <div className={styles.popupLogoLabel}>Logo</div>
                                        )}

                                        <label className={styles.popupLogoDrop}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className={styles.popupHiddenFile}
                                                onChange={openLogoCrop}
                                            />
                                            <div className={styles.popupLogoDropInner}>
                                                {orgDraft.logoPreview ? (
                                                    <img
                                                        src={orgDraft.logoPreview}
                                                        alt="Logo preview"
                                                        className={styles.popupLogoPreview}
                                                    />
                                                ) : (
                                                    <div className={styles.popupUploadText}>upload</div>
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className={styles.popupDivider} />

                                <div className={styles.popupSectionTitle}>Contact</div>

                                <div className={styles.popupGrid2}>
                                    <input
                                        className={styles.popupInput}
                                        placeholder="Email"
                                        value={orgDraft.email}
                                        onChange={setOrgField("email")}
                                    />
                                    <input
                                        className={styles.popupInput}
                                        placeholder="Phone number"
                                        value={orgDraft.phone}
                                        onChange={setOrgField("phone")}
                                    />
                                </div>

                                <input
                                    className={styles.popupInput}
                                    placeholder="Website"
                                    value={orgDraft.website}
                                    onChange={setOrgField("website")}
                                />

                                <div className={styles.popupDivider} />

                                <div className={styles.popupSectionTitle}>Organization</div>

                                <input
                                    className={styles.popupInput}
                                    placeholder="LinkedIn link"
                                    value={orgDraft.linkedin}
                                    onChange={setOrgField("linkedin")}
                                />
                                <input
                                    className={styles.popupInput}
                                    placeholder="Facebook link"
                                    value={orgDraft.facebook}
                                    onChange={setOrgField("facebook")}
                                />
                                <input
                                    className={styles.popupInput}
                                    placeholder="Instagram link"
                                    value={orgDraft.instagram}
                                    onChange={setOrgField("instagram")}
                                />
                                <input
                                    className={styles.popupInput}
                                    placeholder="YouTube link"
                                    value={orgDraft.youtube}
                                    onChange={setOrgField("youtube")}
                                />
                                <input
                                    className={styles.popupInput}
                                    placeholder="TikTok link"
                                    value={orgDraft.tiktok}
                                    onChange={setOrgField("tiktok")}
                                />
                            </div>
                        </div>

                        <div className={styles.popupActionRow}>
                            <button
                                type="button"
                                className={styles.popupIconButton}
                                onClick={(e) => handleSaveOrg(e)}
                                aria-label="Save organization"
                            >
                                <Image
                                    src="/images/icons/button01-icon.png"
                                    alt=""
                                    width={60}
                                    height={60}
                                    className={styles.popupActionIcon}
                                />
                            </button>

                            <button
                                type="button"
                                className={styles.popupIconButton}
                                onClick={closeEditOrg}
                                aria-label="Cancel organization editing"
                            >
                                <Image
                                    src="/images/icons/button02-icon.png"
                                    alt=""
                                    width={60}
                                    height={60}
                                    className={styles.popupActionIcon}
                                />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSavedOpen && (
                <div className={styles.savedPopupOverlay} onClick={closeSaved}>
                    <div
                        className={styles.savedPopupCard}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Saved"
                    >
                        <div className={styles.savedPopupBg} />
                        <Image
                            src="/images/icons/button01-icon.png"
                            alt=""
                            width={60}
                            height={60}
                            className={styles.savedPopupIcon}
                        />
                        <div className={styles.savedPopupTitle}>Save</div>
                    </div>
                </div>
            )}

            {cropOpen && cropUrl && (
                <div className={styles.cropOverlay} role="dialog" aria-modal="true">
                    <div className={styles.cropModal}>
                        <div className={styles.cropHeader}>
                            <div className={styles.cropTitle}>Crop Logo</div>
                            <button
                                type="button"
                                className={styles.cropClose}
                                onClick={() => {
                                    URL.revokeObjectURL(cropUrl);
                                    setCropUrl(null);
                                    setCropOpen(false);
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div
                            className={styles.cropBox}
                            style={{ width: cropBoxSize, height: cropBoxSize }}
                        >
                            <img
                                src={cropUrl}
                                alt="Crop source"
                                className={styles.cropImg}
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    setImgNat({ w: img.naturalWidth, h: img.naturalHeight });
                                }}
                                draggable={false}
                                style={{
                                    transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropZoom})`,
                                }}
                            />

                            <div
                                className={styles.cropDragLayer}
                                onMouseDown={(downEvt) => {
                                    downEvt.preventDefault();
                                    const start = { x: downEvt.clientX, y: downEvt.clientY };
                                    const startOff = { ...cropOffset };

                                    const onMove = (moveEvt: MouseEvent) => {
                                        const dx = moveEvt.clientX - start.x;
                                        const dy = moveEvt.clientY - start.y;
                                        setCropOffset({ x: startOff.x + dx, y: startOff.y + dy });
                                    };

                                    const onUp = () => {
                                        window.removeEventListener("mousemove", onMove);
                                        window.removeEventListener("mouseup", onUp);
                                    };

                                    window.addEventListener("mousemove", onMove);
                                    window.addEventListener("mouseup", onUp);
                                }}
                            />
                        </div>

                        <div className={styles.cropControls}>
                            <label className={styles.cropLabel}>
                                Zoom
                                <input
                                    type="range"
                                    min={1}
                                    max={2.5}
                                    step={0.01}
                                    value={cropZoom}
                                    onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                                />
                            </label>
                        </div>

                        <div className={styles.cropActions}>
                            <button
                                type="button"
                                className={styles.cropBtn}
                                onClick={() => {
                                    URL.revokeObjectURL(cropUrl);
                                    setCropUrl(null);
                                    setCropOpen(false);
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className={styles.cropBtnPrimary}
                                onClick={async () => {
                                    if (!cropUrl || !imgNat.w || !imgNat.h) return;

                                    const img = document.createElement("img");
                                    img.src = cropUrl;
                                    await new Promise<void>((res) => (img.onload = () => res()));

                                    const Cw = cropBoxSize;
                                    const Ch = cropBoxSize;

                                    const baseScale = Math.max(Cw / imgNat.w, Ch / imgNat.h);
                                    const s = baseScale * cropZoom;

                                    const rw = imgNat.w * s;
                                    const rh = imgNat.h * s;

                                    const left = (Cw - rw) / 2 + cropOffset.x;
                                    const top = (Ch - rh) / 2 + cropOffset.y;

                                    let sx = (0 - left) / s;
                                    let sy = (0 - top) / s;
                                    let sw = Cw / s;
                                    let sh = Ch / s;

                                    sx = Math.max(0, Math.min(imgNat.w - sw, sx));
                                    sy = Math.max(0, Math.min(imgNat.h - sh, sy));

                                    const out = 512;
                                    const canvas = document.createElement("canvas");
                                    canvas.width = out;
                                    canvas.height = out;
                                    const ctx = canvas.getContext("2d")!;
                                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out, out);

                                    const blob: Blob = await new Promise((resolve) =>
                                        canvas.toBlob((b) => resolve(b!), "image/png", 0.92)
                                    );

                                    const file = new File([blob], "logo.png", { type: "image/png" });
                                    const previewUrl = URL.createObjectURL(file);

                                    setOrgDraft((prev) => ({
                                        ...prev,
                                        logoFile: file,
                                        logoPreview: previewUrl,
                                    }));

                                    URL.revokeObjectURL(cropUrl);
                                    setCropUrl(null);
                                    setCropOpen(false);
                                }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}