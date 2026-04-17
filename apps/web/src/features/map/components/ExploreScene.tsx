"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import ExploreHud from "./ExploreHud";
import MapCanvas, { type RemotePlayer } from "./MapCanvas";
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

type CurrentStudent = {
  user_id: string;
  std_id: string;
  first_name: string;
  last_name: string;
  level: number;
  xp: number;
  xp_max: number;
  avatar_choice: string | null;
  profile_image_url: string | null;
  avatar_model_url: string | null;
  avatar_image_url: string | null;
};

type PositionPayload = {
  x: number;
  y: number;
  z: number;
};

type RealtimeMessage =
  | {
      type: "presence.snapshot";
      players?: RemotePlayer[];
    }
  | {
      type: "presence.update";
      player?: RemotePlayer;
    }
  | {
      type: "presence.leave";
      userId?: string;
    }
  | {
      type: "ack";
      event?: string;
    }
  | {
      type: "error";
      message?: string;
    };

const MAP_ROOM_ID = "student-explore";
const POSITION_SEND_INTERVAL_MS = 140;

function toPositionPayload(value: THREE.Vector3): PositionPayload {
  return {
    x: Number(value.x.toFixed(3)),
    y: Number(value.y.toFixed(3)),
    z: Number(value.z.toFixed(3)),
  };
}

