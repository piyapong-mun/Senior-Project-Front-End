"use client";

import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera, useAnimations, useGLTF } from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import * as React from "react";
import { CAMERA_PITCH, CAMERA_YAW_A, CAMERA_YAW_B, CAMERA_YAW_RANGE } from "../constants";
import { angleDiff, easeOutCubic, getWorldCenter } from "../utils/three";
import type { CamAnimState, YawAnimState } from "../types";
import { SkeletonUtils } from "three-stdlib";

export type OrgPickBuildingPayload = {
  meshName: string;
  worldPos: THREE.Vector3;
  isOwnBuilding: boolean;
  hasOrganization: boolean;
};

export type OrgHoverPayload = {
  meshName: string;
  worldPos: THREE.Vector3;
  isOwnBuilding: boolean;
  hasOrganization: boolean;
} | null;

export type RemoteStudent = {
  id: string;
  name: string;
  position: THREE.Vector3;
  modelUrl?: string;
};

type OrgMapCanvasProps = {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
  camAnimRef: MutableRefObject<CamAnimState | null>;
  yawAnimRef: MutableRefObject<YawAnimState | null>;
  isAnimatingRef: MutableRefObject<boolean>;
  ownBuildingMeshNames: string[];
  occupiedBuildingMeshNames: string[];
  orgName: string;
  remoteStudents?: RemoteStudent[];
  onPickBuilding: (payload: OrgPickBuildingPayload) => void;
  onHoverBuilding: (payload: OrgHoverPayload) => void;
  onCameraAnimDone: () => void;
};

const MAP_GLB = "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com/map/map.glb";

function pickLoopClip(names: string[]) {
  const lower = names.map((name) => name.toLowerCase());

  const idleIndex = lower.findIndex((name) => name.includes("idle"));
  if (idleIndex >= 0) return names[idleIndex];

  const walkIndex = lower.findIndex((name) => name.includes("walk"));
  if (walkIndex >= 0) return names[walkIndex];

  const runIndex = lower.findIndex((name) => name.includes("run"));
  if (runIndex >= 0) return names[runIndex];

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
  onDone: () => void;
}) {
  useFrame(() => {
    const anim = animRef.current;
    const ctrls = controlsRef.current;
    const cam = cameraRef.current;
    if (!anim?.active || !ctrls || !cam) return;

    const t = Math.min((performance.now() - anim.t0) / anim.duration, 1);
    const k = easeOutCubic(t);

    cam.position.lerpVectors(anim.fromPos, anim.toPos, k);
    ctrls.target.lerpVectors(anim.fromTarget, anim.toTarget, k);

    cam.lookAt(ctrls.target);
    ctrls.update();

    if (t >= 1) {
      anim.active = false;
      animRef.current = null;
      isAnimatingRef.current = false;
      onDone();
    }
  });

  return null;
}

