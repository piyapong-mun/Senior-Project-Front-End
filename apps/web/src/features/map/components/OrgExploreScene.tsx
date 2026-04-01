"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import OrgExploreHud from "./OrgExploreHud";
import OrgMapCanvas, {
  type OrgHoverPayload,
  type OrgPickBuildingPayload,
  type RemoteStudent,
} from "./OrgMapCanvas";
import {
  BUILDING_FOCUS_DIST,
  BUILDING_FOCUS_Y,
  CAMERA_PITCH,
  CAMERA_YAW_A,
  CAMERA_YAW_B,
  CAMERA_YAW_RANGE,
  FLY_DURATION_MS,
} from "../constants";
import { angleDiff } from "../utils/three";
import type { CamAnimState, YawAnimState } from "../types";
import type { NavItem } from "@/lib/config/organization/routes";
import { ORGANIZATION_SIDEBAR_ITEMS } from "@/lib/config/organization/routes";

type OrgActivity = {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
  category?: string;
  xp_reward?: number;
  status?: string;
};

type OrgProfileSummary = {
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  totalActivities?: number;
  published?: number;
  draft?: number;
  meetings?: number;
  courses?: number;
  challenges?: number;
  participants?: number;
};

type CurrentOrg = {
  org_id: string;
  org_name: string;
  logo?: string;
  building_mesh_names: string[];
  activities: OrgActivity[];
  profileSummary: OrgProfileSummary;
};

type OrgApiResponse = {
  ok?: boolean;
  data?: any;
  org?: any;
};

type PresenceStudent = {
  id?: string;
  user_id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  position?: { x?: number; y?: number; z?: number };
  avatar_model_url?: string | null;
  modelUrl?: string | null;
};

const MOCK_OCCUPIED_BUILDING_MESH_NAMES = [
  "building-model-01",
  "building-model-02",
  "building-model-03",
  "building-model-04",
] as const;

const MOCK_CURRENT_ACCOUNT_BUILDING_MESH_NAME = "building-model-03";

const DASHBOARD_MOCK_ACTIVITIES: OrgActivity[] = [
  {
    id: "activity-1",
    title: "Frontend Basics & Web Terminology Quiz",
    description: "Course activity focused on basic web concepts and terminology for beginners.",
    difficulty: "Beginner",
    category: "Course",
    xp_reward: 20,
    status: "Pending",
  },
  {
    id: "activity-2",
    title: "UI Layout Explanation Task",
    description: "Explain interface layout choices and core page structure using simple design reasoning.",
    difficulty: "Beginner",
    category: "Course",
    xp_reward: 15,
    status: "Open",
  },
  {
    id: "activity-3",
    title: "Responsive Web Page Workshop",
    description: "Hands-on challenge on responsive page structure and adaptive component behavior.",
    difficulty: "Intermediate",
    category: "Challenge",
    xp_reward: 50,
    status: "Open",
  },
  {
    id: "activity-4",
    title: "Frontend Performance Analysis Case",
    description: "Analyze front-end bottlenecks and propose practical improvements for performance.",
    difficulty: "Advanced",
    category: "Challenge",
    xp_reward: 65,
    status: "Pending",
  },
];

const DASHBOARD_PROFILE_SUMMARY: OrgProfileSummary = {
  description:
    "Quality work requires attention to detail. The best solutions often come from collaboration. Simple ideas can have profound impacts. Every challenge presents an opportunity for growth.",
  phone: "(746) 807-2977",
  email: "emmadavis@hotmail.com",
  address: "Philadelphia, PA",
  totalActivities: 15,
  published: 15,
  draft: 2,
  meetings: 4,
  courses: 8,
  challenges: 5,
  participants: 32,
};

const FALLBACK_ORG: CurrentOrg = {
  org_id: "demo-org",
  org_name: "PeakSystems",
  logo: undefined,
  building_mesh_names: [MOCK_CURRENT_ACCOUNT_BUILDING_MESH_NAME],
  activities: DASHBOARD_MOCK_ACTIVITIES,
  profileSummary: DASHBOARD_PROFILE_SUMMARY,
};

