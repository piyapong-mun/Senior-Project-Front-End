"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent } from "react";
import styles from "./PortfolioPage.module.css";

type ItemSource = "upload" | "platform";

type UploadFileItem = {
    id: string;
    name: string;
};

type EducationItem = {
    id: string;
    school: string;
    degree: string;
    faculty: string;
    fieldOfStudy: string;
    startYear: string;
    endYear: string;
    gpa: string;
};

type CertificateItem = {
    id: string;
    title: string;
    date: string;
    itemType: "certificate" | "badge";
    badgeLink: string;
};

type ExperienceItem = {
    id: string;
    period: string;
    title: string;
    description: string;
    source: ItemSource;
    files: UploadFileItem[];
};

type SkillKind = "soft" | "technical";

type SkillItem = {
    id: string;
    name: string;
    kind: SkillKind;
    source: ItemSource;
    isSelected: boolean;
};

type EditorMode =
    | "personal"
    | "education"
    | "educationForm"
    | "skills"
    | "skillsForm"
    | "certificate"
    | "certificateForm"
    | "experience"
    | "experienceForm";

type EducationFormState = {
    school: string;
    degree: string;
    faculty: string;
    fieldOfStudy: string;
    startYear: string;
    endYear: string;
    gpa: string;
};

type CertificateFormState = {
    title: string;
    date: string;
    itemType: "certificate" | "badge";
    badgeLink: string;
    uploadedFileName: string;
};

type ExperienceFormState = {
    period: string;
    title: string;
    description: string;
    source: ItemSource;
    files: UploadFileItem[];
};

type SkillFormState = {
    name: string;
    kind: SkillKind;
    source: ItemSource;
};

const initialPersonalForm = {
    firstName: "",
    lastName: "",
    birthDate: "",
    phone: "",
    email: "",
    address: "",
    aboutMe: "",
};

const emptyEducationForm: EducationFormState = {
    school: "",
    degree: "",
    faculty: "",
    fieldOfStudy: "",
    startYear: "",
    endYear: "",
    gpa: "",
};

const emptyCertificateForm: CertificateFormState = {
    title: "",
    date: "",
    itemType: "certificate",
    badgeLink: "",
    uploadedFileName: "",
};

const emptyExperienceForm: ExperienceFormState = {
    period: "",
    title: "",
    description: "",
    source: "upload",
    files: [],
};

const emptySkillForm: SkillFormState = {
    name: "",
    kind: "technical",
    source: "upload",
};

// platform options จะ load จาก API จริงใน fetchPortfolioData
const platformSkillOptions: SkillItem[] = [];
const platformCertificateOptions: CertificateItem[] = [];

// platform experience options จะ load จาก API จริงใน fetchPortfolioData
const platformExperienceOptions: ExperienceItem[] = [];

function makeId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PUBLIC_ASSET_BASE =
    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_ASSETS_PUBLIC_BASE ||
    "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com";

function resolveImageUrl(value: string | null | undefined): string {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    // already full URL
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    // s3:// scheme — strip bucket, use key
    if (raw.startsWith("s3://")) {
        const withoutScheme = raw.replace("s3://", "");
        const slashIdx = withoutScheme.indexOf("/");
        const key = slashIdx >= 0 ? withoutScheme.slice(slashIdx + 1) : "";
        return key ? `${PUBLIC_ASSET_BASE.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}` : "";
    }
    // bare key (with or without leading slash)
    return `${PUBLIC_ASSET_BASE.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`;
}

function getSourceIcon(source: ItemSource) {
    return source === "upload"
        ? "/images/icons/sign01-icon.png"
        : "/images/icons/sign02-icon.png";
}

function getSourceLabel(source: ItemSource) {
    return source === "upload" ? "Uploaded by user" : "Platform";
}

function filesToUploadItems(fileList: FileList | null) {
    if (!fileList) return [];
    return Array.from(fileList).map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
    }));
}

function normalizeSource(value: unknown): ItemSource {
    return String(value ?? "").trim().toLowerCase() === "upload"
        ? "upload"
        : "platform";
}

function normalizeSkillKind(value: unknown): SkillKind {
    const s = String(value ?? "").trim().toLowerCase();
    return s.includes("soft") ? "soft" : "technical";
}

function normalizeDate(value: unknown) {
    const s = String(value ?? "").trim();
    if (!s) return "";
    if (s.includes("T")) return s.slice(0, 10);
    return s;
}

function buildEducationLabel(item: any) {
    const school = String(
        item?.school ??
        item?.facultyschool ??
        item?.educational_institution ??
        item?.institution ??
        ""
    ).trim();

    const start = String(item?.startYear ?? item?.start_year ?? "").trim();
    const end = String(item?.endYear ?? item?.end_year ?? "").trim();
    const gpa = String(item?.gpa ?? "").trim();

    const yearText = start || end ? ` (${start || "-"} - ${end || "Present"})` : "";
    const gpaText = gpa ? ` (GPA: ${gpa})` : "";

    return `${school || "Education"}${yearText}${gpaText}`;
}

function toEducationItem(item: any, index: number): EducationItem {
    return {
        id: item?.id || makeId(`education-${index}`),
        school: String(item?.school ?? item?.institution ?? item?.university ?? item?.facultyschool ?? "").trim(),
        degree: String(item?.degree ?? item?.degreeLevel ?? item?.degree_level ?? "").trim(),
        faculty: String(item?.faculty ?? "").trim(),
        fieldOfStudy: String(item?.fieldOfStudy ?? item?.field_of_study ?? item?.major ?? "").trim(),
        startYear: String(item?.startYear ?? item?.start_year ?? item?.start_date ?? "").trim(),
        endYear: String(item?.endYear ?? item?.end_year ?? item?.end_date ?? "").trim(),
        gpa: String(item?.gpa ?? "").trim(),
    };
}

function parsePeriodYears(period: string): { startYear: number; endYear: number } {
    const nums = period.split(/[\s\-–]+/).map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 1000);
    return { startYear: nums[0] ?? 0, endYear: nums[1] ?? 0 };
}

function toEducationPayload(items: EducationItem[]) {
    return items.map((item) => ({
        institution: item.school.trim(),
        degreeLevel: item.degree.trim(),
        faculty: item.faculty.trim(),
        major: item.fieldOfStudy.trim(),
        startYear: parseInt(item.startYear) || 0,
        endYear: parseInt(item.endYear) || 0,
        gpa: item.gpa.trim(),
    }));
}

function toSkillsPayload(items: SkillItem[]) {
    return items.map((item) => ({
        skillID: item.id,
        name: item.name.trim(),
        category: item.kind,
        fromSystem: item.source === "platform",
        enable: item.isSelected,
    }));
}

function toCertificatesPayload(items: CertificateItem[]) {
    return items.map((item) => ({
        name: item.title.trim(),
        type: item.itemType,
        badgeLink: item.badgeLink,
        enable: true,
    }));
}

