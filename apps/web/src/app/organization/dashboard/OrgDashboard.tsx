"use client";

import Image from "next/image";
import { useMemo, useState, useEffect, useRef, type ChangeEvent, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ORGANIZATION_SIDEBAR_ITEMS } from "@/lib/config/organization/routes";
import styles from "./OrgDashboard.module.css";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";


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

type AvatarOption = {
    id: string;
    modelUrl: string;
    unlockLevel: number;
};

type Employee = {
    id: string;
    userId: string;
    orgId: string;
    firstName: string;
    lastName: string;
    position: string;
    phone: string;
    email: string;
    canCheckChallenge: boolean;
    avatarId: string | null;
    legacyAvatarIndex: number | null;
};

const emptyEmp = (id: string, userId = "", orgId = ""): Employee => ({
    id,
    userId,
    orgId,
    firstName: "",
    lastName: "",
    position: "",
    phone: "",
    email: "",
    canCheckChallenge: false,
    avatarId: null,
    legacyAvatarIndex: null,
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
    status: string;
    statusLabel: string;
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


// ─── Employee Avatar Viewer ───────────────────────────────────────────────────

function pickIdleClip(names: string[]) {
    const lowered = names.map((name) => name.toLowerCase());
    const idleIndex = lowered.findIndex((name) => name.includes("idle"));
    if (idleIndex >= 0) return names[idleIndex];
    const loopIndex = lowered.findIndex((name) => name.includes("walk") || name.includes("run"));
    if (loopIndex >= 0) return names[loopIndex];
    return names[0];
}

function AnimatedAvatarGLB({ url }: { url: string }) {
    const group = useRef<THREE.Group>(null);
    const gltf = useGLTF(url);
    const clonedScene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
    const { actions, names, mixer } = useAnimations(gltf.animations, group);

    useEffect(() => {
        if (!names?.length) return;

        names.forEach((name) => {
            const action = actions[name];
            if (!action) return;
            action.stop();
            action.reset();
        });

        const idleName = pickIdleClip(names);
        const activeAction = actions[idleName];
        if (!activeAction) return;

        activeAction.reset();
        activeAction.setLoop(THREE.LoopRepeat, Infinity);
        activeAction.setEffectiveWeight(1);
        activeAction.setEffectiveTimeScale(1);
        activeAction.fadeIn(0.2);
        activeAction.play();

        return () => {
            activeAction.stop();
        };
    }, [actions, names, url]);

    useFrame((_, delta) => mixer?.update(delta));

    return (
        <group ref={group}>
            <primitive object={clonedScene as any} />
        </group>
    );
}

function EmployeeAvatarViewer({ modelUrl }: { modelUrl: string | null }) {
    if (!modelUrl) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f7f7f7",
                    color: "#9ca3af",
                    fontSize: 10,
                    fontWeight: 600,
                }}
            >
                No avatar
            </div>
        );
    }

    return (
        <Canvas
            camera={{ position: [0, 1.25, 1.8] as [number, number, number], fov: 42 }}
            gl={{ alpha: true, antialias: true }}
            dpr={[1, 1.5]}
            onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
            }}
            style={{ width: "100%", height: "100%", display: "block" }}
        >
            <ambientLight intensity={0.9} />
            <directionalLight position={[3, 5, 3]} intensity={1.1} />
            <Suspense fallback={null}>
                <group position={[0, -1.3, 0]} scale={2.0} rotation={[-0.5, -0.5, 0]}>
                    <AnimatedAvatarGLB key={modelUrl} url={modelUrl} />
                </group>
            </Suspense>
        </Canvas>
    );
}

function EmployeeAvatarOptionPreview({ modelUrl }: { modelUrl: string | null }) {
    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
                borderRadius: 12,
                background: "#f7f7f7",
                pointerEvents: "none",
            }}
        >
            <div style={{ position: "absolute", inset: 0 }}>
                <EmployeeAvatarViewer modelUrl={modelUrl} />
            </div>
        </div>
    );
}

// ─── 3D Building Viewer ──────────────────────────────────────────────────────