const FALLBACK_REMOTE_STUDENTS: RemoteStudent[] = [
  { id: "p1", name: "Charlotte Garcia", position: new THREE.Vector3(-32, 5, 18), modelUrl: "/models/boy.glb" },
  { id: "p2", name: "Emma Williams", position: new THREE.Vector3(-14, 5, 8), modelUrl: "/models/boy.glb" },
  { id: "p3", name: "James Taylor", position: new THREE.Vector3(6, 5, -4), modelUrl: "/models/boy.glb" },
  { id: "p4", name: "Alexander Davis", position: new THREE.Vector3(18, 5, 12), modelUrl: "/models/boy.glb" },
  { id: "p5", name: "Olivia Davis", position: new THREE.Vector3(28, 5, -18), modelUrl: "/models/boy.glb" },
];

function normalizeActivities(input: unknown): OrgActivity[] {
  if (!Array.isArray(input)) return [];

  return input.map((item: any, index) => ({
    id: String(item?.id ?? item?.activity_id ?? `activity-${index}`),
    title: String(item?.title ?? item?.activity_name ?? "Untitled activity"),
    description:
      typeof item?.description === "string"
        ? item.description
        : typeof item?.activity_description === "string"
          ? item.activity_description
          : undefined,
    difficulty:
      typeof item?.difficulty === "string"
        ? item.difficulty
        : typeof item?.level === "string"
          ? item.level
          : undefined,
    category:
      typeof item?.category === "string"
        ? item.category
        : typeof item?.activity_type === "string"
          ? item.activity_type
          : undefined,
    xp_reward:
      item?.xp_reward == null && item?.xp == null
        ? undefined
        : Number(item?.xp_reward ?? item?.xp ?? 0),
    status:
      typeof item?.status === "string"
        ? item.status
        : typeof item?.activity_status === "string"
          ? item.activity_status
          : undefined,
  }));
}

function buildProfileSummary(payload: any): OrgProfileSummary {
  if (!payload || typeof payload !== "object") return DASHBOARD_PROFILE_SUMMARY;

  return {
    description:
      typeof payload.description === "string"
        ? payload.description
        : typeof payload.about === "string"
          ? payload.about
          : DASHBOARD_PROFILE_SUMMARY.description,
    phone:
      typeof payload.phone === "string" ? payload.phone : DASHBOARD_PROFILE_SUMMARY.phone,
    email:
      typeof payload.email === "string" ? payload.email : DASHBOARD_PROFILE_SUMMARY.email,
    address:
      typeof payload.address === "string" ? payload.address : DASHBOARD_PROFILE_SUMMARY.address,
    totalActivities: Number(payload.total_activities ?? payload.totalActivities ?? DASHBOARD_PROFILE_SUMMARY.totalActivities),
    published: Number(payload.published ?? DASHBOARD_PROFILE_SUMMARY.published),
    draft: Number(payload.draft ?? DASHBOARD_PROFILE_SUMMARY.draft),
    meetings: Number(payload.meetings ?? DASHBOARD_PROFILE_SUMMARY.meetings),
    courses: Number(payload.courses ?? DASHBOARD_PROFILE_SUMMARY.courses),
    challenges: Number(payload.challenges ?? DASHBOARD_PROFILE_SUMMARY.challenges),
    participants: Number(payload.participants ?? payload.total_participants ?? DASHBOARD_PROFILE_SUMMARY.participants),
  };
}

function buildOrgFromPayload(payload: any): CurrentOrg | null {
  if (!payload || typeof payload !== "object") return null;

  const orgName = String(
    payload.org_name ?? payload.organization_name ?? payload.name ?? payload.company_name ?? ""
  ).trim();

  if (!orgName) return null;

  return {
    org_id: String(payload.org_id ?? payload.organization_id ?? payload.id ?? "org"),
    org_name: orgName,
    logo:
      typeof payload.logo === "string"
        ? payload.logo
        : typeof payload.logo_url === "string"
          ? payload.logo_url
          : typeof payload.profile_image_url === "string"
            ? payload.profile_image_url
            : undefined,
    building_mesh_names: [MOCK_CURRENT_ACCOUNT_BUILDING_MESH_NAME],
    activities: normalizeActivities(payload.activities ?? payload.open_activities ?? payload.activity_list),
    profileSummary: buildProfileSummary(payload),
  };
}

