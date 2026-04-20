import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  PerspectiveCamera,
  useAnimations,
  useGLTF,
} from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import * as React from "react";
import {
  CAMERA_PITCH,
  CAMERA_YAW_A,
  CAMERA_YAW_B,
  CAMERA_YAW_RANGE,
} from "../constants";
import { angleDiff, easeOutCubic, getWorldCenter } from "../utils/three";
import type {
  CamAnimState,
  Company,
  HoverBuildingPayload,
  PickBuildingPayload,
  YawAnimState,
} from "../types";
import { SkeletonUtils } from "three-stdlib";

export type RemotePlayer = {
  userId: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotationY?: number;
  avatarModelUrl?: string | null;
  updatedAt: number;
};

type MapCanvasProps = {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
  camAnimRef: MutableRefObject<CamAnimState | null>;
  yawAnimRef: MutableRefObject<YawAnimState | null>;
  isAnimatingRef: MutableRefObject<boolean>;
  avatarRef: MutableRefObject<THREE.Group | null>;
  avatarPos: THREE.Vector3 | null;
  remotePlayers: RemotePlayer[];
  userName: string;
  avatarModelUrl?: string;
  hoverBuilding: HoverBuildingPayload;
  onRoadMeshesOnce: (roads: THREE.Mesh[]) => void;
  onPickRoadPoint: (p: THREE.Vector3) => void;
  onPickBuilding: (payload: PickBuildingPayload) => void;
  onHoverBuilding: (payload: HoverBuildingPayload) => void;
  onCameraAnimDone: (company: Company | null) => void;
  resolveCompany: (meshName: string) => Company | null;
};

type AvatarPosition = THREE.Vector3 | { x: number; y: number; z: number } | null;

function pickLoopClip(names: string[]) {
  const lower = names.map((n) => n.toLowerCase());

  const idleIdx = lower.findIndex((n) => n.includes("idle"));
  if (idleIdx >= 0) return names[idleIdx];

  const walkIdx = lower.findIndex((n) => n.includes("walk"));
  if (walkIdx >= 0) return names[walkIdx];

  const runIdx = lower.findIndex((n) => n.includes("run"));
  if (runIdx >= 0) return names[runIdx];

  return names[0] ?? null;
}

function CameraAnimator({
  animRef,
  controlsRef,
  cameraRef,
  isAnimatingRef,
  onDone,
}: {
  animRef: MutableRefObject<CamAnimState | null>;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
  isAnimatingRef: MutableRefObject<boolean>;
  onDone: (company: Company | null) => void;
}) {
  useFrame(() => {
    const anim = animRef.current;
    const ctrls = controlsRef.current;
    const cam = cameraRef.current;
    if (!anim || !anim.active || !ctrls || !cam) return;

    const now = performance.now();
    const raw = (now - anim.t0) / anim.duration;
    const t = Math.min(Math.max(raw, 0), 1);
    const k = easeOutCubic(t);

    cam.position.lerpVectors(anim.fromPos, anim.toPos, k);
    ctrls.target.lerpVectors(anim.fromTarget, anim.toTarget, k);

    cam.lookAt(ctrls.target);
    ctrls.update();

    if (t >= 1) {
      anim.active = false;
      const company = anim.pendingCompany;
      animRef.current = null;
      isAnimatingRef.current = false;
      onDone(company);
    }
  });

  return null;
}