// FALLBACK_GLB: ไฟล์เล็กที่โหลดได้เสมอ ป้องกัน useGLTF hook เรียกแบบ conditional
const FALLBACK_GLB = "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com/building-models/building-model-typeB.glb";

function NormalizedBuildingInner({ url }: { url: string }) {
  // useGLTF ต้องเรียกเสมอ (ไม่ conditional) — ใช้ fallback ถ้า url ว่าง
  const { scene } = useGLTF(url || FALLBACK_GLB);
  const normalized = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.2 / Math.max(size.y, 0.0001);
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(root);
    const center = scaledBox.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -scaledBox.min.y, -center.z);
    return root;
  }, [scene]);
  return <primitive object={normalized as any} />;
}

function OrgBuildingViewer({ modelUrl }: { modelUrl: string | null }) {
  if (!modelUrl) {
    return (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f7f7f7",
        color: "#9ca3af", fontSize: 12, fontWeight: 500,
      }}>
        No building
      </div>
    );
  }
  return (
    <Canvas
      frameloop="demand"
      // กล้องห่างขึ้น fov เล็กลง = model ดูพอดีใน frame 220px
      camera={{ position: [0, 1.6, 7.2] as [number,number,number], fov: 25 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
      style={{ width: "100%", height: "100%" }}
    >
      {/* แสงนุ่ม เหมือน card อื่น — ambient สว่าง + directional อ่อน */}
      <ambientLight intensity={1.4} />
      <directionalLight position={[5, 10, 6]} intensity={0.7} />
      <directionalLight position={[-4, 4, -4]} intensity={0.25} />
      <Suspense fallback={null}>
        {/* ขยับ model ลงเล็กน้อย + หมุนมุมเดียวกับ fill-more-info */}
        <group position={[0, -0.85, 0] as [number,number,number]} rotation={[-0.06, -0.5, 0] as [number,number,number]}>
          <NormalizedBuildingInner url={modelUrl} />
        </group>
      </Suspense>
    </Canvas>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function OrgDashboardPage() {
    const router = useRouter();
    const [isEditOrgOpen, setIsEditOrgOpen] = useState(false);
    const [isSavedOpen, setIsSavedOpen] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [orgSaving, setOrgSaving] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);

    const [orgDraft, setOrgDraft] = useState<OrgForm>({
        orgName: "",
        companySize: "",
        businessType: "",
        location: "",
        aboutUs: "",
        logoFile: null,
        logoPreview: null,
        email: "",
        phone: "",
        website: "",
        linkedin: "",
        facebook: "",
        instagram: "",
        youtube: "",
        tiktok: "",
    });

    const [summary, setSummary] = useState({
        totalActivities: 0,
        totalParticipants: 0,
        meetings: 0,
        courses: 0,
        challenges: 0,
        published: 0,
        draft: 0,
    });

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [building, setBuilding] = useState<{ buildingId: string; buildingName: string; modelUrl: string | null; previewUrl: string | null } | null>(null);
    const [participantRows, setParticipantRows] = useState<typeof PARTICIPANTS>([]);
    const [activityRows, setActivityRows] = useState<OrgActivityRow[]>([]);
    const [participantBars, setParticipantBars] = useState<GraphBar[]>([]);
    const [skillBars, setSkillBars] = useState<GraphBar[]>([]);

    const [activeEmployeeEmail, setActiveEmployeeEmail] = useState<string>("");
    const [activeOrgId, setActiveOrgId] = useState<string>("");
    const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);
    const [loadingAvatarOptions, setLoadingAvatarOptions] = useState(true);

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
    const [employeeModalMode, setEmployeeModalMode] = useState<"add" | "edit">("add");
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

    const setDraftAvatar = (avatarId: string) => setDraft((prev) => ({ ...prev, avatarId }));

    const openAdd = () => {
        setError("");
        setEmployeeModalMode("add");
        setDraft({
            ...emptyEmp("draft", "", activeOrgId),
            avatarId: avatarOptions[0]?.id ?? null,
        });
        setIsOpen(true);
    };

    const openEditEmployee = (employee: Employee) => {
        setError("");
        setEmployeeModalMode("edit");
        setDraft({
            ...employee,
            orgId: employee.orgId || activeOrgId,
            avatarId: employee.avatarId || resolveAvatarOption(employee)?.id || avatarOptions[0]?.id || null,
        });
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

    function resolveLegacyAvatarIndex(value: unknown) {
        const raw = String(value ?? "").trim();
        if (!raw) return null;
        const match = raw.match(/(\d+)/);
        if (!match) return null;
        const numeric = Number(match[1]);
        if (!Number.isFinite(numeric)) return null;
        return Math.max(0, (numeric || 1) - 1);
    }

    function resolveAvatarOption(employee: Pick<Employee, "avatarId" | "legacyAvatarIndex">) {
        if (!avatarOptions.length) return null;

        const avatarRef = String(employee.avatarId ?? "").trim();

        if (avatarRef) {
            const exact = avatarOptions.find(
                (option) => option.id === avatarRef || option.modelUrl === avatarRef
            );
            if (exact) return exact;

            const refIndex = resolveLegacyAvatarIndex(avatarRef);
            if (refIndex !== null) {
                return avatarOptions[refIndex % avatarOptions.length] ?? avatarOptions[0];
            }
        }

        if (
            typeof employee.legacyAvatarIndex === "number" &&
            employee.legacyAvatarIndex >= 0
        ) {
            return avatarOptions[employee.legacyAvatarIndex % avatarOptions.length] ?? avatarOptions[0];
        }

        return avatarOptions[0];
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


    function formatStatusLabel(value: unknown, fallbackTone?: ActivityStatusTone) {
        const raw = String(value ?? "").trim();
        if (raw) {
            return raw
                .replace(/[_-]+/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .split(" ")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(" ");
        }

        if (fallbackTone === "join") return "Published";
        if (fallbackTone === "ended") return "Ended";
        return "Pending";
    }

    function getStatusBadgeClass(statusTone: ActivityStatusTone) {
        if (statusTone === "join") return `${styles.activityStatusBadge} ${styles.activityStatusBadgeJoin}`;
        if (statusTone === "ended") return `${styles.activityStatusBadge} ${styles.activityStatusBadgeEnded}`;
        return `${styles.activityStatusBadge} ${styles.activityStatusBadgePending}`;
    }

    async function loadAvatarOptions() {
        try {
            setLoadingAvatarOptions(true);
            const response = await fetch("/api/options/avatars/employee", {
                method: "GET",
                cache: "no-store",
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Failed to load employee avatars");
            }

            const options = (await response.json().catch(() => [])) as AvatarOption[];
            const safeOptions = Array.isArray(options) ? options : [];
            setAvatarOptions(safeOptions);
            safeOptions.forEach((option) => {
                if (option?.modelUrl) {
                    useGLTF.preload(option.modelUrl);
                }
            });
        } catch {
            setAvatarOptions([]);
        } finally {
            setLoadingAvatarOptions(false);
        }
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
                orgName: toStringValue(org?.orgName),
                companySize: toStringValue(org?.companySize),
                businessType: toStringValue(org?.businessType),
                location: toStringValue(org?.location),
                aboutUs: toStringValue(org?.aboutUs),
                logoPreview: org?.logoPreview ?? null,
                email: toStringValue(org?.email),
                phone: toStringValue(org?.phone),
                website: toStringValue(org?.website),
                linkedin: toStringValue(org?.linkedin),
                facebook: toStringValue(org?.facebook),
                instagram: toStringValue(org?.instagram),
                youtube: toStringValue(org?.youtube),
                tiktok: toStringValue(org?.tiktok),
            }));

            setSummary({
                totalActivities: toNumber(summaryData?.totalActivities, 0),
                totalParticipants: toNumber(summaryData?.totalParticipants, 0),
                meetings: toNumber(summaryData?.meetings, 0),
                courses: toNumber(summaryData?.courses, 0),
                challenges: toNumber(summaryData?.challenges, 0),
                published: toNumber(summaryData?.published, 0),
                draft: toNumber(summaryData?.draft, 0),
            });

            const nextActivities: OrgActivityRow[] = Array.isArray(data?.activities)
                ? data.activities.map((item: any, index: number) => {
                    const statusTone = deriveStatusTone(item?.statusTone || item?.status);
                    return {
                        id: toStringValue(item?.id, `activity-${index}`),
                        title: toStringValue(item?.title, "Activity"),
                        difficulty: toStringValue(item?.difficulty, "-"),
                        category: toStringValue(
                            item?.category,
                            deriveActivityKind(item?.kind || item?.category)
                        ),
                        kind: deriveActivityKind(item?.kind || item?.category),
                        xp: toNumber(item?.xp, 0),
                        status: toStringValue(item?.status, "pending"),
                        statusLabel: formatStatusLabel(item?.statusLabel || item?.status, statusTone),
                        statusTone,
                    };
                })
                : [];
            setActivityRows(nextActivities);

            const nextParticipants = Array.isArray(data?.participants)
                ? data.participants.map((person: any, index: number) => ({
                    id: toStringValue(person?.id, `participant-${index}`),
                    name: toStringValue(person?.name, `Participant ${index + 1}`),
                    subtitle: toStringValue(person?.subtitle, ""),
                    score: toNumber(person?.score, 0),
                    avatarBg: toStringValue(person?.avatarBg, "#f1d6d8"),
                    initials: toStringValue(person?.initials, "PT"),
                }))
                : [];
            setParticipantRows(nextParticipants);

            const nextEmployees: Employee[] = Array.isArray(data?.employees)
                ? data.employees.map((emp: any, index: number) => ({
                    id: toStringValue(emp?.id ?? emp?.empId, `employee-${index}`),
                    userId: toStringValue(emp?.userId ?? emp?.user_id),
                    orgId: toStringValue(emp?.orgId ?? emp?.org_id ?? data?.account?.orgId),
                    firstName: toStringValue(emp?.firstName),
                    lastName: toStringValue(emp?.lastName),
                    position: toStringValue(emp?.position),
                    phone: toStringValue(emp?.phone),
                    email: toStringValue(emp?.email).toLowerCase(),
                    canCheckChallenge: Boolean(emp?.canCheckChallenge),
                    avatarId: toStringValue(emp?.avatarChoice ?? emp?.avatarId) || null,
                    legacyAvatarIndex: resolveLegacyAvatarIndex(emp?.avatarIndex),
                }))
                : [];
            setEmployees(nextEmployees);

            const nextParticipantBars: GraphBar[] = Array.isArray(data?.participantBars)
                ? data.participantBars.map((item: any, index: number) => ({
                    label: toStringValue(item?.label, `University ${index + 1}`),
                    value: toNumber(item?.value, 0),
                }))
                : [];
            setParticipantBars(nextParticipantBars);

            const nextSkillBars: GraphBar[] = Array.isArray(data?.skillBars)
                ? data.skillBars.map((item: any, index: number) => ({
                    label: toStringValue(item?.label, `Skill ${index + 1}`),
                    value: toNumber(item?.value, 0),
                }))
                : [];
            setSkillBars(nextSkillBars);

            // Building info
            const buildingData = data?.building ?? null;
            setBuilding(buildingData ? {
                buildingId: toStringValue(buildingData?.buildingId),
                buildingName: toStringValue(buildingData?.buildingName),
                modelUrl: buildingData?.modelUrl ?? null,
                previewUrl: buildingData?.previewUrl ?? null,
            } : null);

            const activeEmail = toStringValue(data?.account?.email).toLowerCase();
            setActiveEmployeeEmail(activeEmail);
            setActiveOrgId(toStringValue(data?.account?.orgId));
        } catch (e: any) {
            setPageError(e?.message || "Failed to load organization dashboard");
        } finally {
            setPageLoading(false);
        }
    }

    //     const handleSaveOrg = async () => {
    //         try {
    //             setOrgSaving(true);

            // Step 1: Upload logo to S3 if a new file was selected
            let logoKey: string | undefined;
            if (orgDraft.logoFile) {
                setLogoUploading(true);
                const formData = new FormData();
                formData.append("file", orgDraft.logoFile);

                const uploadRes = await fetch("/api/organization/logo", {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                });

                const uploadJson = await uploadRes.json().catch(() => ({}));
                setLogoUploading(false);

                if (!uploadRes.ok || !uploadJson?.ok || !uploadJson?.key) {
                    throw new Error(uploadJson?.message || "Failed to upload logo");
                }

                logoKey = uploadJson.key;

                // Update preview to show the S3 public URL
                setOrgDraft((prev) => ({
                    ...prev,
                    logoPreview: uploadJson.url,
                    logoFile: null,
                }));
            }

            // Step 2: Save org info (with logo key if uploaded)
            const response = await fetch("/api/organization", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    orgName: orgDraft.orgName,
                    companySize: orgDraft.companySize,
                    businessType: orgDraft.businessType,
                    location: orgDraft.location,
                    aboutUs: orgDraft.aboutUs,
                    email: orgDraft.email,
                    phone: orgDraft.phone,
                    website: orgDraft.website,
                    linkedin: orgDraft.linkedin,
                    facebook: orgDraft.facebook,
                    instagram: orgDraft.instagram,
                    youtube: orgDraft.youtube,
                    tiktok: orgDraft.tiktok,
                    // ส่ง S3 key เมื่อมีการ upload ใหม่ มิฉะนั้นส่ง preview URL เดิม
                    logo: logoKey ?? orgDraft.logoPreview ?? undefined,
                }),
            });

    //             const json = await response.json().catch(() => ({}));

    //             if (!response.ok || !json?.ok) {
    //                 throw new Error(json?.message || "Failed to save organization");
    //             }

            await refreshDashboard();
            setIsEditOrgOpen(false);
            setIsSavedOpen(true);
        } catch (e: any) {
            setLogoUploading(false);
            alert(e?.message || "Failed to save organization");
        } finally {
            setOrgSaving(false);
        }
    };

    const submitEmployee = async () => {
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
            if (employeeModalMode === "edit") {
                if (!draft.userId.trim()) {
                    setError("Missing employee user id.");
                    return;
                }

                const r = await fetch("/api/organization/employees/save-self", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        userId: draft.userId,
                        orgId: draft.orgId || activeOrgId,
                        firstName: draft.firstName.trim(),
                        lastName: draft.lastName.trim(),
                        position: draft.position.trim(),
                        phone: draft.phone.trim(),
                        avatarId: draft.avatarId,
                        canCheckChallenge: draft.canCheckChallenge,
                        email: draft.email.trim().toLowerCase(),
                    }),
                });

                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d?.ok) {
                    setError(d?.message || "Save failed");
                    return;
                }
            } else {
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
                        avatarId: draft.avatarId,
                    }),
                });

                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d?.ok) {
                    setError(d?.message || "Invite failed");
                    return;
                }
            }

            await refreshDashboard();
            setIsOpen(false);
        } catch (e: any) {
            setError(e?.message || (employeeModalMode === "edit" ? "Failed to update employee" : "Failed to add employee"));
        } finally {
            setSaving(false);
        }
    };

    const MAX_EMP = 3;
    const shownEmployees = employees.slice(0, MAX_EMP);
    // ปุ่มเพิ่มหายเมื่อครบ 3 คน
    const canAddMore = employees.length < MAX_EMP;

    // const filteredOrgActivities = useMemo(() => {
    //     // if (selectedActivityKind === "all") return ORG_ACTIVITY_ROWS;
    //     // return ORG_ACTIVITY_ROWS.filter((item) => item.kind === selectedActivityKind);
    //     if (selectedActivityKind === "all") return UPDATED_ACTIVITY_ROWS;
    //     return UPDATED_ACTIVITY_ROWS.filter((item) => item.kind === selectedActivityKind);
    // }, [selectedActivityKind]);

    useEffect(() => {
        loadAvatarOptions();
        refreshDashboard();
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
                        <div className={styles.buildingImg}>
                            <OrgBuildingViewer modelUrl={building?.modelUrl ?? null} />
                        </div>
                        {building?.buildingName && (
                            <div className={styles.buildingLabel}>
                               {building.buildingName}
                            </div>
                        )}
                    </div>

                    <div className={styles.avatarRow}>
                        {/* Employee slots — always 3 columns */}
                        {Array.from({ length: MAX_EMP }, (_, i) => {
                            const emp = shownEmployees[i];
                            if (!emp) {
                                // Slot ว่าง — กดเพื่อเพิ่มพนักงาน
                                return (
                                    <button
                                        key={`empty-${i}`}
                                        type="button"
                                        className={styles.avatarTileEmpty}
                                        onClick={openAdd}
                                        aria-label="Add employee"
                                    />
                                );
                            }
                            const isActive = emp.email === activeEmployeeEmail;
                            const avatarOption = resolveAvatarOption(emp);

                            return (
                                <div
                                    key={emp.id}
                                    className={styles.avatarTile}
                                    title={`Edit ${emp.firstName} ${emp.lastName}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openEditEmployee(emp)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            openEditEmployee(emp);
                                        }
                                    }}
                                    style={{ cursor: "pointer" }}
                                >
                                    <div style={{ position: "relative", display: "inline-block" }}>
                                        <div
                                            className={`${styles.avatarThumb} ${isActive ? styles.avatarThumbActive : ""}`}
                                            style={{ overflow: "hidden" }}
                                        >
                                            <EmployeeAvatarViewer modelUrl={avatarOption?.modelUrl ?? null} />
                                        </div>
                                        {isActive && (
                                            <span style={{
                                                position: "absolute", top: -4, right: -4,
                                                background: "#10b981", borderRadius: "50%",
                                                width: 10, height: 10,
                                                border: "2px solid white", display: "block",
                                            }} />
                                        )}
                                        {emp.canCheckChallenge && (
                                            <span style={{
                                                position: "absolute", bottom: -2, right: -4,
                                                background: "#f59e0b", borderRadius: 4,
                                                fontSize: 8, fontWeight: 700, color: "white",
                                                padding: "1px 3px",
                                            }}>★</span>
                                        )}
                                    </div>
                                    <div className={styles.avatarName}>{emp.firstName}</div>
                                    {emp.position && (
                                        <div style={{ fontSize: 9, color: "#6b7280", marginTop: 1, textAlign: "center" }}>
                                            {emp.position}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

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
                                            <div className={styles.donutHole}>{summary.totalActivities}</div>
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
                                            {[
                                                { label: "Meetings", value: summary.meetings },
                                                { label: "Courses", value: summary.courses },
                                                { label: "Challenges", value: summary.challenges },
                                            ].map((item) => (
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
                                    {(statsTab === "participants" ? participantBars : skillBars).map((item, index) => {
                                        const currentBars = statsTab === "participants" ? participantBars : skillBars;
                                        const max = Math.max(1, ...currentBars.map((bar) => bar.value || 0));
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
                                aria-label="Create new activity"
                                onClick={() => setIsActivityTypeOpen(true)}
                            >
                                <Image
                                    src="/images/icons/button05-icon.png"
                                    alt=""
                                    width={50}
                                    height={50}
                                    className={styles.activityOverviewAddIcon}
                                />
                            </button>
                        </div>

                        <div className={styles.activityOverviewScroll}>
                            {filteredOrgActivities.length === 0 ? (
                                <div className={styles.activityEmptyState}>
                                    No activities created yet.
                                </div>
                            ) : filteredOrgActivities.map((item) => (
                                <div
                                    key={item.id}
                                    className={styles.activityTableRow}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => router.push(`/organization/activities/${item.id}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            router.push(`/organization/activities/${item.id}`);
                                        }
                                    }}
                                >
                                    <div className={styles.activityThumbWrap}>
                                        <div className={styles.activityThumbCard}>
                                            <div className={styles.activityThumbPieceTop} />
                                            <div className={styles.activityThumbPieceBottom} />
                                        </div>
                                    </div>

                                    <div className={styles.activityNameCell} title={item.title}>{item.title}</div>
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
                                        <div className={getStatusBadgeClass(item.statusTone)}>
                                            {item.statusLabel}
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
                <div
                    className={styles.activityCreateOverlay}
                    onClick={() => setIsActivityTypeOpen(false)}
                >
                    <div
                        className={styles.activityCreateModal}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Select activity type"
                    >
                        <button
                            type="button"
                            className={styles.activityCreateClose}
                            onClick={() => setIsActivityTypeOpen(false)}
                            aria-label="Close"
                        >
                            ×
                        </button>

                        <div className={styles.activityCreateHeader}>
                            <div className={styles.activityCreateTitle}>Create activity</div>
                            <div className={styles.activityCreateSubtitle}>
                                Choose the type of activity you want to create.
                            </div>
                        </div>

                        <div className={styles.activityCreateGrid}>
                            {([
                                {
                                    label: "Meetings",
                                    description: "Live sessions, mentoring, interviews, or discussion-based activities.",
                                    route: "meeting",
                                },
                                {
                                    label: "Courses",
                                    description: "Structured learning with modules, lessons, and guided progress.",
                                    route: "course",
                                },
                                {
                                    label: "Challenges",
                                    description: "Hands-on tasks, case work, and portfolio-based submissions.",
                                    route: "challenge",
                                },
                            ] as const).map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    className={styles.activityCreateCard}
                                    onClick={() => {
                                        setIsActivityTypeOpen(false);
                                        router.push(`/organization/activities/${item.route}`);
                                    }}
                                >
                                    <span className={styles.activityCreateCardAccent} />
                                    <div className={styles.activityCreateCardTitle}>{item.label}</div>
                                    <div className={styles.activityCreateCardText}>{item.description}</div>
                                </button>
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
                            <h2 className={styles.modalTitle}>{employeeModalMode === "edit" ? "Edit employee" : "Add employee"}</h2>
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
                                onChange={employeeModalMode === "edit" ? undefined : setDraftField("email")}
                                readOnly={employeeModalMode === "edit"}
                            />
                            {employeeModalMode === "edit" && (
                                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, marginBottom: 8 }}>
                                    Email is read-only here.
                                </div>
                            )}

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
                                {loadingAvatarOptions ? (
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>Loading avatars...</div>
                                ) : avatarOptions.length === 0 ? (
                                    <div style={{ fontSize: 11, color: "#b42318" }}>No employee avatars</div>
                                ) : (
                                    avatarOptions.map((option, index) => {
                                        const on = draft.avatarId === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                className={`${styles.avatarPickBtn} ${on ? styles.avatarPickBtnOn : ""}`}
                                                onClick={() => setDraftAvatar(option.id)}
                                                aria-label={`Select avatar ${index + 1}`}
                                                title={`Employee avatar ${index + 1}`}
                                                style={{
                                                    overflow: "hidden",
                                                    padding: 0,
                                                    position: "relative",
                                                    display: "block",
                                                }}
                                            >
                                                <EmployeeAvatarOptionPreview modelUrl={option.modelUrl} />
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {error && <div className={styles.errorText}>{error}</div>}
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.secondaryBtn} type="button" onClick={closeAdd} disabled={saving}>
                                Cancel
                            </button>
                            <button className={styles.primaryBtn} type="button" onClick={submitEmployee} disabled={saving}>
                                {saving ? "Saving..." : employeeModalMode === "edit" ? "Save changes" : "Send invite"}
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

                                        <label className={styles.popupLogoDrop} style={{ opacity: logoUploading ? 0.6 : 1 }}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className={styles.popupHiddenFile}
                                                onChange={openLogoCrop}
                                                disabled={logoUploading}
                                            />
                                            <div className={styles.popupLogoDropInner}>
                                                {logoUploading ? (
                                                    <div className={styles.popupUploadText}>Uploading...</div>
                                                ) : orgDraft.logoPreview ? (
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
                                        {orgDraft.logoFile && !logoUploading && (
                                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, textAlign: "center" }}>
                                                Ready to upload
                                            </div>
                                        )}
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
                                onClick={handleSaveOrg}
                                disabled={orgSaving || logoUploading}
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
                            src="/images/icons/save-icon.png"
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