function YawAnimator({
  yawAnimRef,
  controlsRef,
  isAnimatingRef,
}: {
  yawAnimRef: MutableRefObject<YawAnimState | null>;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  isAnimatingRef: MutableRefObject<boolean>;
}) {
  useFrame(() => {
    const anim = yawAnimRef.current;
    const ctrls = controlsRef.current;
    if (!anim?.active || !ctrls) return;

    const t = Math.min((performance.now() - anim.t0) / anim.duration, 1);
    const k = easeOutCubic(t);

    ctrls.setAzimuthalAngle(anim.fromYaw + angleDiff(anim.toYaw, anim.fromYaw) * k);
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

    const dist = Math.max(size.x, size.y, size.z) * 2.2;
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
    if (!ctrls || !cam || isAnimatingRef.current) return;

    const off = cam.position.clone().sub(ctrls.target);
    const curYaw = Math.atan2(off.z, off.x);
    const yaw =
      Math.abs(angleDiff(curYaw, CAMERA_YAW_A)) <= Math.abs(angleDiff(curYaw, CAMERA_YAW_B))
        ? CAMERA_YAW_A
        : CAMERA_YAW_B;

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

function tintMaterialTowardWhite(material: any, amount: number) {
  if (!material?.color) return;
  material.color.lerp(new THREE.Color("#ffffff"), amount);
}

function OrgMapModel({
  ownBuildingMeshNames,
  occupiedBuildingMeshNames,
  onPickBuilding,
  onHoverBuilding,
}: {
  ownBuildingMeshNames: string[];
  occupiedBuildingMeshNames: string[];
  onPickBuilding: (payload: OrgPickBuildingPayload) => void;
  onHoverBuilding: (payload: OrgHoverPayload) => void;
}) {
  const { scene } = useGLTF(MAP_GLB);
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

  const ownSet = useMemo(
    () => new Set(ownBuildingMeshNames.map((name) => name.toLowerCase())),
    [ownBuildingMeshNames]
  );

  const occupiedSet = useMemo(
    () => new Set(occupiedBuildingMeshNames.map((name) => name.toLowerCase())),
    [occupiedBuildingMeshNames]
  );

  const { buildingMeshes, emptyBuildingMeshes } = useMemo(() => {
    const all: THREE.Mesh[] = [];
    const empty: THREE.Mesh[] = [];

    scene.traverse((obj: any) => {
      if (!obj?.isMesh || typeof obj.name !== "string") return;
      const name = obj.name.toLowerCase();
      if (!name.startsWith("building-model-")) return;

      all.push(obj as THREE.Mesh);
      if (!occupiedSet.has(name)) {
        empty.push(obj as THREE.Mesh);
      }
    });

    return { buildingMeshes: all, emptyBuildingMeshes: empty };
  }, [scene, occupiedSet]);

  useEffect(() => {
    const originalMaterialByMesh = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const createdMaterials: THREE.Material[] = [];

    emptyBuildingMeshes.forEach((mesh) => {
      originalMaterialByMesh.set(mesh, mesh.material);

      if (Array.isArray(mesh.material)) {
        const clonedMaterials = mesh.material.map((material) => {
          const cloned = material.clone();
          createdMaterials.push(cloned);
          tintMaterialTowardWhite(cloned as any,0.55);
          if (typeof (cloned as any).opacity === "number") {
            (cloned as any).transparent = true;
            (cloned as any).opacity = Math.min((cloned as any).opacity, 0.72);
          }
          cloned.needsUpdate = true;
          return cloned;
        });
        mesh.material = clonedMaterials;
        return;
      }

      const clonedMaterial = mesh.material.clone();
      createdMaterials.push(clonedMaterial);
      tintMaterialTowardWhite(clonedMaterial as any, 0.55);
      if (typeof (clonedMaterial as any).opacity === "number") {
        (clonedMaterial as any).transparent = true;
        (clonedMaterial as any).opacity = Math.min((clonedMaterial as any).opacity, 0.72);
      }
      clonedMaterial.needsUpdate = true;
      mesh.material = clonedMaterial;
    });

    return () => {
      originalMaterialByMesh.forEach((originalMaterial, mesh) => {
        mesh.material = originalMaterial;
      });
      createdMaterials.forEach((material) => material.dispose());
    };
  }, [emptyBuildingMeshes]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const getNDC = useCallback(
    (event: any) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      );
      return ndc;
    },
    [gl, ndc]
  );

  const onPointerMove = useCallback(
    (event: any) => {
      const v = getNDC(event);
      raycaster.setFromCamera(v, camera);
      const hits = raycaster.intersectObjects(buildingMeshes, true);

      if (!hits.length) {
        onHoverBuilding(null);
        return;
      }

      const obj = hits[0].object;
      const meshName = obj.name.toLowerCase();
      onHoverBuilding({
        meshName: obj.name,
        worldPos: getWorldCenter(obj),
        isOwnBuilding: ownSet.has(meshName),
        hasOrganization: occupiedSet.has(meshName),
      });
    },
    [getNDC, raycaster, camera, buildingMeshes, ownSet, occupiedSet, onHoverBuilding]
  );

  const onPointerUp = useCallback(
    (event: any) => {
      if ((event.delta ?? 0) > 4) return;
      event.stopPropagation();

      const v = getNDC(event);
      raycaster.setFromCamera(v, camera);
      const hits = raycaster.intersectObjects(buildingMeshes, true);
      if (!hits.length) return;

      const obj = hits[0].object;
      const meshName = obj.name.toLowerCase();
      onPickBuilding({
        meshName: obj.name,
        worldPos: getWorldCenter(obj),
        isOwnBuilding: ownSet.has(meshName),
        hasOrganization: occupiedSet.has(meshName),
      });
    },
    [getNDC, raycaster, camera, buildingMeshes, ownSet, occupiedSet, onPickBuilding]
  );

  return <primitive object={scene} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />;
}

function OrgBuildingLabel({ meshNames, orgName }: { meshNames: string[]; orgName: string }) {
  const { scene } = useGLTF(MAP_GLB);

  const labelPos = useMemo(() => {
    const meshNameSet = new Set(meshNames.map((name) => name.toLowerCase()));
    const points: THREE.Vector3[] = [];

    scene.traverse((obj: any) => {
      if (obj?.isMesh && typeof obj.name === "string" && meshNameSet.has(obj.name.toLowerCase())) {
        points.push(getWorldCenter(obj));
      }
    });

    if (!points.length) return null;

    const center = points.reduce((acc, point) => acc.add(point), new THREE.Vector3()).divideScalar(points.length);
    return center.clone().setY(center.y + 16);
  }, [scene, meshNames]);

  if (!labelPos) return null;

  return (
    <Html position={labelPos} center>
      <div
        style={{
          padding: "7px 16px",
          background: "#FEFEFE",
          border: "1.5px solid #21324c",
          borderRadius: 6,
          fontWeight: 700,
          fontSize: 13,
          color: "#1d4ed8",
          whiteSpace: "nowrap",
          boxShadow: "0 8px 20px rgba(59,130,246,0.18)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transform: "scale(0.9)",
          position: "relative",
        }}
      >

        {orgName}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: -10,
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "10px solid #3b82f6",
          }}
        />
      </div>
    </Html>
  );
}