function YawAnimator({
  yawAnimRef,
  controlsRef,
  cameraRef,
  isAnimatingRef,
}: {
  yawAnimRef: MutableRefObject<YawAnimState | null>;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
  isAnimatingRef: MutableRefObject<boolean>;
}) {
  useFrame(() => {
    const anim = yawAnimRef.current;
    const ctrls = controlsRef.current;
    const cam = cameraRef.current;
    if (!anim || !anim.active || !ctrls || !cam) return;

    const now = performance.now();
    const raw = (now - anim.t0) / anim.duration;
    const t = Math.min(Math.max(raw, 0), 1);
    const k = easeOutCubic(t);

    const deltaTotal = angleDiff(anim.toYaw, anim.fromYaw);
    const desiredYaw = anim.fromYaw + deltaTotal * k;

    ctrls.setAzimuthalAngle(desiredYaw);
    ctrls.update();

    if (t >= 1) {
      anim.active = false;
      ctrls.minAzimuthAngle = anim.toYaw - anim.range;
      ctrls.maxAzimuthAngle = anim.toYaw + anim.range;
      ctrls.enableDamping = anim.prevEnableDamping;
      yawAnimRef.current = null;
      isAnimatingRef.current = false;
    }
  });

  return null;
}

function MapModel({
  roadNamePrefix = "paved",
  buildingNameIncludes = ["building"],
  onRoadMeshesOnce,
  onPickRoadPoint,
  onPickBuilding,
  onHoverBuilding,
  resolveCompany,
}: {
  roadNamePrefix?: string;
  buildingNameIncludes?: string[];
  onRoadMeshesOnce?: (roads: THREE.Mesh[]) => void;
  onPickRoadPoint?: (p: THREE.Vector3) => void;
  onPickBuilding?: (payload: PickBuildingPayload) => void;
  onHoverBuilding?: (payload: HoverBuildingPayload) => void;
  resolveCompany: (meshName: string) => Company | null;
}) {
  const { scene } = useGLTF("https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com/map/map.glb");
  const { camera, gl } = useThree();

  useEffect(() => {
    scene.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
      }
    });
  }, [scene]);

  const { roadMeshes, buildingMeshes } = useMemo(() => {
    const roads: THREE.Mesh[] = [];
    const buildings: THREE.Mesh[] = [];
    const includes = buildingNameIncludes.map((s) => s.toLowerCase());
    const roadPrefix = roadNamePrefix.toLowerCase();

    scene.traverse((o: any) => {
      if (!o?.isMesh || typeof o.name !== "string") return;
      const n = o.name.toLowerCase();

      if (n.startsWith(roadPrefix)) {
        roads.push(o as THREE.Mesh);
        return;
      }
      if (includes.some((k) => n.includes(k))) {
        buildings.push(o as THREE.Mesh);
      }
    });

    return { roadMeshes: roads, buildingMeshes: buildings };
  }, [scene, roadNamePrefix, buildingNameIncludes]);

  const sentRoadsRef = useRef(false);
  useEffect(() => {
    if (sentRoadsRef.current) return;
    if (!onRoadMeshesOnce) return;
    if (roadMeshes.length === 0) return;

    sentRoadsRef.current = true;
    onRoadMeshesOnce(roadMeshes);
  }, [roadMeshes, onRoadMeshesOnce]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const getNDCFromEvent = useCallback(
    (e: any) => {
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      ndc.set(x, y);
      return ndc;
    },
    [gl, ndc]
  );

  const onPointerMove = useCallback(
    (e: any) => {
      if (!onHoverBuilding) return;

      const v = getNDCFromEvent(e);
      raycaster.setFromCamera(v, camera);

      const hitsB = raycaster.intersectObjects(buildingMeshes, true);
      if (hitsB.length === 0) {
        onHoverBuilding(null);
        return;
      }

      const hitObj = hitsB[0].object;
      const worldPos = getWorldCenter(hitObj);
      const company = resolveCompany(hitObj.name);

      onHoverBuilding({ meshName: hitObj.name, worldPos, company });
    },
    [onHoverBuilding, getNDCFromEvent, raycaster, camera, buildingMeshes, resolveCompany]
  );

  const onPointerUp = useCallback(
    (e: any) => {
      if ((e.delta ?? 0) > 4) return;
      e.stopPropagation();

      const v = getNDCFromEvent(e);
      raycaster.setFromCamera(v, camera);

      const hitsB = raycaster.intersectObjects(buildingMeshes, true);
      if (hitsB.length > 0) {
        const hitObj = hitsB[0].object;
        const worldPos = getWorldCenter(hitObj);
        const company = resolveCompany(hitObj.name);
        onPickBuilding?.({ meshName: hitObj.name, worldPos, company });
        return;
      }

      const hitsR = raycaster.intersectObjects(roadMeshes, true);
      if (hitsR.length === 0) return;
      onPickRoadPoint?.(hitsR[0].point.clone());
    },
    [
      getNDCFromEvent,
      raycaster,
      camera,
      buildingMeshes,
      roadMeshes,
      onPickBuilding,
      onPickRoadPoint,
      resolveCompany,
    ]
  );

  return <primitive object={scene} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />;
}

