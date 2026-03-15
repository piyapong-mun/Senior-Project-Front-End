"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import ExploreHud from "./ExploreHud";
import MapCanvas from "./MapCanvas";
import {
  AVATAR_FOCUS_DIST,
  BUILDING_FOCUS_DIST,
  BUILDING_FOCUS_Y,
  CAMERA_PITCH,
  CAMERA_YAW_A,
  CAMERA_YAW_B,
  CAMERA_YAW_RANGE,
  FLY_DURATION_MS,
  FOOT_Y_OFFSET,
} from "../constants";
import {
  buildCompanyIndex,
  buildFallbackCompany,
  resolveCompanyByMeshName,
} from "../data/companies";
import { useCompanies } from "../hooks/useCompanies";
import type { CamAnimState, Company, HoverBuildingPayload, YawAnimState } from "../types";
import { angleDiff, nearestRoadPointToBuilding, samplePointOnMesh } from "../utils/three";
import type { NavItem } from "@/lib/config/student/routes";
import { STUDENT_SIDEBAR_ITEMS } from "@/lib/config/student/routes";

export default function ExploreScene() {
  const router = useRouter();
  const { companies } = useCompanies();
  const companyIndex = useMemo(() => buildCompanyIndex(companies), [companies]);

  const resolveCompany = useCallback(
    (meshName: string) => resolveCompanyByMeshName(meshName, companyIndex),
    [companyIndex, resolveCompanyByMeshName]
  );

  const roadsRef = useRef<THREE.Mesh[]>([]);
  const spawnedRef = useRef(false);

  const [avatarPosState, setAvatarPosState] = useState<THREE.Vector3 | null>(null);
  const avatarPosRef = useRef(new THREE.Vector3());
  const avatarRef = useRef<THREE.Group | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [hoverBuilding, setHoverBuilding] = useState<HoverBuildingPayload>(null);
  const userName = "Carolyn";

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const camAnimRef = useRef<CamAnimState | null>(null);
  const yawAnimRef = useRef<YawAnimState | null>(null);
  const isAnimatingRef = useRef(false);

  const handleRoadsOnce = useCallback((roads: THREE.Mesh[]) => {
    roadsRef.current = roads;

    if (spawnedRef.current) return;
    spawnedRef.current = true;

    const mesh = roads[Math.floor(Math.random() * roads.length)];
    const p = samplePointOnMesh(mesh);
    if (!p) return;

    p.y += FOOT_Y_OFFSET;
    avatarPosRef.current.copy(p);
    setAvatarPosState(p.clone());
  }, [FOOT_Y_OFFSET, samplePointOnMesh]);

  const handlePickRoad = useCallback((p: THREE.Vector3) => {
    camAnimRef.current = null;

    const pp = p.clone();
    pp.y += FOOT_Y_OFFSET;
    avatarPosRef.current.copy(pp);
    setAvatarPosState(pp);
  }, [FOOT_Y_OFFSET]);

  const flyTo = useCallback(
    (target: THREE.Vector3, dist: number, pendingCompany: Company | null) => {
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

      const toPos = target.clone().add(dir.multiplyScalar(dist));

      camAnimRef.current = {
        active: true,
        t0: performance.now(),
        duration: FLY_DURATION_MS,
        fromPos: cam.position.clone(),
        toPos,
        fromTarget: ctrls.target.clone(),
        toTarget: target.clone(),
        pendingCompany,
      };

      setSelectedCompany(null);
    },
    [
      CAMERA_PITCH,
      CAMERA_YAW_A,
      CAMERA_YAW_B,
      CAMERA_YAW_RANGE,
      FLY_DURATION_MS,
      angleDiff,
      setSelectedCompany,
    ]
  );

  const toggleView = useCallback(() => {
    const ctrls = controlsRef.current;
    const cam = cameraRef.current;
    if (!ctrls || !cam) return;

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
  }, [CAMERA_PITCH, CAMERA_YAW_A, CAMERA_YAW_B, CAMERA_YAW_RANGE, angleDiff]);

  const handlePickBuilding = useCallback(
    (payload: { meshName: string; worldPos: THREE.Vector3; company: Company | null }) => {
      const company = payload.company ?? buildFallbackCompany(payload.meshName);

      const roads = roadsRef.current ?? [];
      const roadP = nearestRoadPointToBuilding(payload.worldPos, roads);
      if (roadP) {
        const avatarP = roadP.clone();
        avatarP.y += FOOT_Y_OFFSET;
        avatarPosRef.current.copy(avatarP);
        setAvatarPosState(avatarP);
      }

      const target = payload.worldPos.clone();
      target.y += BUILDING_FOCUS_Y;
      flyTo(target, BUILDING_FOCUS_DIST, company);
    },
    [
      BUILDING_FOCUS_DIST,
      BUILDING_FOCUS_Y,
      FOOT_Y_OFFSET,
      buildFallbackCompany,
      flyTo,
      nearestRoadPointToBuilding,
    ]
  );

  const focusOnAvatar = useCallback(() => {
    const target = avatarPosRef.current.clone();
    flyTo(target, AVATAR_FOCUS_DIST, null);
  }, [AVATAR_FOCUS_DIST, flyTo]);

  const handleNavItem = useCallback(
    (item: NavItem) => {
      if (item.enabled === false) return;
      router.push(item.href);
    },
    [router]
  );

  return (
    <div
      style={{
        height: "100vh",
        position: "relative",
        background: "#EEE7DE",
        overflow: "hidden",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ExploreHud
        selectedCompany={selectedCompany}
        onCloseCompany={() => setSelectedCompany(null)}
        onToggleView={toggleView}
        onFocusAvatar={focusOnAvatar}
        onNavigate={handleNavItem}
        navItems={STUDENT_SIDEBAR_ITEMS}
        userName={userName}
      />

      <MapCanvas
        controlsRef={controlsRef}
        cameraRef={cameraRef}
        camAnimRef={camAnimRef}
        yawAnimRef={yawAnimRef}
        isAnimatingRef={isAnimatingRef}
        avatarRef={avatarRef}
        avatarPos={avatarPosState}
        userName={userName}
        hoverBuilding={hoverBuilding}
        onRoadMeshesOnce={handleRoadsOnce}
        onPickRoadPoint={handlePickRoad}
        onPickBuilding={handlePickBuilding}
        onHoverBuilding={setHoverBuilding}
        onCameraAnimDone={(company) => {
          if (company) setSelectedCompany(company);
        }}
        resolveCompany={resolveCompany}
      />
    </div>
  );
}