const RemoteAvatar = React.memo(function RemoteAvatar({ student }: { student: RemoteStudent }) {
  const groupRef = useRef<THREE.Group | null>(null);
  const gltf = useGLTF(student.modelUrl || "/models/boy.glb");
  const clonedScene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const { actions, names, mixer } = useAnimations(gltf.animations, groupRef);

  useEffect(() => {
    if (!names?.length) return;

    names.forEach((name) => actions[name]?.stop());

    const clip = pickLoopClip(names);
    if (!clip) return;

    const action = actions[clip];
    action?.reset();
    action?.setLoop(THREE.LoopRepeat, Infinity);
    action?.fadeIn(0.2);
    action?.play();

    return () => {
      names.forEach((name) => actions[name]?.stop());
    };
  }, [actions, names, student.modelUrl]);

  useFrame((_, dt) => {
    mixer?.update(dt);

    const group = groupRef.current;
    if (!group) return;

    const damping = 1 - Math.exp(-7 * dt);
    group.position.lerp(student.position, damping);

    const direction = student.position.clone().sub(group.position);
    if (direction.lengthSq() > 0.0001) {
      group.rotation.y = Math.atan2(direction.x, direction.z);
    }
  });

  return (
    <group ref={groupRef} position={student.position.clone()} scale={3}>
      <primitive object={clonedScene} />
      <Html position={[0, 2.6, 0]} center>
        <div
          style={{
            padding: "4px 11px",
            background: "#FEFEFE",
            border: "1px solid #E0D6CD",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            color: "#333",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 10px rgba(0,0,0,0.10)",
          }}
        >
          {student.name}
        </div>
      </Html>
    </group>
  );
});

export default function OrgMapCanvas({
  controlsRef,
  cameraRef,
  camAnimRef,
  yawAnimRef,
  isAnimatingRef,
  ownBuildingMeshNames,
  occupiedBuildingMeshNames,
  orgName,
  remoteStudents = [],
  onPickBuilding,
  onHoverBuilding,
  onCameraAnimDone,
}: OrgMapCanvasProps) {
  return (
    <Canvas
      shadows
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = "none";
      }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[30, 50, 20]} intensity={1.1} castShadow />
      <hemisphereLight intensity={0.35} />

      <Suspense fallback={null}>
        <PerspectiveCamera
          makeDefault
          fov={18}
          ref={(camera) => {
            cameraRef.current = camera ?? null;
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
          isAnimatingRef={isAnimatingRef}
        />

        <OrgMapModel
          ownBuildingMeshNames={ownBuildingMeshNames}
          occupiedBuildingMeshNames={occupiedBuildingMeshNames}
          onPickBuilding={onPickBuilding}
          onHoverBuilding={onHoverBuilding}
        />

        <OrgBuildingLabel meshNames={ownBuildingMeshNames} orgName={orgName} />

        {remoteStudents.map((student) => (
          <RemoteAvatar key={student.id} student={student} />
        ))}
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MAP_GLB);
useGLTF.preload("/models/boy.glb");
