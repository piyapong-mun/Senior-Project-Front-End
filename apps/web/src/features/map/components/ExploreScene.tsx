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
import type {
  CamAnimState,
  Company as BaseCompany,
  HoverBuildingPayload,
  YawAnimState,
} from "../types";
import {
  angleDiff,
  nearestRoadPointToBuilding,
  samplePointOnMesh,
} from "../utils/three";
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

type ExploreActivity = {
  id: string;
  title: string;
  description: string;
  type: string;
  hours: number;
  xp_reward: number;
  status: string;
  is_registered: boolean;
};

type ExploreCompany = BaseCompany & {
  id: string;
  org_id: string;
  name: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  website_url?: string;
  phone?: string;
  email?: string;
  location?: string;
  building_name?: string;
  building_mesh_names: string[];
  activities: ExploreActivity[];
  summary: {
    published: number;
    totalActivities: number;
    challenges: number;
    courses: number;
    meetings: number;
  };
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

const ASSETS_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_ASSETS_PUBLIC_BASE ||
  "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com";

function toPublicAssetUrl(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `${ASSETS_PUBLIC_BASE.replace(/\/$/, "")}/${raw.replace(/^\/+/, "")}`;
}

function normalizeCompanyFromApi(item: any): ExploreCompany | null {
  if (!item || typeof item !== "object") return null;

  const orgId = String(item?.org_id ?? "").trim();
  const name = String(item?.org_name ?? "").trim();
  const buildingMeshNames = Array.isArray(item?.building_mesh_names)
    ? item.building_mesh_names
        .map((name: any) => String(name ?? "").trim().toLowerCase())
        .filter(Boolean)
    : String(item?.building_name ?? "")
        .trim()
        .toLowerCase()
        ? [String(item?.building_name ?? "").trim().toLowerCase()]
        : [];

  if (!name || buildingMeshNames.length === 0) return null;

  const activities: ExploreActivity[] = Array.isArray(item?.activities)
    ? item.activities.map((activity: any) => ({
        id: String(activity?.id ?? activity?.activity_id ?? "").trim(),
        title: String(activity?.title ?? activity?.activity_name ?? "Untitled").trim(),
        description: String(
          activity?.description ?? activity?.activity_detail ?? ""
        ).trim(),
        type: String(activity?.type ?? activity?.activity_type ?? "activity").trim(),
        hours: Number(activity?.hours ?? 0),
        xp_reward: Number(activity?.xp_reward ?? activity?.xp ?? 0),
        status: String(activity?.status ?? "Published").trim(),
        is_registered: Boolean(activity?.is_registered),
      }))
    : [];

  return {
    id: orgId || name.toLowerCase(),
    org_id: orgId,
    name,
    tagline: item?.about_org ? String(item.about_org) : undefined,
    description: item?.about_org ? String(item.about_org) : undefined,
    logoUrl: toPublicAssetUrl(item?.logo),
    website_url: String(item?.website_url ?? "").trim() || undefined,
    phone: String(item?.phone ?? "").trim() || undefined,
    email: String(item?.email ?? "").trim() || undefined,
    location: String(item?.location ?? "").trim() || undefined,
    building_name: String(item?.building_name ?? "").trim() || undefined,
    building_mesh_names: buildingMeshNames,
    activities,
    summary: {
      published: Number(item?.summary?.published ?? activities.length),
      totalActivities: Number(
        item?.summary?.totalActivities ?? item?.summary?.published ?? activities.length
      ),
      challenges: Number(
        item?.summary?.challenges ??
          activities.filter((activity) => activity.type === "challenge").length
      ),
      courses: Number(
        item?.summary?.courses ??
          activities.filter((activity) => activity.type === "course").length
      ),
      meetings: Number(
        item?.summary?.meetings ??
          activities.filter((activity) => activity.type === "meeting").length
      ),
    },
  };
}

export default function ExploreScene() {
  const router = useRouter();

  const roadsRef = useRef<THREE.Mesh[]>([]);
  const spawnedRef = useRef(false);

  const [avatarPosState, setAvatarPosState] = useState<THREE.Vector3 | null>(null);
  const avatarPosRef = useRef(new THREE.Vector3());
  const avatarRef = useRef<THREE.Group | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<ExploreCompany | null>(null);
  const [hoverBuilding, setHoverBuilding] = useState<HoverBuildingPayload>(null);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [companies, setCompanies] = useState<ExploreCompany[]>([]);
  const [searchText, setSearchText] = useState("");
  const [registeringActivityId, setRegisteringActivityId] = useState<string | null>(
    null
  );

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

  const companyIndex = useMemo(() => {
    const next = new Map<string, ExploreCompany>();

    companies.forEach((company) => {
      company.building_mesh_names.forEach((meshName) => {
        next.set(String(meshName).toLowerCase(), company);
      });
    });

    return next;
  }, [companies]);

  const resolveCompany = useCallback(
    (meshName: string): ExploreCompany | null => {
      return companyIndex.get(String(meshName ?? "").toLowerCase()) ?? null;
    },
    [companyIndex]
  );

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
            xp: Number(s.current_exp ?? s.current_xp ?? 0),
            xp_max: Number(s.xp_max ?? Math.max(100, Number(s.level ?? 1) * 100)),
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Fetch buildings and student's joined activities in parallel
        const [buildingsRes, myActivitiesRes] = await Promise.all([
          fetch("/api/student/explore/buildings", { cache: "no-store" }),
          fetch("/api/student/activities", { cache: "no-store" }),
        ]);

        const buildingsJson = await buildingsRes.json().catch(() => null);
        const myActivitiesJson = await myActivitiesRes.json().catch(() => null);

        if (!buildingsRes.ok || !buildingsJson?.ok) return;

        // Build a Set of activity IDs the student has already joined
        console.log("[VCEP debug] myActivitiesJson:", JSON.stringify(myActivitiesJson)?.slice(0, 800));
        const joinedActivityIds = new Set<string>();
        const myList: any[] = (
          myActivitiesJson?.data?.activities ??
          myActivitiesJson?.data?.activity_list ??
          myActivitiesJson?.data ??
          []
        );
        if (Array.isArray(myList)) {
          myList.forEach((a: any) => {
            // Support all PascalCase / camelCase / snake_case variants
            const id = String(
              a?.activity_id ?? a?.ActivityID ?? a?.ActivityId ??
              a?.activityId ?? a?.id ?? a?.ID ?? ""
            ).trim();
            if (id) joinedActivityIds.add(id);
          });
        }
        console.log("[VCEP debug] joinedActivityIds:", [...joinedActivityIds]);

        const nextCompanies = Array.isArray(buildingsJson?.data?.organizations)
          ? buildingsJson.data.organizations
              .map((item: any) => {
                const company = normalizeCompanyFromApi(item);
                if (!company) return null;
                return {
                  ...company,
                  activities: company.activities.map((activity) => ({
                    ...activity,
                    is_registered:
                      activity.is_registered || joinedActivityIds.has(activity.id),
                  })),
                };
              })
              .filter((item: ExploreCompany | null): item is ExploreCompany => Boolean(item))
          : [];

        if (!cancelled) {
          setCompanies(nextCompanies);
        }
      } catch (error) {
        console.error("Failed to load student explore organizations:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;

    const latest = companies.find(
      (company) => company.org_id === selectedCompany.org_id
    );
    if (latest) {
      setSelectedCompany(latest);
    }
  }, [companies, selectedCompany]);

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
      setRemotePlayers((previous) =>
        previous.filter((item) => item.userId !== userId)
      );
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

  const cancelledConnect = useRef(false);

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

      const ws = new WebSocket(
        `${tokenJson.wsUrl}?token=${encodeURIComponent(tokenJson.token)}`
      );
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
    if (!me?.user_id || !avatarPosState) return;
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

  const handleRoadsOnce = useCallback((roads: THREE.Mesh[]) => {
    roadsRef.current = roads;

    if (spawnedRef.current) return;
    spawnedRef.current = true;

    const mesh = roads[Math.floor(Math.random() * roads.length)];
    const point = samplePointOnMesh(mesh);
    if (!point) return;

    point.y += FOOT_Y_OFFSET;
    avatarPosRef.current.copy(point);
    setAvatarPosState(point.clone());
  }, []);

  const handlePickRoad = useCallback((point: THREE.Vector3) => {
    camAnimRef.current = null;

    const nextPoint = point.clone();
    nextPoint.y += FOOT_Y_OFFSET;
    avatarPosRef.current.copy(nextPoint);
    setAvatarPosState(nextPoint.clone());
  }, []);

  const flyTo = useCallback(
    (target: THREE.Vector3, dist: number, pendingCompany: BaseCompany | null) => {
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

    const off = cam.position.clone().sub(ctrls.target);
    const curYaw = Math.atan2(off.z, off.x);
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
    (payload: {
      meshName: string;
      worldPos: THREE.Vector3;
      company: BaseCompany | null;
    }) => {
      const company = payload.company as ExploreCompany | null;
      if (!company) return;

      const roads = roadsRef.current ?? [];
      const roadPoint = nearestRoadPointToBuilding(payload.worldPos, roads);

      if (roadPoint) {
        const avatarPoint = roadPoint.clone();
        avatarPoint.y += FOOT_Y_OFFSET;
        avatarPosRef.current.copy(avatarPoint);
        setAvatarPosState(avatarPoint.clone());
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

  const markActivityRegistered = useCallback((activityId: string) => {
    setCompanies((previous) =>
      previous.map((company) => ({
        ...company,
        activities: company.activities.map((activity) =>
          activity.id === activityId
            ? { ...activity, is_registered: true }
            : activity
        ),
      }))
    );
  }, []);

  const handleRegisterActivity = useCallback(
    async (activityId: string) => {
      try {
        setRegisteringActivityId(activityId);

        const res = await fetch("/api/student/explore/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ activity_id: activityId }),
        });

        const json = await res.json().catch(() => null);

        // already registered — mark silently, no alert
        if (json?.already_registered) {
          markActivityRegistered(activityId);
          return;
        }

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || "Failed to register activity");
        }

        markActivityRegistered(activityId);
      } catch (error: any) {
        console.error("Register activity failed:", error);
        window.alert(error?.message || "Failed to register activity");
      } finally {
        setRegisteringActivityId(null);
      }
    },
    [markActivityRegistered]
  );

  return (
    <div
      style={{
        height: "100vh",
        position: "relative",
        background: "#EEE7DE",
        overflow: "hidden",
      }}
      onContextMenu={(event) => event.preventDefault()}
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
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onRegisterActivity={handleRegisterActivity}
        registeringActivityId={registeringActivityId}
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
          if (company) {
            setSelectedCompany(company as ExploreCompany);
          }
        }}
        resolveCompany={resolveCompany}
      />
    </div>
  );
}