function NameTag({
  targetRef,
  name,
}: {
  targetRef: React.MutableRefObject<THREE.Object3D | null>;
  name: string;
}) {
  const [pos, setPos] = useState(() => new THREE.Vector3());

  useFrame(() => {
    const obj = targetRef.current;
    if (!obj) return;

    obj.getWorldPosition(pos);
    pos.y += 6.5;
    setPos(pos.clone());
  });

  return (
    <Html position={pos} center>
      <div
        style={{
          position: "relative",
          padding: "10px 18px",
          background: "rgba(216, 92, 92, 0.95)",
          color: "white",
          fontWeight: 900,
          fontSize: 22,
          borderRadius: 5,
          whiteSpace: "nowrap",
          boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
          letterSpacing: 0.2,
          transform: "scale(0.8)",
        }}
      >
        {name}
        <div
          style={{
            position: "absolute",
            left: 28,
            bottom: -8,
            width: 0,
            height: 0,
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderTop: "12px solid rgba(216, 92, 92, 0.95)",
            filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.10))",
          }}
        />
      </div>
    </Html>
  );
}

const Avatar = React.forwardRef<
  THREE.Group,
  {
    modelUrl?: string;
    position: AvatarPosition;
    rotationY?: number;
    scale?: number;
  }
>(({ modelUrl = "/models/boy.glb", position, rotationY = 0, scale = 3 }, ref) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const gltf = useGLTF(modelUrl);
  const clonedScene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const { actions, names, mixer } = useAnimations(gltf.animations, groupRef);

  useEffect(() => {
    if (!groupRef.current || !position) return;

    if (position instanceof THREE.Vector3) {
      groupRef.current.position.copy(position);
    } else {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position]);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = rotationY;
  }, [rotationY]);

  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") ref(groupRef.current as any);
    else (ref as any).current = groupRef.current;
  }, [ref]);

  useEffect(() => {
    if (!names?.length) return;

    names.forEach((n) => actions[n]?.stop());

    const clip = pickLoopClip(names);
    if (!clip) return;

    const action = actions[clip];
    action?.reset();
    action?.setLoop(THREE.LoopRepeat, Infinity);
    action?.fadeIn(0.2);
    action?.play();

    return () => {
      names.forEach((n) => actions[n]?.stop());
    };
  }, [actions, names, modelUrl]);

  useFrame((_, dt) => {
    mixer?.update(dt);
  });

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
});
Avatar.displayName = "Avatar";