function samePosition(a: PositionPayload, b: PositionPayload) {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export default function ExploreScene() {
  const router = useRouter();
  const { companies } = useCompanies();
  const companyIndex = useMemo(() => buildCompanyIndex(companies), [companies]);

  const resolveCompany = useCallback(
    (meshName: string) => resolveCompanyByMeshName(meshName, companyIndex),
    [companyIndex]
  );

  const roadsRef = useRef<THREE.Mesh[]>([]);
  const spawnedRef = useRef(false);

  const [avatarPosState, setAvatarPosState] = useState<THREE.Vector3 | null>(null);
  const avatarPosRef = useRef(new THREE.Vector3());
  const avatarRef = useRef<THREE.Group | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [hoverBuilding, setHoverBuilding] = useState<HoverBuildingPayload>(null);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);

  const [me, setMe] = useState<CurrentStudent | null>(null);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const camAnimRef = useRef<CamAnimState | null>(null);
  const yawAnimRef = useRef<YawAnimState | null>(null);
  const isAnimatingRef = useRef(false);

  const socketRef = useRef<WebSocket | null>(null);
  const socketReadyRef = useRef(false);
  const joinedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const lastSentPosRef = useRef<PositionPayload | null>(null);
  const lastSentAtRef = useRef(0);

  const applySnapshot = useCallback(
    (players: RemotePlayer[]) => {
      setRemotePlayers(
        players.filter((player) => player.userId && player.userId !== me?.user_id)
      );
    },
    [me?.user_id]
  );

  const upsertRemotePlayer = useCallback(
    (player: RemotePlayer) => {
      if (!player.userId || player.userId === me?.user_id) return;

      setRemotePlayers((previous) => {
        const next = previous.filter((item) => item.userId !== player.userId);
        next.push(player);
        return next;
      });
    },
    [me?.user_id]
  );

  const removeRemotePlayer = useCallback(
    (userId: string) => {
      if (!userId || userId === me?.user_id) return;
      setRemotePlayers((previous) => previous.filter((item) => item.userId !== userId));
    },
    [me?.user_id]
  );

  const sendSocketMessage = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;

    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendJoinIfReady = useCallback(() => {
    if (!me?.user_id || !avatarPosState) return;
    if (!socketReadyRef.current || joinedRef.current) return;

    const currentPos = toPositionPayload(avatarPosState);

    const didSend = sendSocketMessage({
      action: "join",
      roomId: MAP_ROOM_ID,
      position: currentPos,
      avatarModelUrl: me.avatar_model_url || null,
    });

    if (!didSend) return;

    joinedRef.current = true;
    lastSentPosRef.current = currentPos;
    lastSentAtRef.current = Date.now();
  }, [avatarPosState, me?.avatar_model_url, me?.user_id, sendSocketMessage]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch("/api/student", { cache: "no-store" });
        const json = await r.json().catch(() => null);

        if (!r.ok || !json?.ok) return;

        const s = json?.data?.student_info;
        if (!s) return;

        if (!cancelled) {
          setMe({
            user_id: s.user_id ?? "",
            std_id: s.std_id ?? "",
            first_name: s.first_name ?? "",
            last_name: s.last_name ?? "",
            level: Number(s.level ?? 1),
            xp: 0,
            xp_max: Number(s.xp_max ?? 100),
            avatar_choice: s.avatar_choice ?? null,
            profile_image_url: s.profile_image_url ?? null,
            avatar_model_url: s.avatar_model_url ?? null,
            avatar_image_url: s.avatar_image_url ?? null,
          });
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const connectSocket = useCallback(async () => {
    if (!me?.user_id) return;
    if (typeof window === "undefined") return;
    if (socketRef.current) return;

    try {
      const tokenRes = await fetch("/api/realtime/map-token", {
        method: "GET",
        cache: "no-store",
      });
      const tokenJson = await tokenRes.json().catch(() => null);

      if (!tokenRes.ok || !tokenJson?.ok || !tokenJson?.token || !tokenJson?.wsUrl) {
        return;
      }

      const ws = new WebSocket(`${tokenJson.wsUrl}?token=${encodeURIComponent(tokenJson.token)}`);
      socketRef.current = ws;

      ws.onopen = () => {
        socketReadyRef.current = true;
        joinedRef.current = false;
        reconnectAttemptRef.current = 0;
        sendJoinIfReady();
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(String(event.data || "{}")) as RealtimeMessage;

        if (payload.type === "presence.snapshot") {
          applySnapshot(Array.isArray(payload.players) ? payload.players : []);
          return;
        }

        if (payload.type === "presence.update" && payload.player) {
          upsertRemotePlayer(payload.player);
          return;
        }

        if (payload.type === "presence.leave" && payload.userId) {
          removeRemotePlayer(payload.userId);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        socketReadyRef.current = false;
        joinedRef.current = false;
        socketRef.current = null;

        if (cancelledConnect.current) return;

        const nextAttempt = Math.min(reconnectAttemptRef.current + 1, 6);
        reconnectAttemptRef.current = nextAttempt;
        const delayMs = Math.min(1000 * 2 ** (nextAttempt - 1), 12000);

        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          void connectSocket();
        }, delayMs);
      };
    } catch {}
  }, [applySnapshot, me?.user_id, removeRemotePlayer, sendJoinIfReady, upsertRemotePlayer]);

  const cancelledConnect = useRef(false);
  useEffect(() => {
    cancelledConnect.current = false;
    void connectSocket();

    return () => {
      cancelledConnect.current = true;

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      const socket = socketRef.current;
      socketRef.current = null;
      socketReadyRef.current = false;
      joinedRef.current = false;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "component-unmount");
      }
    };
  }, [connectSocket]);

  useEffect(() => {
    sendJoinIfReady();
  }, [sendJoinIfReady]);

  useEffect(() => {
    if (!avatarPosState || !socketReadyRef.current || !joinedRef.current) return;

    const nextPos = toPositionPayload(avatarPosState);
    const lastPos = lastSentPosRef.current;
    const now = Date.now();

    if (lastPos && samePosition(lastPos, nextPos) && now - lastSentAtRef.current < 1000) {
      return;
    }

    if (now - lastSentAtRef.current < POSITION_SEND_INTERVAL_MS) {
      return;
    }

    const didSend = sendSocketMessage({
      action: "position",
      position: nextPos,
      avatarModelUrl: me?.avatar_model_url || null,
    });

    if (!didSend) return;

    lastSentPosRef.current = nextPos;
    lastSentAtRef.current = now;
  }, [avatarPosState, me?.avatar_model_url, sendSocketMessage]);

  useEffect(() => {
    if (!socketReadyRef.current || !joinedRef.current) return;

    const intervalId = window.setInterval(() => {
      sendSocketMessage({ action: "ping" });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [sendSocketMessage]);

  const handleRoadsOnce = useCallback(
    (roads: THREE.Mesh[]) => {
      roadsRef.current = roads;

      if (spawnedRef.current) return;
      spawnedRef.current = true;

      const mesh = roads[Math.floor(Math.random() * roads.length)];
      const p = samplePointOnMesh(mesh);
      if (!p) return;

      p.y += FOOT_Y_OFFSET;
      avatarPosRef.current.copy(p);
      setAvatarPosState(p.clone());
    },
    [samplePointOnMesh]
  );

  const handlePickRoad = useCallback((p: THREE.Vector3) => {
    camAnimRef.current = null;

    const pp = p.clone();
    pp.y += FOOT_Y_OFFSET;
    avatarPosRef.current.copy(pp);
    setAvatarPosState(pp.clone());
  }, []);

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
    []
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
  }, []);

  const handlePickBuilding = useCallback(
    (payload: { meshName: string; worldPos: THREE.Vector3; company: Company | null }) => {
      const company = payload.company ?? buildFallbackCompany(payload.meshName);

      const roads = roadsRef.current ?? [];
      const roadP = nearestRoadPointToBuilding(payload.worldPos, roads);
      if (roadP) {
        const avatarP = roadP.clone();
        avatarP.y += FOOT_Y_OFFSET;
        avatarPosRef.current.copy(avatarP);
        setAvatarPosState(avatarP.clone());
      }

      const target = payload.worldPos.clone();
      target.y += BUILDING_FOCUS_Y;
      flyTo(target, BUILDING_FOCUS_DIST, company);
    },
    [flyTo]
  );

  const focusOnAvatar = useCallback(() => {
    const target = avatarPosRef.current.clone();
    flyTo(target, AVATAR_FOCUS_DIST, null);
  }, [flyTo]);

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
        userName={me?.first_name || ""}
        level={me?.level ?? 1}
        xpCurrent={me?.xp ?? 0}
        xpMax={me?.xp_max ?? 100}
        avatarModelUrl={me?.avatar_model_url || ""}
      />

      <MapCanvas
        controlsRef={controlsRef}
        cameraRef={cameraRef}
        camAnimRef={camAnimRef}
        yawAnimRef={yawAnimRef}
        isAnimatingRef={isAnimatingRef}
        avatarRef={avatarRef}
        avatarPos={avatarPosState}
        remotePlayers={remotePlayers}
        userName={me?.first_name || ""}
        avatarModelUrl={me?.avatar_model_url || ""}
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