function buildRemoteStudentsFromPayload(payload: unknown): RemoteStudent[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item: PresenceStudent, index): RemoteStudent | null => {
      const p = item?.position;
      if (!p || typeof p !== "object") return null;

      const x = Number(p.x ?? 0);
      const y = Number(p.y ?? 0);
      const z = Number(p.z ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

      const firstName = String(item?.first_name ?? "").trim();
      const lastName = String(item?.last_name ?? "").trim();
      const fullName = String(item?.name ?? "").trim();
      const displayName = fullName || `${firstName} ${lastName}`.trim() || `Student ${index + 1}`;

      return {
        id: String(item?.id ?? item?.user_id ?? `student-${index}`),
        name: displayName,
        position: new THREE.Vector3(x, y, z),
        modelUrl: item?.avatar_model_url ?? item?.modelUrl ?? "/models/boy.glb",
      };
    })
    .filter((item): item is RemoteStudent => Boolean(item));
}

export default function OrgExploreScene() {
  const router = useRouter();

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const camAnimRef = useRef<CamAnimState | null>(null);
  const yawAnimRef = useRef<YawAnimState | null>(null);
  const isAnimatingRef = useRef(false);

  const [org, setOrg] = useState<CurrentOrg>(FALLBACK_ORG);
  const [remoteStudents, setRemoteStudents] = useState<RemoteStudent[]>(FALLBACK_REMOTE_STUDENTS);
  const [isOwnBuildingSelected, setIsOwnBuildingSelected] = useState(false);
  const [hoverPayload, setHoverPayload] = useState<OrgHoverPayload>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/organization/me", { cache: "no-store" });
        const json = (await response.json().catch(() => null)) as OrgApiResponse | null;
        if (!response.ok || !json?.ok) return;

        const nextOrg = buildOrgFromPayload(json.data ?? json.org ?? json);
        if (!cancelled && nextOrg) {
          setOrg((prev) => ({
            ...prev,
            ...nextOrg,
            activities: nextOrg.activities.length ? nextOrg.activities : prev.activities,
            profileSummary: {
              ...prev.profileSummary,
              ...nextOrg.profileSummary,
            },
          }));
        }
      } catch {
        // keep mock values
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/organization/explore/students", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) return;

        const nextStudents = buildRemoteStudentsFromPayload(
          json.students ?? json.data?.students ?? json.data ?? []
        );

        if (!cancelled && nextStudents.length) {
          setRemoteStudents(nextStudents);
        }
      } catch {
        // keep mock values
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const ownBuildingMeshNames = useMemo(
    () => org.building_mesh_names.map((name) => name.toLowerCase()),
    [org.building_mesh_names]
  );

  const occupiedBuildingMeshNames = useMemo(
    () => [...MOCK_OCCUPIED_BUILDING_MESH_NAMES].map((name) => name.toLowerCase()),
    []
  );

  const flyTo = useCallback((target: THREE.Vector3, dist: number) => {
    const ctrls = controlsRef.current;
    const cam = cameraRef.current;
    if (!ctrls || !cam) return;

    isAnimatingRef.current = true;

    const off = cam.position.clone().sub(ctrls.target);
    const curYaw = Math.atan2(off.z, off.x);
    const dA = Math.abs(angleDiff(curYaw, CAMERA_YAW_A));
    const dB = Math.abs(angleDiff(curYaw, CAMERA_YAW_B));
    const yaw = dA <= dB ? CAMERA_YAW_A : CAMERA_YAW_B;

    ctrls.minAzimuthAngle = yaw - CAMERA_YAW_RANGE;
    ctrls.maxAzimuthAngle = yaw + CAMERA_YAW_RANGE;

    const dir = new THREE.Vector3(
      Math.cos(CAMERA_PITCH) * Math.cos(yaw),
      Math.sin(CAMERA_PITCH),
      Math.cos(CAMERA_PITCH) * Math.sin(yaw)
    ).normalize();

    camAnimRef.current = {
      active: true,
      t0: performance.now(),
      duration: FLY_DURATION_MS,
      fromPos: cam.position.clone(),
      toPos: target.clone().add(dir.multiplyScalar(dist)),
      fromTarget: ctrls.target.clone(),
      toTarget: target.clone(),
      pendingCompany: null,
    };
  }, []);

  const toggleView = useCallback(() => {
    const ctrls = controlsRef.current;
    if (!ctrls) return;

    isAnimatingRef.current = true;

    const curYaw = ctrls.getAzimuthalAngle();
    const dA = Math.abs(angleDiff(curYaw, CAMERA_YAW_A));
    const dB = Math.abs(angleDiff(curYaw, CAMERA_YAW_B));
    const nextYaw = dA <= dB ? CAMERA_YAW_B : CAMERA_YAW_A;

    ctrls.minAzimuthAngle = -Infinity;
    ctrls.maxAzimuthAngle = Infinity;

    const prevEnableDamping = ctrls.enableDamping;
    ctrls.enableDamping = false;

    yawAnimRef.current = {
      active: true,
      t0: performance.now(),
      duration: 380,
      fromYaw: curYaw,
      toYaw: nextYaw,
      pitch: CAMERA_PITCH,
      range: CAMERA_YAW_RANGE,
      prevEnableDamping,
    };
  }, []);

  const handlePickBuilding = useCallback(
    (payload: OrgPickBuildingPayload) => {
      if (!payload.hasOrganization || !payload.isOwnBuilding) {
        setIsOwnBuildingSelected(false);
        return;
      }

      const target = payload.worldPos.clone();
      target.y += BUILDING_FOCUS_Y;
      flyTo(target, BUILDING_FOCUS_DIST);
      setIsOwnBuildingSelected(true);
    },
    [flyTo]
  );

  const handleNavItem = useCallback(
    (item: NavItem) => {
      if (item.enabled === false) return;
      router.push(item.href);
    },
    [router]
  );

  return (
    <div
      style={{ height: "100vh", position: "relative", background: "#F3EEE8", overflow: "hidden" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <OrgExploreHud
        orgName={org.org_name}
        orgLogoUrl={org.logo}
        activities={org.activities}
        profileSummary={org.profileSummary}
        isOwnBuildingSelected={isOwnBuildingSelected}
        onClosePanel={() => setIsOwnBuildingSelected(false)}
        onToggleView={toggleView}
        onNavigate={handleNavItem}
        navItems={ORGANIZATION_SIDEBAR_ITEMS}
      />

      {hoverPayload && !hoverPayload.hasOrganization ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 22,
            transform: "translateX(-50%)",
            zIndex: 60,
            padding: "8px 18px",
            borderRadius: 999,
            background: "#FEFEFE",
            border: "1px solid #E0D6CD",
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            fontSize: 12,
            fontWeight: 600,
            color: "#666",
            pointerEvents: "none",
          }}
        >
          ตึกนี้ยังไม่มี organization อยู่ในขณะนี้
        </div>
      ) : hoverPayload && !hoverPayload.isOwnBuilding ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 22,
            transform: "translateX(-50%)",
            zIndex: 60,
            padding: "8px 18px",
            borderRadius: 999,
            background: "#FEFEFE",
            border: "1px solid #E0D6CD",
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            fontSize: 12,
            fontWeight: 600,
            color: "#666",
            pointerEvents: "none",
          }}
        >
          ไม่สามารถเปิดดูข้อมูลขององค์กรอื่นได้
        </div>
      ) : null}

      <OrgMapCanvas
        controlsRef={controlsRef}
        cameraRef={cameraRef}
        camAnimRef={camAnimRef}
        yawAnimRef={yawAnimRef}
        isAnimatingRef={isAnimatingRef}
        ownBuildingMeshNames={ownBuildingMeshNames}
        occupiedBuildingMeshNames={occupiedBuildingMeshNames}
        orgName={org.org_name}
        remoteStudents={remoteStudents}
        onPickBuilding={handlePickBuilding}
        onHoverBuilding={setHoverPayload}
        onCameraAnimDone={() => {
          isAnimatingRef.current = false;
        }}
      />
    </div>
  );
}