function toExperiencesPayload(items: ExperienceItem[]) {
    return items.map((item) => {
        const { startYear, endYear } = parsePeriodYears(item.period);
        return {
            activityID: item.id,
            topic: item.title.trim(),
            description: item.description.trim(),
            startYear,
            endYear,
            fromSystem: item.source === "platform",
            enable: true,
            externalWebsite: "",
        };
    });
}

export default function PortfolioPage() {
    const [isLoading, setIsLoading] = useState(true);
    const birthInputRef = useRef<HTMLInputElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const certificateFileRef = useRef<HTMLInputElement | null>(null);
    const experienceUploadRef = useRef<HTMLInputElement | null>(null);

    const [showSave, setShowSave] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<"education" | "skills" | "certificate" | "experience" | null>(null);

    const [photoUrl, setPhotoUrl] = useState("");
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isUploadingCertFile, setIsUploadingCertFile] = useState(false);
    const [editorMode, setEditorMode] = useState<EditorMode>("personal");

    const [form, setForm] = useState(initialPersonalForm);

    const [loadedForm, setLoadedForm] = useState(initialPersonalForm);

    const [educationList, setEducationList] = useState<EducationItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [skills, setSkills] = useState<SkillItem[]>([]);
    const [certificates, setCertificates] = useState<CertificateItem[]>([]);
    const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
    const [apiPlatformExperiences, setApiPlatformExperiences] = useState<ExperienceItem[]>([]);

    // const [educationList, setEducationList] = useState([
    //     "Suankularb Wittayalai (2015 - 2021) (GPA: 3.99)",
    //     "Mahidol University (2022 - 2025) (GPA: 3.94)",
    // ]);
    const [educationForm, setEducationForm] = useState<EducationFormState>(emptyEducationForm);
    const [editingEducationIndex, setEditingEducationIndex] = useState<number | null>(null);

    // const [skills, setSkills] = useState<SkillItem[]>([
    //     { id: "s1", name: "Python", kind: "technical", source: "upload", isSelected: true },
    //     { id: "s2", name: "C++", kind: "technical", source: "upload", isSelected: true },
    //     { id: "s3", name: "Cloud Computing", kind: "technical", source: "upload", isSelected: false },
    //     { id: "s4", name: "Presentation", kind: "soft", source: "platform", isSelected: true },
    // ]);
    const [skillForm, setSkillForm] = useState<SkillFormState>(emptySkillForm);
    const [editingSkillIndex, setEditingSkillIndex] = useState<number | null>(null);

    // const [certificates, setCertificates] = useState<CertificateItem[]>([
    //     { id: "c1", title: "AWS Cloud Computing for Development", date: "01/07/2025", source: "upload", files: [{ id: "cf1", name: "aws-cloud-computing.pdf" }] },
    //     { id: "c2", title: "AWS Basic Cloud Computing", date: "01/07/2025", source: "platform", files: [] },
    //     { id: "c3", title: "VCEP Python Basic", date: "01/07/2025", source: "platform", files: [] },
    //     { id: "c4", title: "Frontend Foundations", date: "15/08/2025", source: "upload", files: [{ id: "cf2", name: "frontend-foundations.png" }] },
    //     { id: "c5", title: "UI Design Principles", date: "01/09/2025", source: "platform", files: [] },
    // ]);
    const [certificateForm, setCertificateForm] = useState<CertificateFormState>(emptyCertificateForm);
    const [editingCertificateIndex, setEditingCertificateIndex] = useState<number | null>(null);

    // const [experiences, setExperiences] = useState<ExperienceItem[]>([
    //     {
    //         id: "e1",
    //         period: "2024 - 2025",
    //         title: "Python Basic",
    //         description:
    //             "Accessed basic Python classes in the VCEP platform and learned programming fundamentals, syntax, and problem-solving practice.",
    //         source: "platform",
    //         files: [],
    //     },
    //     {
    //         id: "e2",
    //         period: "2025",
    //         title: "UI Layout Explanation Task",
    //         description:
    //             "Designed and explained interface layouts with attention to readability, hierarchy, and responsive structure.",
    //         source: "upload",
    //         files: [{ id: "ef-upload-1", name: "activity-evidence.pdf" }],
    //     },
    //     {
    //         id: "e3",
    //         period: "2025",
    //         title: "Responsive Web Page Workshop",
    //         description:
    //             "Built responsive page sections and improved alignment, spacing, and component scaling for multiple screen sizes.",
    //         source: "platform",
    //         files: [],
    //     },
    //     {
    //         id: "e4",
    //         period: "2023 - 2024",
    //         title: "Frontend Basics",
    //         description:
    //             "Learned component-based UI development, page composition, styling systems, and reusable interface blocks.",
    //         source: "platform",
    //         files: [],
    //     },
    //     {
    //         id: "e5",
    //         period: "2023 - 2024",
    //         title: "Portfolio Preparation",
    //         description:
    //             "Collected achievements, summarized skills, and arranged sections into a clean, structured portfolio format.",
    //         source: "upload",
    //         files: [{ id: "ef-upload-2", name: "portfolio-summary.docx" }],
    //     },
    // ]);
    const [experienceForm, setExperienceForm] = useState<ExperienceFormState>(emptyExperienceForm);
    const [editingExperienceIndex, setEditingExperienceIndex] = useState<number | null>(null);

    const fullName = useMemo(() => `${form.firstName} ${form.lastName}`.trim(), [form.firstName, form.lastName]);
    const softSkills = useMemo(() => skills.filter((item) => item.kind === "soft" && item.isSelected), [skills]);
    const technicalSkills = useMemo(() => skills.filter((item) => item.kind === "technical" && item.isSelected), [skills]);

    useEffect(() => {
        if (!showSave) return;
        const timer = window.setTimeout(() => setShowSave(false), 1600);
        return () => window.clearTimeout(timer);
    }, [showSave]);

    useEffect(() => {
        return () => {
            if (photoUrl.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
        };
    }, [photoUrl]);

    function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function updateEducationForm<K extends keyof EducationFormState>(key: K, value: EducationFormState[K]) {
        setEducationForm((prev) => ({ ...prev, [key]: value }));
    }

    function updateCertificateForm<K extends keyof CertificateFormState>(key: K, value: CertificateFormState[K]) {
        setCertificateForm((prev) => ({ ...prev, [key]: value }));
    }

    function updateExperienceForm<K extends keyof ExperienceFormState>(key: K, value: ExperienceFormState[K]) {
        setExperienceForm((prev) => ({ ...prev, [key]: value }));
    }

    function updateSkillForm<K extends keyof SkillFormState>(key: K, value: SkillFormState[K]) {
        setSkillForm((prev) => ({ ...prev, [key]: value }));
    }

    function openBirthPicker() {
        birthInputRef.current?.showPicker?.();
        birthInputRef.current?.focus();
    }

    async function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        const url = URL.createObjectURL(file);
        setPhotoUrl((prev) => {
            if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
            return url;
        });
    }

    function openPersonalEditor() {
        setEditorMode("personal");
    }

    function openEducationEditor() {
        setEditorMode("education");
    }

    function openSkillsEditor() {
        setEditorMode("skills");
    }

    function openCertificateEditor() {
        setEditorMode("certificate");
    }

    function openExperienceEditor() {
        setEditorMode("experience");
    }

    async function savePortfolioSection(type: "info" | "education" | "skills" | "certificate" | "experience", payload: unknown) {
        setIsSaving(true);

        try {
            const res = await fetch(`/api/student/portfolio?type=${type}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await res.json().catch(() => null);
            if (!res.ok || !result?.ok) {
                throw new Error(result?.message || `Failed to save ${type}`);
            }

            setShowSave(true);
            return result;
        } finally {
            setIsSaving(false);
        }
    }

    function onCancelPersonal() {
        setForm(loadedForm);
    }

    function onAddEducation() {
        setEditingEducationIndex(null);
        setEducationForm(emptyEducationForm);
        setEditorMode("educationForm");
    }

    function onEditEducation(index: number) {
        const item = educationList[index];
        if (!item) return;

        setEditingEducationIndex(index);
        setEducationForm({
            school: item.school,
            degree: item.degree,
            faculty: item.faculty,
            fieldOfStudy: item.fieldOfStudy,
            startYear: item.startYear,
            endYear: item.endYear,
            gpa: item.gpa,
        });
        setEditorMode("educationForm");
    }

    async function onSaveEducationForm() {
        try {
            const nextItem: EducationItem = {
                id: editingEducationIndex === null ? makeId("education") : educationList[editingEducationIndex]?.id ?? makeId("education"),
                school: educationForm.school.trim() || "New School",
                degree: educationForm.degree.trim(),
                faculty: educationForm.faculty.trim(),
                fieldOfStudy: educationForm.fieldOfStudy.trim(),
                startYear: educationForm.startYear.trim(),
                endYear: educationForm.endYear.trim(),
                gpa: educationForm.gpa.trim(),
            };

            const nextList = editingEducationIndex === null
                ? [...educationList, nextItem]
                : educationList.map((item, index) => (index === editingEducationIndex ? nextItem : item));

            await savePortfolioSection("education", toEducationPayload(nextList));
            setEducationList(nextList);
            setEducationForm(emptyEducationForm);
            setEditingEducationIndex(null);
            setEditorMode("education");
        } catch (error: any) {
            console.error("Failed to save education:", error);
            alert(error?.message || "Failed to save education");
        }
    }

    function onCancelEducationForm() {
        setEducationForm(emptyEducationForm);
        setEditingEducationIndex(null);
        setEditorMode("education");
    }

    function onAddSkill() {
        setEditingSkillIndex(null);
        setSkillForm(emptySkillForm);
        setEditorMode("skillsForm");
    }

    function onEditSkill(index: number) {
        const item = skills[index];
        if (!item) return;

        setEditingSkillIndex(index);
        setSkillForm({
            name: item.name,
            kind: item.kind,
            source: item.source,
        });
        setEditorMode("skillsForm");
    }

    async function onSaveSkillForm() {
        try {
            const nextItem: SkillItem = {
                id: editingSkillIndex === null ? makeId("skill") : skills[editingSkillIndex]?.id ?? makeId("skill"),
                name: skillForm.name.trim() || "New Skill",
                kind: skillForm.kind,
                source: editingSkillIndex === null ? "upload" : skills[editingSkillIndex]?.source ?? "upload",
                isSelected: editingSkillIndex === null ? true : skills[editingSkillIndex]?.isSelected ?? true,
            };

            const nextList = editingSkillIndex === null
                ? [...skills, nextItem]
                : skills.map((item, index) => (index === editingSkillIndex ? nextItem : item));

            await savePortfolioSection("skills", toSkillsPayload(nextList));
            setSkills(nextList);
            setSkillForm(emptySkillForm);
            setEditingSkillIndex(null);
            setEditorMode("skills");
        } catch (error: any) {
            console.error("Failed to save skills:", error);
            alert(error?.message || "Failed to save skills");
        }
    }

    function onCancelSkillForm() {
        setSkillForm(emptySkillForm);
        setEditingSkillIndex(null);
        setEditorMode("skills");
    }

    async function onToggleSkillSelected(index: number) {
        const nextList = skills.map((item, i) =>
            i === index ? { ...item, isSelected: !item.isSelected } : item
        );

        try {
            await savePortfolioSection("skills", toSkillsPayload(nextList));
            setSkills(nextList);
        } catch (error: any) {
            console.error("Failed to update skills:", error);
            alert(error?.message || "Failed to update skills");
        }
    }

    async function onSelectPlatformSkill(option: SkillItem) {
        const exists = skills.some(
            (item) =>
                item.name.trim().toLowerCase() === option.name.trim().toLowerCase() &&
                item.kind === option.kind &&
                item.source === "platform"
        );
        if (exists) return;

        const nextList = [...skills, { ...option, id: makeId("skill"), isSelected: true }];

        try {
            await savePortfolioSection("skills", toSkillsPayload(nextList));
            setSkills(nextList);
        } catch (error: any) {
            console.error("Failed to add platform skill:", error);
            alert(error?.message || "Failed to add skill");
        }
    }

    function onAddCertificate() {
        setEditingCertificateIndex(null);
        setCertificateForm(emptyCertificateForm);
        setEditorMode("certificateForm");
    }

    function onEditCertificate(index: number) {
        const item = certificates[index];
        if (!item) return;
        setEditingCertificateIndex(index);
        setCertificateForm({ title: item.title, date: item.date, itemType: item.itemType, badgeLink: item.badgeLink, uploadedFileName: "" });
        setEditorMode("certificateForm");
    }

    async function onSaveCertificateForm() {
        try {
            const nextItem: CertificateItem = {
                id: editingCertificateIndex === null ? makeId("certificate") : certificates[editingCertificateIndex]?.id ?? makeId("certificate"),
                title: certificateForm.title.trim() || "New Certificate",
                date: certificateForm.date.trim() || "DD/MM/YYYY",
                itemType: certificateForm.itemType,
                badgeLink: certificateForm.badgeLink,
            };

            const nextList = editingCertificateIndex === null
                ? [...certificates, nextItem]
                : certificates.map((item, index) => (index === editingCertificateIndex ? nextItem : item));

            await savePortfolioSection("certificate", toCertificatesPayload(nextList));
            setCertificates(nextList);
            setCertificateForm(emptyCertificateForm);
            setEditingCertificateIndex(null);
            setEditorMode("certificate");
        } catch (error: any) {
            console.error("Failed to save certificate:", error);
            alert(error?.message || "Failed to save certificate");
        }
    }

    function onCancelCertificateForm() {
        setCertificateForm(emptyCertificateForm);
        setEditingCertificateIndex(null);
        setEditorMode("certificate");
    }

    async function onSelectPlatformCertificate(option: CertificateItem) {
        const exists = certificates.some(
            (item) =>
                item.title.trim().toLowerCase() === option.title.trim().toLowerCase() &&
                item.date.trim() === option.date.trim()
        );
        if (exists) return;

        const nextList = [...certificates, { ...option, id: makeId("certificate") }];

        try {
            await savePortfolioSection("certificate", toCertificatesPayload(nextList));
            setCertificates(nextList);
        } catch (error: any) {
            console.error("Failed to add platform certificate:", error);
            alert(error?.message || "Failed to add certificate");
        }
    }

    function onAddExperience() {
        setEditingExperienceIndex(null);
        setExperienceForm(emptyExperienceForm);
        setEditorMode("experienceForm");
    }

    function onEditExperience(index: number) {
        const item = experiences[index];
        if (!item) return;
        setEditingExperienceIndex(index);
        setExperienceForm({
            period: item.period,
            title: item.title,
            description: item.description,
            source: item.source,
            files: item.files ?? [],
        });
        setEditorMode("experienceForm");
    }

    async function onSaveExperienceForm() {
        try {
            const nextItem: ExperienceItem = {
                id: editingExperienceIndex === null ? makeId("experience") : experiences[editingExperienceIndex]?.id ?? makeId("experience"),
                period: experienceForm.period.trim() || "YYYY",
                title: experienceForm.title.trim() || "New Activity",
                description: experienceForm.description.trim() || "Add activity description.",
                source: experienceForm.source,
                files: experienceForm.source === "upload" ? experienceForm.files : [],
            };

            const nextList = editingExperienceIndex === null
                ? [...experiences, nextItem]
                : experiences.map((item, index) => (index === editingExperienceIndex ? nextItem : item));

            await savePortfolioSection("experience", toExperiencesPayload(nextList));
            setExperiences(nextList);
            setExperienceForm(emptyExperienceForm);
            setEditingExperienceIndex(null);
            setEditorMode("experience");
        } catch (error: any) {
            console.error("Failed to save experience:", error);
            alert(error?.message || "Failed to save experience");
        }
    }

    function onCancelExperienceForm() {
        setExperienceForm(emptyExperienceForm);
        setEditingExperienceIndex(null);
        setEditorMode("experience");
    }

    async function onSelectPlatformExperience(option: ExperienceItem) {
        const exists = experiences.some(
            (item) =>
                item.title.trim().toLowerCase() === option.title.trim().toLowerCase() &&
                item.period.trim() === option.period.trim() &&
                item.source === "platform"
        );
        if (exists) return;

        const nextList = [...experiences, { ...option, id: makeId("experience"), files: [] }];

        try {
            await savePortfolioSection("experience", toExperiencesPayload(nextList));
            setExperiences(nextList);
        } catch (error: any) {
            console.error("Failed to add platform experience:", error);
            alert(error?.message || "Failed to add experience");
        }
    }

    async function onCertificateFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        setIsUploadingCertFile(true);
        setCertificateForm((prev) => ({ ...prev, uploadedFileName: file.name, badgeLink: "" }));

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("bucketName", "vcep-assets-dev");
            formData.append("folderName", "student-certificates");

            const res = await fetch("/api/s3", { method: "PUT", body: formData });
            const result = await res.json();
            if (!res.ok || !result.ok) throw new Error(result.error || "Upload failed");

            const s3Url: string = result.result.url;
            setCertificateForm((prev) => ({ ...prev, badgeLink: s3Url }));
        } catch (error: any) {
            console.error("Certificate file upload failed:", error);
            alert(error?.message || "Failed to upload file");
            setCertificateForm((prev) => ({ ...prev, uploadedFileName: "", badgeLink: "" }));
        } finally {
            setIsUploadingCertFile(false);
        }
    }

    function onExperienceFilesChange(e: ChangeEvent<HTMLInputElement>) {
        const nextFiles = filesToUploadItems(e.target.files);
        if (nextFiles.length === 0) return;
        setExperienceForm((prev) => ({
            ...prev,
            source: "upload",
            files: [...prev.files, ...nextFiles],
        }));
        e.target.value = "";
    }

    function onRemoveExperienceFile(fileId: string) {
        setExperienceForm((prev) => ({
            ...prev,
            files: prev.files.filter((file) => file.id !== fileId),
        }));
    }

    function askDelete(target: "education" | "skills" | "certificate" | "experience", index: number) {
        setDeleteTarget(target);
        setDeleteIndex(index);
        setShowDelete(true);
    }

    async function onConfirmDelete() {
        if (deleteIndex === null || !deleteTarget) return;

        try {
            if (deleteTarget === "education") {
                const nextList = educationList.filter((_, i) => i !== deleteIndex);
                await savePortfolioSection("education", toEducationPayload(nextList));
                setEducationList(nextList);
            }

            if (deleteTarget === "skills") {
                const nextList = skills.filter((_, i) => i !== deleteIndex);
                await savePortfolioSection("skills", toSkillsPayload(nextList));
                setSkills(nextList);
            }

            if (deleteTarget === "certificate") {
                const nextList = certificates.filter((_, i) => i !== deleteIndex);
                await savePortfolioSection("certificate", toCertificatesPayload(nextList));
                setCertificates(nextList);
            }

            if (deleteTarget === "experience") {
                const nextList = experiences.filter((_, i) => i !== deleteIndex);
                await savePortfolioSection("experience", toExperiencesPayload(nextList));
                setExperiences(nextList);
            }

            setDeleteIndex(null);
            setDeleteTarget(null);
            setShowDelete(false);
        } catch (error: any) {
            console.error("Failed to delete portfolio item:", error);
            alert(error?.message || "Failed to delete item");
        }
    }

    function onCloseDelete() {
        setDeleteIndex(null);
        setDeleteTarget(null);
        setShowDelete(false);
    }

    // ฟังก์ชันดึงข้อมูลจาก API
    // ค้นหาฟังก์ชัน fetchPortfolioData (ประมาณบรรทัดที่ 480) และวางทับด้วยโค้ดนี้:

    const fetchPortfolioData = useCallback(async () => {
        setIsLoading(true);

        try {
            const res = await fetch("/api/student/portfolio", {
                method: "GET",
                cache: "no-store",
            });

            const result = await res.json();

            console.log("result: ", result);

            if (!res.ok || !result?.ok) {
                throw new Error(result?.message || "Failed to load portfolio");
            }

            const portfolio = result?.data ?? {};
            const info = portfolio?.student_info ?? {};

            const nextForm = {
                firstName: info.first_name || "",
                lastName: info.last_name || "",
                birthDate: info.birth_date || "",
                phone: info.phone || "",
                email: info.email || "",
                address: info.address || "",
                aboutMe: info.about_me || "",
            };

            setForm(nextForm);
            setLoadedForm(nextForm);

            setPhotoUrl(
                resolveImageUrl(
                    info.profile_image_url ||
                    info.avatar_image_url ||
                    ""
                )
            );

            setEducationList(
                Array.isArray(portfolio.education)
                    ? portfolio.education
                        .map((item: any, index: number) => toEducationItem(item, index))
                        .filter((item: EducationItem) => Boolean(item.school || item.degree || item.faculty || item.fieldOfStudy))
                    : []
            );

            setSkills(
                Array.isArray(portfolio.skills)
                    ? portfolio.skills
                        .map((item: any) => ({
                            id: item.id || makeId("skill"),
                            name: item.name || "",
                            kind: normalizeSkillKind(item.kind),
                            source: normalizeSource(item.source),
                            isSelected: typeof item.isSelected === "boolean" ? item.isSelected : true,
                        }))
                        .filter((item: SkillItem) => item.name)
                    : []
            );

            setCertificates(
                Array.isArray(portfolio.certificates)
                    ? portfolio.certificates
                        .map((item: any, index: number) => ({
                            id: item.id || `certificate-${index}`,
                            title: item.title || "",
                            date: normalizeDate(item.date),
                            itemType: (item.itemType === "badge" ? "badge" : "certificate") as "certificate" | "badge",
                            badgeLink: item.badgeLink || "",
                        }))
                        .filter((item: CertificateItem) => item.title)
                    : []
            );

            setExperiences(
                Array.isArray(portfolio.experiences)
                    ? portfolio.experiences
                        .map((item: any) => ({
                            id: item.id || makeId("experience"),
                            period: item.period || "",
                            title: item.title || "",
                            description: item.description || "",
                            source: normalizeSource(item.source),
                            files: [],
                        }))
                        .filter((item: ExperienceItem) => item.title)
                    : []
            );

            // platform activities from backend (completed activities)
            if (Array.isArray(portfolio.platform_activities)) {
                setApiPlatformExperiences(
                    portfolio.platform_activities
                        .map((item: any) => ({
                            id: item.id || item.activity_id || makeId("platform-exp"),
                            period: item.period || "",
                            title: item.title || item.activity_name || item.name || "",
                            description: item.description || "",
                            source: "platform" as ItemSource,
                            files: [],
                        }))
                        .filter((item: ExperienceItem) => item.title)
                );
            }
        } catch (error) {
            console.error("Failed to fetch portfolio:", error);

            setForm(initialPersonalForm);
            setLoadedForm(initialPersonalForm);
            setEducationList([]);
            setSkills([]);
            setCertificates([]);
            setExperiences([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPortfolioData();
    }, [fetchPortfolioData]);

    // ฟังก์ชันบันทึกข้อมูล (ตัวอย่างสำหรับ Personal Info)
    async function onSavePersonal() {
        try {
            const payload = {
                first_name: form.firstName,
                last_name: form.lastName,
                about_me: form.aboutMe,
                phone: form.phone,
                email: form.email,
                address: form.address,
                birth_date: form.birthDate,
                profile_image_url: photoUrl,
            };

            await savePortfolioSection("info", payload);
            setLoadedForm(form);
        } catch (error: any) {
            console.error("Save failed:", error);
            alert(error?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        }
    }
    if (isLoading) return <div>กำลังโหลดข้อมูล...</div>;

    return (
        <div className={styles.page}>
            <div className={styles.wrap}>
                <section className={styles.editorCard}>
                    {editorMode === "personal" ? (
                        <>
                            <div className={styles.cardTitle}>Personal Information</div>

                            <div className={styles.formScroll}>
                                <div className={styles.field}>
                                    <label className={styles.label}>First name</label>
                                    <input className={styles.input} value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} />
                                </div>

                                <div className={styles.field}>
                                    <label className={styles.label}>Last name</label>
                                    <input className={styles.input} value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} />
                                </div>

                                <div className={styles.row2}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Birth date</label>
                                        <button type="button" className={`${styles.input} ${styles.inputButton}`} onClick={openBirthPicker}>
                                            <span>{form.birthDate || "Select date"}</span>
                                        </button>
                                        <input
                                            ref={birthInputRef}
                                            type="date"
                                            className={styles.nativeDate}
                                            value={form.birthDate}
                                            onChange={(e) => updateField("birthDate", e.target.value)}
                                        />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Phone number</label>
                                        <input className={styles.input} value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label className={styles.label}>Email</label>
                                    <input className={styles.input} value={form.email} onChange={(e) => updateField("email", e.target.value)} />
                                </div>

                                <div className={styles.field}>
                                    <label className={styles.label}>Address</label>
                                    <input className={styles.input} value={form.address} onChange={(e) => updateField("address", e.target.value)} />
                                </div>

                                <div className={styles.field}>
                                    <label className={styles.label}>About me</label>
                                    <textarea className={styles.textarea} value={form.aboutMe} onChange={(e) => updateField("aboutMe", e.target.value)} />
                                </div>
                            </div>

                            <div className={styles.confirmButton}>
                                <button type="button" className={styles.okButtonIcon} onClick={onSavePersonal} disabled={isSaving}>
                                    <img src="/images/icons/button01-icon.png" alt="Save" className={styles.confirmBtnIcon} />
                                </button>

                                <button type="button" className={styles.cancelButtonIcon} onClick={onCancelPersonal}>
                                    <img src="/images/icons/button02-icon.png" alt="Cancel" className={styles.confirmBtnIcon} />
                                </button>
                            </div>
                        </>
                    ) : editorMode === "education" ? (
                        <>
                            <div className={styles.cardTitle}>Education Information</div>

                            <div className={styles.editorScrollArea}>
                                <div className={styles.educationEditorList}>
                                    {educationList.map((item, index) => (
                                        <div key={`${item.id}-${index}`} className={styles.educationEditorRow}>
                                            <div className={styles.educationEditorInputWrap}>
                                                <input
                                                    className={styles.educationEditorInput}
                                                    value={buildEducationLabel(item)}
                                                    readOnly
                                                />
                                            </div>

                                            <button type="button" className={styles.educationEditBtn} onClick={() => onEditEducation(index)}>
                                                <img src="/images/icons/button03-icon.png" alt="Edit" className={styles.educationBtnIcon} />
                                            </button>

                                            <button type="button" className={styles.educationDeleteBtn} onClick={() => askDelete("education", index)}>
                                                <img src="/images/icons/button04-icon.png" alt="Delete" className={styles.educationBtnIcon} />
                                            </button>
                                        </div>
                                    ))}

                                    <button type="button" className={styles.educationAddBtn} onClick={onAddEducation}>
                                        +
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : editorMode === "educationForm" ? (
                        <>
                            <div className={styles.cardTitle}>Add Education Information</div>

                            <div className={styles.editorScrollArea}>
                                <div className={styles.addEducationForm}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Educational institution</label>
                                        <input className={styles.input} value={educationForm.school} onChange={(e) => updateEducationForm("school", e.target.value)} />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Degree Level</label>
                                        <input className={styles.input} value={educationForm.degree} onChange={(e) => updateEducationForm("degree", e.target.value)} />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Faculty</label>
                                        <input className={styles.input} value={educationForm.faculty} onChange={(e) => updateEducationForm("faculty", e.target.value)} />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Field of Study / Major</label>
                                        <input className={styles.input} value={educationForm.fieldOfStudy} onChange={(e) => updateEducationForm("fieldOfStudy", e.target.value)} />
                                    </div>

                                    <div className={styles.formYearRow}>
                                        <div className={styles.field}>
                                            <label className={styles.label}>Start year</label>
                                            <input className={styles.input} value={educationForm.startYear} onChange={(e) => updateEducationForm("startYear", e.target.value)} />
                                        </div>

                                        <div className={styles.field}>
                                            <label className={styles.label}>End year/Currently</label>
                                            <input className={styles.input} value={educationForm.endYear} onChange={(e) => updateEducationForm("endYear", e.target.value)} />
                                        </div>
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>GPA</label>
                                        <input className={styles.input} value={educationForm.gpa} onChange={(e) => updateEducationForm("gpa", e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.confirmButton}>
                                <button type="button" className={styles.okButtonIcon} onClick={onSaveEducationForm} disabled={isSaving}>
                                    <img src="/images/icons/button01-icon.png" alt="Save" className={styles.confirmBtnIcon} />
                                </button>

                                <button type="button" className={styles.cancelButtonIcon} onClick={onCancelEducationForm}>
                                    <img src="/images/icons/button02-icon.png" alt="Cancel" className={styles.confirmBtnIcon} />
                                </button>
                            </div>
                        </>
                    ) : editorMode === "skills" ? (
                        <>
                            <div className={styles.cardTitle}>Skills</div>

                            <div className={styles.editorScrollArea}>
                                <div className={styles.sectionEditorGroup}>
                                    <div className={styles.sectionEditorHeading}>Current items</div>
                                    <div className={styles.sectionEditorList}>
                                        {skills.map((item, index) => (
                                            <div key={item.id} className={styles.sectionEditorRow}>
                                                <div className={styles.sectionEditorTextWrap}>
                                                    <img src={getSourceIcon(item.source)} alt={getSourceLabel(item.source)} className={styles.inlineSourceIcon} />
                                                    <div className={styles.sectionEditorTextBlock}>
                                                        <div className={styles.sectionEditorTitle}>{item.name}</div>
                                                        <div className={styles.sectionEditorMeta}>
                                                            {item.kind === "technical" ? "Technical skills" : "Soft skills"} • {getSourceLabel(item.source)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={styles.skillRowActions}>
                                                    <button
                                                        type="button"
                                                        className={`${styles.skillCheckBtn} ${item.isSelected ? styles.skillCheckBtnActive : ""}`}
                                                        onClick={() => onToggleSkillSelected(index)}
                                                        aria-label={item.isSelected ? "Hide from portfolio" : "Show in portfolio"}
                                                        title={item.isSelected ? "Showing in portfolio" : "Hidden from portfolio"}
                                                    >
                                                        {item.isSelected ? "✓" : ""}
                                                    </button>

                                                    <button type="button" className={styles.educationEditBtn} onClick={() => onEditSkill(index)}>
                                                        <img src="/images/icons/button03-icon.png" alt="Edit" className={styles.educationBtnIcon} />
                                                    </button>

                                                    <button type="button" className={styles.educationDeleteBtn} onClick={() => askDelete("skills", index)}>
                                                        <img src="/images/icons/button04-icon.png" alt="Delete" className={styles.educationBtnIcon} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.sectionActionRow}>
                                    <button type="button" className={styles.secondaryActionBtn} onClick={onAddSkill}>Add new skill</button>
                                </div>

                                <div className={styles.sectionEditorGroup}>
                                    <div className={styles.sectionEditorHeading}>Select from platform</div>
                                    <div className={styles.optionList}>
                                        {platformSkillOptions.map((item) => (
                                            <button key={item.id} type="button" className={styles.optionCard} onClick={() => onSelectPlatformSkill(item)}>
                                                <img src={getSourceIcon("platform")} alt="Platform" className={styles.inlineSourceIcon} />
                                                <div className={styles.optionTextBlock}>
                                                    <div className={styles.optionTitle}>{item.name}</div>
                                                    <div className={styles.optionMeta}>{item.kind === "technical" ? "Technical skills" : "Soft skills"}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : editorMode === "skillsForm" ? (
                        <>
                            <div className={styles.cardTitle}>Add Skill</div>

                            <div className={styles.editorScrollArea}>
                                <div className={styles.addEducationForm}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Skill</label>
                                        <input
                                            className={styles.input}
                                            value={skillForm.name}
                                            onChange={(e) => updateSkillForm("name", e.target.value)}
                                        />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Category</label>
                                        <div className={styles.sourceToggleRow}>
                                            <button
                                                type="button"
                                                className={`${styles.sourceToggleBtn} ${skillForm.kind === "soft" ? styles.sourceToggleBtnActive : ""}`}
                                                onClick={() => updateSkillForm("kind", "soft")}
                                            >
                                                Soft skills
                                            </button>

                                            <button
                                                type="button"
                                                className={`${styles.sourceToggleBtn} ${skillForm.kind === "technical" ? styles.sourceToggleBtnActive : ""}`}
                                                onClick={() => updateSkillForm("kind", "technical")}
                                            >
                                                Technical skills
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles.skillSourceNote}>
                                        <img src={getSourceIcon("upload")} alt="Uploaded by user" className={styles.inlineSourceIcon} />
                                        <span>New skills added from this form are set by the user.</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.confirmButton}>
                                <button type="button" className={styles.okButtonIcon} onClick={onSaveSkillForm} disabled={isSaving}>
                                    <img src="/images/icons/button01-icon.png" alt="Save" className={styles.confirmBtnIcon} />
                                </button>

                                <button type="button" className={styles.cancelButtonIcon} onClick={onCancelSkillForm}>
                                    <img src="/images/icons/button02-icon.png" alt="Cancel" className={styles.confirmBtnIcon} />
                                </button>
                            </div>
                        </>
                    ) : editorMode === "certificate" ? (

                        <>
                            <div className={styles.cardTitle}>Badge and Certificate</div>

                            <div className={styles.editorScrollArea}>
                                <div className={styles.sectionEditorGroup}>
                                    <div className={styles.sectionEditorHeading}>Current items</div>
                                    <div className={styles.sectionEditorList}>
                                        {certificates.map((item, index) => (
                                            <div key={item.id} className={styles.sectionEditorRow}>
                                                <div className={styles.sectionEditorTextWrap}>
                                                    <div className={styles.sectionEditorTextBlock}>
                                                        <div className={styles.sectionEditorTitle}>{item.title}</div>
                                                        <div className={styles.sectionEditorMeta}>
                                                            {item.date} • {item.itemType === "badge" ? "Badge" : "Certificate"}
                                                            {item.badgeLink ? " • File uploaded" : ""}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button type="button" className={styles.educationEditBtn} onClick={() => onEditCertificate(index)}>
                                                    <img src="/images/icons/button03-icon.png" alt="Edit" className={styles.educationBtnIcon} />
                                                </button>

                                                <button type="button" className={styles.educationDeleteBtn} onClick={() => askDelete("certificate", index)}>
                                                    <img src="/images/icons/button04-icon.png" alt="Delete" className={styles.educationBtnIcon} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.sectionActionRow}>
                                    <button type="button" className={styles.secondaryActionBtn} onClick={onAddCertificate}>Upload new certificate</button>
                                </div>

                                <div className={styles.sectionEditorGroup}>
                                    <div className={styles.sectionEditorHeading}>Select from platform</div>
                                    <div className={styles.optionList}>
                                        {platformCertificateOptions.map((item) => (
                                            <button key={item.id} type="button" className={styles.optionCard} onClick={() => onSelectPlatformCertificate(item)}>
                                                <img src={getSourceIcon("platform")} alt="Platform" className={styles.inlineSourceIcon} />
                                                <div className={styles.optionTextBlock}>
                                                    <div className={styles.optionTitle}>{item.title}</div>
                                                    <div className={styles.optionMeta}>{item.date}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : editorMode === "certificateForm" ? (
                        <>
                            <div className={styles.cardTitle}>Add Badge and Certificate</div>
                            <div className={styles.editorScrollArea}>
                                <div className={styles.addEducationForm}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Certificate / Badge name</label>
                                        <input className={styles.input} value={certificateForm.title} onChange={(e) => updateCertificateForm("title", e.target.value)} />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Date</label>
                                        <input className={styles.input} value={certificateForm.date} onChange={(e) => updateCertificateForm("date", e.target.value)} placeholder="DD/MM/YYYY" />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Type</label>
                                        <div className={styles.sourceToggleRow}>
                                            <button
                                                type="button"
                                                className={`${styles.sourceToggleBtn} ${certificateForm.itemType === "certificate" ? styles.sourceToggleBtnActive : ""}`}
                                                onClick={() => updateCertificateForm("itemType", "certificate")}
                                            >
                                                Certificate
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.sourceToggleBtn} ${certificateForm.itemType === "badge" ? styles.sourceToggleBtnActive : ""}`}
                                                onClick={() => updateCertificateForm("itemType", "badge")}
                                            >
                                                Badge
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Upload file (optional)</label>
                                        <input
                                            ref={certificateFileRef}
                                            type="file"
                                            accept="image/*,.pdf"
                                            className={styles.hiddenInput}
                                            onChange={onCertificateFileChange}
                                        />
                                        <button
                                            type="button"
                                            className={styles.uploadPickerBtn}
                                            onClick={() => certificateFileRef.current?.click()}
                                            disabled={isUploadingCertFile}
                                        >
                                            {isUploadingCertFile ? "Uploading..." : "Choose file from device"}
                                        </button>

                                        {certificateForm.uploadedFileName && (
                                            <div className={styles.uploadedFileList}>
                                                <div className={styles.uploadedFileRow}>
                                                    <div className={styles.uploadedFileName}>
                                                        {certificateForm.badgeLink ? "✓ " : ""}{certificateForm.uploadedFileName}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.confirmButton}>
                                <button type="button" className={styles.okButtonIcon} onClick={onSaveCertificateForm} disabled={isSaving}>
                                    <img src="/images/icons/button01-icon.png" alt="Save" className={styles.confirmBtnIcon} />
                                </button>

                                <button type="button" className={styles.cancelButtonIcon} onClick={onCancelCertificateForm}>
                                    <img src="/images/icons/button02-icon.png" alt="Cancel" className={styles.confirmBtnIcon} />
                                </button>
                            </div>
                        </>
                    ) : editorMode === "experience" ? (
                        <>
                            <div className={styles.cardTitle}>Experience and Activity</div>

                            <div className={styles.editorScrollArea}>
                                <div className={styles.sectionEditorGroup}>
                                    <div className={styles.sectionEditorHeading}>Current items</div>
                                    <div className={styles.sectionEditorList}>
                                        {experiences.map((item, index) => (
                                            <div key={item.id} className={styles.sectionEditorRowTall}>
                                                <div className={styles.sectionEditorTextWrapTop}>
                                                    <img src={getSourceIcon(item.source)} alt={getSourceLabel(item.source)} className={styles.inlineSourceIcon} />
                                                    <div className={styles.sectionEditorTextBlock}>
                                                        <div className={styles.sectionEditorTitle}>[{item.period}] - {item.title}</div>
                                                        <div className={styles.sectionEditorDescription}>{item.description}</div>
                                                        <div className={styles.sectionEditorMeta}>{getSourceLabel(item.source)}{item.source === "upload" && item.files.length ? ` • ${item.files.length} file${item.files.length > 1 ? "s" : ""}` : ""}</div>
                                                    </div>
                                                </div>

                                                <div className={styles.sectionEditorButtonCol}>
                                                    <button type="button" className={styles.educationEditBtn} onClick={() => onEditExperience(index)}>
                                                        <img src="/images/icons/button03-icon.png" alt="Edit" className={styles.educationBtnIcon} />
                                                    </button>
                                                    <button type="button" className={styles.educationDeleteBtn} onClick={() => askDelete("experience", index)}>
                                                        <img src="/images/icons/button04-icon.png" alt="Delete" className={styles.educationBtnIcon} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.sectionActionRow}>
                                    <button type="button" className={styles.secondaryActionBtn} onClick={onAddExperience}>Upload new activity</button>
                                </div>

                                <div className={styles.sectionEditorGroup}>
                                    <div className={styles.sectionEditorHeading}>Select from platform</div>
                                    <div className={styles.optionList}>
                                        {apiPlatformExperiences.length === 0 && (
                                            <div className={styles.optionMeta} style={{ padding: "8px 0", color: "#8a827b" }}>
                                                ยังไม่มีกิจกรรมที่เสร็จสมบูรณ์จากแพลตฟอร์ม
                                            </div>
                                        )}
                                        {apiPlatformExperiences.map((item) => (
                                            <button key={item.id} type="button" className={styles.optionCardTall} onClick={() => onSelectPlatformExperience(item)}>
                                                <img src={getSourceIcon("platform")} alt="Platform" className={styles.inlineSourceIcon} />
                                                <div className={styles.optionTextBlock}>
                                                    <div className={styles.optionTitle}>{item.period ? `[${item.period}] - ` : ""}{item.title}</div>
                                                    <div className={styles.optionMeta}>{item.description}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>


                        </>
                    ) : (
                        <>
                            <div className={styles.cardTitle}>Add Experience and Activity</div>
                            <div className={styles.editorScrollArea}>
                                <div className={styles.addEducationForm}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Period</label>
                                        <input className={styles.input} value={experienceForm.period} onChange={(e) => updateExperienceForm("period", e.target.value)} placeholder="2024 - 2025" />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Title</label>
                                        <input className={styles.input} value={experienceForm.title} onChange={(e) => updateExperienceForm("title", e.target.value)} />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Description</label>
                                        <textarea className={styles.textarea} value={experienceForm.description} onChange={(e) => updateExperienceForm("description", e.target.value)} />
                                    </div>

                                    <div className={styles.field}>
                                        <label className={styles.label}>Source</label>
                                        <div className={styles.sourceToggleRow}>
                                            <button
                                                type="button"
                                                className={`${styles.sourceToggleBtn} ${experienceForm.source === "upload" ? styles.sourceToggleBtnActive : ""}`}
                                                onClick={() => updateExperienceForm("source", "upload")}
                                            >
                                                <img src={getSourceIcon("upload")} alt="Uploaded" className={styles.inlineSourceIcon} />
                                                Uploaded by user
                                            </button>

                                        </div>
                                    </div>

                                    {experienceForm.source === "upload" && (
                                        <div className={styles.field}>
                                            <label className={styles.label}>Upload file</label>
                                            <input
                                                ref={experienceUploadRef}
                                                type="file"
                                                multiple
                                                className={styles.hiddenInput}
                                                onChange={onExperienceFilesChange}
                                            />
                                            <button
                                                type="button"
                                                className={styles.uploadPickerBtn}
                                                onClick={() => experienceUploadRef.current?.click()}
                                            >
                                                Choose file from device
                                            </button>

                                            {experienceForm.files.length > 0 && (
                                                <div className={styles.uploadedFileList}>
                                                    {experienceForm.files.map((file) => (
                                                        <div key={file.id} className={styles.uploadedFileRow}>
                                                            <div className={styles.uploadedFileName}>{file.name}</div>
                                                            <button
                                                                type="button"
                                                                className={styles.uploadedFileRemoveBtn}
                                                                onClick={() => onRemoveExperienceFile(file.id)}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.confirmButton}>
                                <button type="button" className={styles.okButtonIcon} onClick={onSaveExperienceForm} disabled={isSaving}>
                                    <img src="/images/icons/button01-icon.png" alt="Save" className={styles.confirmBtnIcon} />
                                </button>

                                <button type="button" className={styles.cancelButtonIcon} onClick={onCancelExperienceForm}>
                                    <img src="/images/icons/button02-icon.png" alt="Cancel" className={styles.confirmBtnIcon} />
                                </button>
                            </div>
                        </>
                    )}
                </section>

                <section className={styles.previewCard}>
                    <div className={styles.previewScroll}>
                        <div className={styles.previewSection}>
                            <button type="button" className={styles.profileCard} onClick={() => !isUploadingPhoto && fileInputRef.current?.click()} title="Upload profile photo" disabled={isUploadingPhoto}>
                                <div className={styles.profileFrame}>
                                    {isUploadingPhoto ? (
                                        <div className={styles.profilePlaceholder}><span>Uploading...</span></div>
                                    ) : photoUrl ? (
                                        <img src={photoUrl} alt="Profile" className={styles.profileImg} />
                                    ) : (
                                        <div className={styles.profilePlaceholder}><span>Upload photo</span></div>
                                    )}
                                </div>
                            </button>

                            <input ref={fileInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={onPhotoChange} />

                            <div className={styles.aboutCard} onClick={openPersonalEditor}>
                                <div className={styles.aboutName}>{fullName || "John Doe"}</div>
                                <div className={styles.aboutText}>{form.aboutMe}</div>

                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}>
                                        <span className={styles.infoLabel}>Phone:</span>
                                        <span>{form.phone || "-"}</span>
                                    </div>
                                    <div className={styles.infoItem}>
                                        <span className={styles.infoLabel}>Email:</span>
                                        <span>{form.email || "-"}</span>
                                    </div>
                                    <div className={`${styles.infoItem} ${styles.fullRow}`}>
                                        <span className={styles.infoLabel}>Address:</span>
                                        <span>{form.address || "-"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.block} onClick={openEducationEditor}>
                            <div className={styles.blockHeader}>
                                <div className={styles.blockTitle}>Education</div>
                            </div>
                            <div className={styles.blockBody}>
                                {educationList.map((item) => (
                                    <div key={item.id} className={styles.simpleLine}>{buildEducationLabel(item)}</div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.skillsSplit} onClick={openSkillsEditor}>
                            <div className={styles.skillsPanel}>
                                <div className={styles.skillsHeaderRow}>
                                    <div className={styles.skillsTitle}>Soft Skills</div>
                                    <div className={styles.skillsTitle}>Technical Skills</div>
                                </div>

                                <div className={styles.skillsBody}>
                                    <div className={styles.skillsColumn}>
                                        {softSkills.map((skill) => <div key={skill.id} className={styles.skillLine}>- {skill.name}</div>)}
                                    </div>

                                    <div className={styles.skillsDivider} />

                                    <div className={styles.skillsColumn}>
                                        {technicalSkills.map((skill) => <div key={skill.id} className={styles.skillLine}>- {skill.name}</div>)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.block} onClick={openCertificateEditor}>
                            <div className={styles.blockHeader}>
                                <div className={styles.blockTitle}>Badge and Certificate</div>
                            </div>
                            <div className={styles.blockBody}>
                                {certificates.filter((c) => c.itemType === "certificate").length > 0 && (
                                    <>
                                        <div className={styles.blockSubTitle}>Certificates</div>
                                        <div className={styles.list}>
                                            {certificates.filter((c) => c.itemType === "certificate").map((item) => (
                                                <div key={item.id} className={styles.listItem}>
                                                    <span className={styles.listText}>- {item.title} ({item.date})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {certificates.filter((c) => c.itemType === "badge").length > 0 && (
                                    <>
                                        <div className={styles.blockSubTitle}>Badges</div>
                                        <div className={styles.list}>
                                            {certificates.filter((c) => c.itemType === "badge").map((item) => (
                                                <div key={item.id} className={styles.listItem}>
                                                    <span className={styles.listText}>- {item.title} ({item.date})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={styles.block} onClick={openExperienceEditor}>
                            <div className={styles.blockHeader}>
                                <div className={styles.blockTitle}>Experience and Activity</div>
                            </div>
                            <div className={styles.blockBody}>
                                <div className={styles.expList}>
                                    {experiences.map((item) => (
                                        <div key={item.id} className={styles.expItem}>
                                            <div className={styles.expTop}>
                                                <img src={getSourceIcon(item.source)} alt={getSourceLabel(item.source)} className={styles.downloadIconImg} />
                                                <span className={styles.expPeriod}>[{item.period}]</span>
                                                <span className={styles.expTitle}>- {item.title}</span>
                                            </div>
                                            <div className={styles.expDesc}>{item.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {showSave && (
                <div className={styles.overlay} onClick={() => setShowSave(false)}>
                    <div className={styles.savePopup} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.saveIcon}>✓</div>
                        <div className={styles.saveText}>Save</div>
                    </div>
                </div>
            )}

            {showDelete && (
                <div className={styles.overlay} onClick={onCloseDelete}>
                    <div className={styles.deletePopup} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.deleteIcon}>🗑</div>
                        <div className={styles.deleteTitle}>Delete</div>
                        <div className={styles.deleteBody}>Are you sure want to delete this information?</div>

                        <div className={styles.deleteActions}>
                            <button type="button" className={styles.deleteNoBtn} onClick={onCloseDelete}>No</button>
                            <button type="button" className={styles.deleteYesBtn} onClick={onConfirmDelete} disabled={isSaving}>Yes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