function CinematicRig({
  controlsRef,
  isAnimatingRef,
}: {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  isAnimatingRef: MutableRefObject<boolean>;
}) {
  const { camera, scene } = useThree();

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    if (!Number.isFinite(box.min.x)) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 2.2;

    const dir = new THREE.Vector3(
      Math.cos(CAMERA_PITCH) * Math.cos(CAMERA_YAW_A),
      Math.sin(CAMERA_PITCH),
      Math.cos(CAMERA_PITCH) * Math.sin(CAMERA_YAW_A)
    ).normalize();

    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(center).add(dir.multiplyScalar(dist));
    cam.lookAt(center);
    cam.near = dist / 100;
    cam.far = dist * 100;
    cam.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [camera, scene, controlsRef]);

  useFrame(() => {
    const ctrls = controlsRef.current;
    const cam = camera as THREE.PerspectiveCamera;
    if (!ctrls || !cam) return;
    if (isAnimatingRef.current) return;

    const off = cam.position.clone().sub(ctrls.target);
    const curYaw = Math.atan2(off.z, off.x);

    const dA = Math.abs(angleDiff(curYaw, CAMERA_YAW_A));
    const dB = Math.abs(angleDiff(curYaw, CAMERA_YAW_B));
    const yaw = dA <= dB ? CAMERA_YAW_A : CAMERA_YAW_B;

    ctrls.minAzimuthAngle = yaw - CAMERA_YAW_RANGE;
    ctrls.maxAzimuthAngle = yaw + CAMERA_YAW_RANGE;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      zoomSpeed={0.9}
      enableRotate={false}
      enableDamping
      dampingFactor={0.12}
      minPolarAngle={CAMERA_PITCH}
      maxPolarAngle={CAMERA_PITCH}
      minDistance={25}
      maxDistance={260}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: undefined as any,
      }}
      keyEvents={false}
    />
  );
}

export default function MapCanvas({
  controlsRef,
  cameraRef,
  camAnimRef,
  yawAnimRef,
  isAnimatingRef,
  avatarRef,
  avatarPos,
  remotePlayers,
  userName,
  avatarModelUrl,
  hoverBuilding,
  onRoadMeshesOnce,
  onPickRoadPoint,
  onPickBuilding,
  onHoverBuilding,
  onCameraAnimDone,
  resolveCompany,
}: MapCanvasProps) {
  return (
    <Canvas
      shadows
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = "none";
      }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[30, 50, 20]} intensity={1.1} castShadow />
      <hemisphereLight intensity={0.35} />

      <Suspense fallback={null}>
        <PerspectiveCamera
          makeDefault
          fov={18}
          ref={(c) => {
            cameraRef.current = c ?? null;
          }}
        />

        <CinematicRig controlsRef={controlsRef} isAnimatingRef={isAnimatingRef} />

        <CameraAnimator
          animRef={camAnimRef}
          controlsRef={controlsRef}
          cameraRef={cameraRef}
          isAnimatingRef={isAnimatingRef}
          onDone={onCameraAnimDone}
        />

        <YawAnimator
          yawAnimRef={yawAnimRef}
          controlsRef={controlsRef}
          cameraRef={cameraRef}
          isAnimatingRef={isAnimatingRef}
        />

        <MapModel
          roadNamePrefix="paved"
          buildingNameIncludes={["house", "building", "supermarket"]}
          onRoadMeshesOnce={onRoadMeshesOnce}
          onPickRoadPoint={onPickRoadPoint}
          onPickBuilding={onPickBuilding}
          onHoverBuilding={onHoverBuilding}
          resolveCompany={resolveCompany}
        />

        {hoverBuilding?.company?.name ? (
          <Html position={hoverBuilding.worldPos.clone().add(new THREE.Vector3(0, 6, 0))} center>
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(243, 233, 233, 0.92)",
                color: "black",
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 900,
                whiteSpace: "nowrap",
                boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
              }}
            >
              {hoverBuilding.company.name}
            </div>
          </Html>
        ) : null}

        {remotePlayers.map((player) => (
          <Avatar
            key={`${player.userId}-${player.avatarModelUrl || "default"}`}
            modelUrl={player.avatarModelUrl || "/models/boy.glb"}
            position={player.position}
            rotationY={player.rotationY ?? 0}
            scale={3}
          />
        ))}

        <Avatar
          key={avatarModelUrl || "/models/boy.glb"}
          ref={avatarRef}
          modelUrl={avatarModelUrl || "/models/boy.glb"}
          position={avatarPos}
          scale={3}
        />

        <NameTag targetRef={avatarRef as any} name={userName} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload("https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com/map/map.glb");
useGLTF.preload("/models/boy.glb");
