"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./PortfolioPage.module.css";

type ItemSource = "upload" | "platform";

type UploadFileItem = {
    id: string;
    name: string;
};

type CertificateItem = {
    id: string;
    title: string;
    date: string;
    source: ItemSource;
    files: UploadFileItem[];
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
    source: ItemSource;
    files: UploadFileItem[];
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
    firstName: "Carolyn",
    lastName: "Stewart",
    birthDate: "",
    phone: "123-745-9803",
    email: "carolyn.stewart@example.com",
    address: "1754 Maple Drive Houston, PA 71107",
    aboutMe:
        "Experienced professional in design bringing fresh perspectives. Committed to creating impactful solutions and driving positive change.",
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
    source: "upload",
    files: [],
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

const platformSkillOptions: SkillItem[] = [
    { id: "ps1", name: "Presentation", kind: "soft", source: "platform", isSelected: true },
    { id: "ps2", name: "Communication", kind: "soft", source: "platform", isSelected: false },
    { id: "ps3", name: "Teamwork", kind: "soft", source: "platform", isSelected: false },
    { id: "ps4", name: "Problem Solving", kind: "soft", source: "platform", isSelected: false },
    { id: "ps5", name: "React", kind: "technical", source: "platform", isSelected: false },
    { id: "ps6", name: "TypeScript", kind: "technical", source: "platform", isSelected: false },
    { id: "ps7", name: "Cloud Computing", kind: "technical", source: "platform", isSelected: false },
];

const platformCertificateOptions: CertificateItem[] = [
    { id: "pc1", title: "AWS Basic Cloud Computing", date: "01/07/2025", source: "platform", files: [] },
    { id: "pc2", title: "VCEP Python Basic", date: "01/07/2025", source: "platform", files: [] },
    { id: "pc3", title: "Frontend Foundations", date: "15/08/2025", source: "platform", files: [] },
    { id: "pc4", title: "UI Design Principles", date: "01/09/2025", source: "platform", files: [] },
];

const platformExperienceOptions: ExperienceItem[] = [
    {
        id: "pe1",
        period: "2024 - 2025",
        title: "Python Basic",
        description:
            "Accessed basic Python classes in the VCEP platform and learned programming fundamentals, syntax, and problem-solving practice.",
        source: "platform",
        files: [],
    },
    {
        id: "pe2",
        period: "2025",
        title: "UI Layout Explanation Task",
        description:
            "Designed and explained interface layouts with attention to readability, hierarchy, and responsive structure.",
        source: "platform",
        files: [],
    },
    {
        id: "pe3",
        period: "2025",
        title: "Responsive Web Page Workshop",
        description:
            "Built responsive page sections and improved alignment, spacing, and component scaling for multiple screen sizes.",
        source: "platform",
        files: [],
    },
];

function makeId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

export default function PortfolioPage() {
    const birthInputRef = useRef<HTMLInputElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const certificateUploadRef = useRef<HTMLInputElement | null>(null);
    const experienceUploadRef = useRef<HTMLInputElement | null>(null);

    const [showSave, setShowSave] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<"education" | "skills" | "certificate" | "experience" | null>(null);

    const [photoUrl, setPhotoUrl] = useState("");
    const [editorMode, setEditorMode] = useState<EditorMode>("personal");

    const [form, setForm] = useState(initialPersonalForm);

    const [educationList, setEducationList] = useState([
        "Suankularb Wittayalai (2015 - 2021) (GPA: 3.99)",
        "Mahidol University (2022 - 2025) (GPA: 3.94)",
    ]);
    const [educationForm, setEducationForm] = useState<EducationFormState>(emptyEducationForm);
    const [editingEducationIndex, setEditingEducationIndex] = useState<number | null>(null);

    const [skills, setSkills] = useState<SkillItem[]>([
        { id: "s1", name: "Python", kind: "technical", source: "upload", isSelected: true },
        { id: "s2", name: "C++", kind: "technical", source: "upload", isSelected: true },
        { id: "s3", name: "Cloud Computing", kind: "technical", source: "upload", isSelected: false },
        { id: "s4", name: "Presentation", kind: "soft", source: "platform", isSelected: true },
    ]);
    const [skillForm, setSkillForm] = useState<SkillFormState>(emptySkillForm);
    const [editingSkillIndex, setEditingSkillIndex] = useState<number | null>(null);

    const [certificates, setCertificates] = useState<CertificateItem[]>([
        { id: "c1", title: "AWS Cloud Computing for Development", date: "01/07/2025", source: "upload", files: [{ id: "cf1", name: "aws-cloud-computing.pdf" }] },
        { id: "c2", title: "AWS Basic Cloud Computing", date: "01/07/2025", source: "platform", files: [] },
        { id: "c3", title: "VCEP Python Basic", date: "01/07/2025", source: "platform", files: [] },
        { id: "c4", title: "Frontend Foundations", date: "15/08/2025", source: "upload", files: [{ id: "cf2", name: "frontend-foundations.png" }] },
        { id: "c5", title: "UI Design Principles", date: "01/09/2025", source: "platform", files: [] },
    ]);
    const [certificateForm, setCertificateForm] = useState<CertificateFormState>(emptyCertificateForm);
    const [editingCertificateIndex, setEditingCertificateIndex] = useState<number | null>(null);

    const [experiences, setExperiences] = useState<ExperienceItem[]>([
        {
            id: "e1",
            period: "2024 - 2025",
            title: "Python Basic",
            description:
                "Accessed basic Python classes in the VCEP platform and learned programming fundamentals, syntax, and problem-solving practice.",
            source: "platform",
            files: [],
        },
        {
            id: "e2",
            period: "2025",
            title: "UI Layout Explanation Task",
            description:
                "Designed and explained interface layouts with attention to readability, hierarchy, and responsive structure.",
            source: "upload",
            files: [{ id: "ef-upload-1", name: "activity-evidence.pdf" }],
        },
        {
            id: "e3",
            period: "2025",
            title: "Responsive Web Page Workshop",
            description:
                "Built responsive page sections and improved alignment, spacing, and component scaling for multiple screen sizes.",
            source: "platform",
            files: [],
        },
        {
            id: "e4",
            period: "2023 - 2024",
            title: "Frontend Basics",
            description:
                "Learned component-based UI development, page composition, styling systems, and reusable interface blocks.",
            source: "platform",
            files: [],
        },
        {
            id: "e5",
            period: "2023 - 2024",
            title: "Portfolio Preparation",
            description:
                "Collected achievements, summarized skills, and arranged sections into a clean, structured portfolio format.",
            source: "upload",
            files: [{ id: "ef-upload-2", name: "portfolio-summary.docx" }],
        },
    ]);
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

    function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

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

    function onCancelPersonal() {
        setForm(initialPersonalForm);
    }

    function onSavePersonal() {
        setShowSave(true);
    }

    function onAddEducation() {
        setEditingEducationIndex(null);
        setEducationForm(emptyEducationForm);
        setEditorMode("educationForm");
    }

    function onEditEducation(index: number) {
        const item = educationList[index] ?? "";
        const schoolMatch = item.match(/^(.*?)(?:\s*\()/);
        const yearMatch = item.match(/\((\d{4})\s*-\s*(\d{4}|Currently)\)/);
        const gpaMatch = item.match(/GPA:\s*([0-9.]+)/i);

        setEditingEducationIndex(index);
        setEducationForm({
            school: schoolMatch?.[1]?.trim() || item,
            degree: "",
            faculty: "",
            fieldOfStudy: "",
            startYear: yearMatch?.[1] || "",
            endYear: yearMatch?.[2] || "",
            gpa: gpaMatch?.[1] || "",
        });
        setEditorMode("educationForm");
    }

    function onSaveEducationForm() {
        const school = educationForm.school.trim() || "New School";
        const start = educationForm.startYear.trim() || "YYYY";
        const end = educationForm.endYear.trim() || "YYYY";
        const gpa = educationForm.gpa.trim();

        const label = gpa ? `${school} (${start} - ${end}) (GPA: ${gpa})` : `${school} (${start} - ${end})`;

        if (editingEducationIndex === null) {
            setEducationList((prev) => [...prev, label]);
        } else {
            setEducationList((prev) => prev.map((item, index) => (index === editingEducationIndex ? label : item)));
        }

        setEducationForm(emptyEducationForm);
        setEditingEducationIndex(null);
        setEditorMode("education");
        setShowSave(true);
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

    function onSaveSkillForm() {
        const nextItem: SkillItem = {
            id: editingSkillIndex === null ? makeId("skill") : skills[editingSkillIndex]?.id ?? makeId("skill"),
            name: skillForm.name.trim() || "New Skill",
            kind: skillForm.kind,
            source: editingSkillIndex === null ? "upload" : (skills[editingSkillIndex]?.source ?? "upload"),
            isSelected: editingSkillIndex === null ? true : (skills[editingSkillIndex]?.isSelected ?? true),
        };

        if (editingSkillIndex === null) {
            setSkills((prev) => [...prev, nextItem]);
        } else {
            setSkills((prev) => prev.map((item, index) => (index === editingSkillIndex ? nextItem : item)));
        }

        setSkillForm(emptySkillForm);
        setEditingSkillIndex(null);
        setEditorMode("skills");
        setShowSave(true);
    }

    function onCancelSkillForm() {
        setSkillForm(emptySkillForm);
        setEditingSkillIndex(null);
        setEditorMode("skills");
    }

    function onToggleSkillSelected(index: number) {
        setSkills((prev) =>
            prev.map((item, i) =>
                i === index ? { ...item, isSelected: !item.isSelected } : item
            )
        );
    }

    function onSelectPlatformSkill(option: SkillItem) {
        const exists = skills.some(
            (item) =>
                item.name.trim().toLowerCase() === option.name.trim().toLowerCase() &&
                item.kind === option.kind &&
                item.source === "platform"
        );
        if (exists) return;

        setSkills((prev) => [
            ...prev,
            { ...option, id: makeId("skill"), isSelected: true },
        ]);
        setShowSave(true);
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
        setCertificateForm({ title: item.title, date: item.date, source: item.source, files: item.files ?? [] });
        setEditorMode("certificateForm");
    }

    function onSaveCertificateForm() {
        const nextItem: CertificateItem = {
            id: editingCertificateIndex === null ? makeId("certificate") : certificates[editingCertificateIndex]?.id ?? makeId("certificate"),
            title: certificateForm.title.trim() || "New Certificate",
            date: certificateForm.date.trim() || "DD/MM/YYYY",
            source: certificateForm.source,
            files: certificateForm.source === "upload" ? certificateForm.files : [],
        };

        if (editingCertificateIndex === null) {
            setCertificates((prev) => [...prev, nextItem]);
        } else {
            setCertificates((prev) => prev.map((item, index) => (index === editingCertificateIndex ? nextItem : item)));
        }

        setCertificateForm(emptyCertificateForm);
        setEditingCertificateIndex(null);
        setEditorMode("certificate");
        setShowSave(true);
    }

    function onCancelCertificateForm() {
        setCertificateForm(emptyCertificateForm);
        setEditingCertificateIndex(null);
        setEditorMode("certificate");
    }

    function onSelectPlatformCertificate(option: CertificateItem) {
        const exists = certificates.some(
            (item) =>
                item.title.trim().toLowerCase() === option.title.trim().toLowerCase() &&
                item.date.trim() === option.date.trim() &&
                item.source === "platform"
        );
        if (exists) return;

        setCertificates((prev) => [...prev, { ...option, id: makeId("certificate"), files: [] }]);
        setShowSave(true);
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

    function onSaveExperienceForm() {
        const nextItem: ExperienceItem = {
            id: editingExperienceIndex === null ? makeId("experience") : experiences[editingExperienceIndex]?.id ?? makeId("experience"),
            period: experienceForm.period.trim() || "YYYY",
            title: experienceForm.title.trim() || "New Activity",
            description: experienceForm.description.trim() || "Add activity description.",
            source: experienceForm.source,
            files: experienceForm.source === "upload" ? experienceForm.files : [],
        };

        if (editingExperienceIndex === null) {
            setExperiences((prev) => [...prev, nextItem]);
        } else {
            setExperiences((prev) => prev.map((item, index) => (index === editingExperienceIndex ? nextItem : item)));
        }

        setExperienceForm(emptyExperienceForm);
        setEditingExperienceIndex(null);
        setEditorMode("experience");
        setShowSave(true);
    }

    function onCancelExperienceForm() {
        setExperienceForm(emptyExperienceForm);
        setEditingExperienceIndex(null);
        setEditorMode("experience");
    }

    function onSelectPlatformExperience(option: ExperienceItem) {
        const exists = experiences.some(
            (item) =>
                item.title.trim().toLowerCase() === option.title.trim().toLowerCase() &&
                item.period.trim() === option.period.trim() &&
                item.source === "platform"
        );
        if (exists) return;

        setExperiences((prev) => [...prev, { ...option, id: makeId("experience"), files: [] }]);
        setShowSave(true);
    }

    function onCertificateFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
        const nextFiles = filesToUploadItems(e.target.files);
        if (nextFiles.length === 0) return;
        setCertificateForm((prev) => ({
            ...prev,
            source: "upload",
            files: [...prev.files, ...nextFiles],
        }));
        e.target.value = "";
    }

    function onRemoveCertificateFile(fileId: string) {
        setCertificateForm((prev) => ({
            ...prev,
            files: prev.files.filter((file) => file.id !== fileId),
        }));
    }

    function onExperienceFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
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

    function onConfirmDelete() {
        if (deleteIndex === null || !deleteTarget) return;

        if (deleteTarget === "education") {
            setEducationList((prev) => prev.filter((_, i) => i !== deleteIndex));
        }
        if (deleteTarget === "skills") {
            setSkills((prev) => prev.filter((_, i) => i !== deleteIndex));
        }
        if (deleteTarget === "certificate") {
            setCertificates((prev) => prev.filter((_, i) => i !== deleteIndex));
        }
        if (deleteTarget === "experience") {
            setExperiences((prev) => prev.filter((_, i) => i !== deleteIndex));
        }

        setDeleteIndex(null);
        setDeleteTarget(null);
        setShowDelete(false);
        setShowSave(true);
    }

    function onCloseDelete() {
        setDeleteIndex(null);
        setDeleteTarget(null);
        setShowDelete(false);
    }

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
                                <button type="button" className={styles.okButtonIcon} onClick={onSavePersonal}>
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
                                        <div key={`${item}-${index}`} className={styles.educationEditorRow}>
                                            <div className={styles.educationEditorInputWrap}>
                                                <input
                                                    className={styles.educationEditorInput}
                                                    value={item}
                                                    onChange={(e) => {
                                                        const next = [...educationList];
                                                        next[index] = e.target.value;
                                                        setEducationList(next);
                                                    }}
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
                                <button type="button" className={styles.okButtonIcon} onClick={onSaveEducationForm}>
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
                                <button type="button" className={styles.okButtonIcon} onClick={onSaveSkillForm}>
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
                                                    <img src={getSourceIcon(item.source)} alt={getSourceLabel(item.source)} className={styles.inlineSourceIcon} />
                                                    <div className={styles.sectionEditorTextBlock}>
                                                        <div className={styles.sectionEditorTitle}>{item.title}</div>
                                                        <div className={styles.sectionEditorMeta}>{item.date} • {getSourceLabel(item.source)}{item.source === "upload" && item.files.length ? ` • ${item.files.length} file${item.files.length > 1 ? "s" : ""}` : ""}</div>
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
                                        <label className={styles.label}>Source</label>
                                        <div className={styles.sourceToggleRow}>
                                            <button
                                                type="button"
                                                className={`${styles.sourceToggleBtn} ${certificateForm.source === "upload" ? styles.sourceToggleBtnActive : ""}`}
                                                onClick={() => updateCertificateForm("source", "upload")}
                                            >
                                                <img src={getSourceIcon("upload")} alt="Uploaded" className={styles.inlineSourceIcon} />
                                                Uploaded by user
                                            </button>

                                        </div>
                                    </div>

                                    {certificateForm.source === "upload" && (
                                        <div className={styles.field}>
                                            <label className={styles.label}>Upload file</label>
                                            <input
                                                ref={certificateUploadRef}
                                                type="file"
                                                multiple
                                                className={styles.hiddenInput}
                                                onChange={onCertificateFilesChange}
                                            />
                                            <button
                                                type="button"
                                                className={styles.uploadPickerBtn}
                                                onClick={() => certificateUploadRef.current?.click()}
                                            >
                                                Choose file from device
                                            </button>

                                            {certificateForm.files.length > 0 && (
                                                <div className={styles.uploadedFileList}>
                                                    {certificateForm.files.map((file) => (
                                                        <div key={file.id} className={styles.uploadedFileRow}>
                                                            <div className={styles.uploadedFileName}>{file.name}</div>
                                                            <button
                                                                type="button"
                                                                className={styles.uploadedFileRemoveBtn}
                                                                onClick={() => onRemoveCertificateFile(file.id)}
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
                                <button type="button" className={styles.okButtonIcon} onClick={onSaveCertificateForm}>
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
                                        {platformExperienceOptions.map((item) => (
                                            <button key={item.id} type="button" className={styles.optionCardTall} onClick={() => onSelectPlatformExperience(item)}>
                                                <img src={getSourceIcon("platform")} alt="Platform" className={styles.inlineSourceIcon} />
                                                <div className={styles.optionTextBlock}>
                                                    <div className={styles.optionTitle}>[{item.period}] - {item.title}</div>
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
                                <button type="button" className={styles.okButtonIcon} onClick={onSaveExperienceForm}>
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
                            <button type="button" className={styles.profileCard} onClick={() => fileInputRef.current?.click()} title="Upload profile photo">
                                <div className={styles.profileFrame}>
                                    {photoUrl ? <img src={photoUrl} alt="Profile" className={styles.profileImg} /> : <div className={styles.profilePlaceholder}><span>Upload photo</span></div>}
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
                                {educationList.map((item, index) => (
                                    <div key={`${item}-${index}`} className={styles.simpleLine}>{item}</div>
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
                                <div className={styles.list}>
                                    {certificates.map((item) => (
                                        <div key={item.id} className={styles.listItem}>
                                            <img src={getSourceIcon(item.source)} alt={getSourceLabel(item.source)} className={styles.downloadIconImg} />
                                            <span className={styles.listText}>- {item.title} ({item.date})</span>
                                        </div>
                                    ))}
                                </div>
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
                            <button type="button" className={styles.deleteYesBtn} onClick={onConfirmDelete}>Yes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
