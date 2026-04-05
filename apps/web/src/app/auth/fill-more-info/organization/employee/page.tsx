"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import styles from "./page.module.css";
import { useRouter, useSearchParams } from "next/navigation";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";

const NAV_ITEMS = [
  { label: "About", href: "/about", enabled: false },
  { label: "Contact", href: "/contact", enabled: false },
  { label: "Log in", href: "/auth/sign-in" },
  { label: "Register", href: "/auth/register" },
];

type AvatarOption = { id: string; modelUrl: string; unlockLevel: number };

type Employee = {
  firstName: string;
  lastName: string;
  position: string;
  phone: string;
  email: string;
  canCheckChallenge: boolean;
  avatarId: string | null;
};

const emptyEmp = (): Employee => ({
  firstName: "",
  lastName: "",
  position: "",
  phone: "",
  email: "",
  canCheckChallenge: false,
  avatarId: null,
});

function pickIdleClip(names: string[]) {
  const n = names.map((x) => x.toLowerCase());
  const idleIdx = n.findIndex((x) => x.includes("idle"));
  if (idleIdx >= 0) return names[idleIdx];
  const loopIdx = n.findIndex((x) => x.includes("walk") || x.includes("run"));
  if (loopIdx >= 0) return names[loopIdx];
  return names[0];
}

function AnimatedGLB({ url }: { url: string }) {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF(url);
  const { actions, names, mixer } = useAnimations(gltf.animations, group);

  useEffect(() => {
    if (!names?.length) return;
    names.forEach((n) => {
      const a = actions[n];
      if (!a) return;
      a.stop();
      a.reset();
    });

    const idleName = pickIdleClip(names);
    const action = actions[idleName];
    if (!action) return;

    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.fadeIn(0.2);
    action.play();

    return () => action.stop();
  }, [actions, names, url]);

  useFrame((_, dt) => mixer?.update(dt));

  return (
    <group ref={group}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function Avatar3D({ modelUrl }: { modelUrl: string }) {
  return (
    <div className={styles.avatarFrame3d} aria-label="Avatar 3D frame">
      <Canvas camera={{ position: [0, 1.25, 1.8], fov: 42 }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 3]} intensity={1.1} />
        <Suspense fallback={null}>
          <group position={[0, -1.3, 0]} scale={2.0} rotation={[-0.5, -0.5, 0]}>
            <AnimatedGLB key={modelUrl} url={modelUrl} />
          </group>
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
      </Canvas>
    </div>
  );
}

export default function FillMoreInfoOrgEmployeePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdFromQuery = searchParams.get("orgId") || "";

  const [maxVisible, setMaxVisible] = useState<1 | 2 | 3>(1);
  const [activeEmp, setActiveEmp] = useState<0 | 1 | 2>(0);
  const [employees, setEmployees] = useState<Employee[]>([emptyEmp(), emptyEmp(), emptyEmp()]);
  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  const [orgId, setOrgId] = useState<string>(orgIdFromQuery);
  const [userId, setUserId] = useState<string>("");
  const [accountEmail, setAccountEmail] = useState<string>("");
  const [accountError, setAccountError] = useState<string>("");

  const emp = useMemo(() => employees[activeEmp], [employees, activeEmp]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/organization/active-account", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) {
          setAccountError(j?.message || "Failed to load active account");
          return;
        }
        const nextOrgId = String(orgIdFromQuery || j.orgId || "");
        const nextUserId = String(j.userId || "");
        const nextEmail = String(j.email || "").toLowerCase();
        const emp = j.employee ?? null;

        setOrgId(nextOrgId);
        setUserId(nextUserId);
        setAccountEmail(nextEmail);

        // ✅ populate employee1 ด้วยข้อมูลที่มีอยู่แล้วใน DB
        setEmployees((prev) => {
          const copy = [...prev];
          copy[0] = {
            ...copy[0],
            email: nextEmail,
            firstName: emp?.first_name ?? copy[0].firstName,
            lastName: emp?.last_name ?? copy[0].lastName,
            position: emp?.position ?? copy[0].position,
            phone: emp?.phone ?? copy[0].phone,
            canCheckChallenge: emp?.is_reviewer ?? copy[0].canCheckChallenge,
            avatarId: emp?.avatar_choice ?? copy[0].avatarId,
          };
          return copy;
        });
      } catch (error: unknown) {
        setAccountError(error instanceof Error ? error.message : "Failed to load active account");
      }
    })();
  }, [orgIdFromQuery]);

  useEffect(() => {
    (async () => {
      setLoadingAvatars(true);
      try {
        const r = await fetch("/api/options/avatars/employee", { cache: "no-store" });
        if (!r.ok) return;
        const data: AvatarOption[] = await r.json();
        setAvatarOptions(data);
        const firstId = data?.[0]?.id ?? null;
        // ✅ ถ้า employee มี avatarId อยู่แล้ว (จาก DB) ไม่ทับด้วย firstId
        setEmployees((prev) => prev.map((e) => ({ ...e, avatarId: e.avatarId ?? firstId })));
      } finally {
        setLoadingAvatars(false);
      }
    })();
  }, []);

  const setEmpField =
    (k: keyof Employee) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
      setEmployees((prev) => {
        const next = [...prev];
        next[activeEmp] = { ...next[activeEmp], [k]: v } as Employee;
        return next;
      });
    };

  const activeAvatar = avatarOptions.find((a) => a.id === employees[activeEmp].avatarId) ?? avatarOptions[0];

  const setEmpAvatarId = (id: string) => {
    setEmployees((prev) => {
      const copy = [...prev];
      copy[activeEmp] = { ...copy[activeEmp], avatarId: id };
      return copy;
    });
  };

  const prevAvatar = () => {
    if (!avatarOptions.length) return;
    const curId = activeAvatar?.id ?? avatarOptions[0].id;
    const idx = Math.max(0, avatarOptions.findIndex((a) => a.id === curId));
    setEmpAvatarId(avatarOptions[(idx - 1 + avatarOptions.length) % avatarOptions.length].id);
  };

  const nextAvatar = () => {
    if (!avatarOptions.length) return;
    const curId = activeAvatar?.id ?? avatarOptions[0].id;
    const idx = Math.max(0, avatarOptions.findIndex((a) => a.id === curId));
    setEmpAvatarId(avatarOptions[(idx + 1) % avatarOptions.length].id);
  };

  const validateEmp = (e: Employee, idx: number) => {
    if (!e.firstName.trim() || !e.lastName.trim()) return `Employee ${idx + 1}: missing name`;
    if (idx === 0) return null;
    if (!e.email.trim()) return `Employee ${idx + 1}: missing email`;
    return null;
  };

  async function handleNext() {
    if (!orgId || !userId) {
      alert(accountError || "Missing orgId/userId (check organization creation first).");
      return;
    }

    const activeEmployees = employees.slice(0, maxVisible);
    for (let i = 0; i < activeEmployees.length; i++) {
      const msg = validateEmp(activeEmployees[i], i);
      if (msg) {
        alert(msg);
        return;
      }
    }

    const e1 = activeEmployees[0];
    const res = await fetch("/api/organization/employees/save-self", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        orgId,
        firstName: e1.firstName,
        lastName: e1.lastName,
        position: e1.position,
        phone: e1.phone,
        avatarId: e1.avatarId,
        canCheckChallenge: e1.canCheckChallenge,
        email: accountEmail,
      }),
    });

    const saveJson = await res.json().catch(() => ({}));
    if (!res.ok || !saveJson?.ok) {
      const detailText = typeof saveJson?.detail === "string" ? saveJson.detail : saveJson?.detail?.message || saveJson?.detail?.error || "";
      alert(saveJson?.message || detailText || "Save employee1 failed");
      return;
    }

    for (let i = 1; i < activeEmployees.length; i++) {
      const e = activeEmployees[i];
      const inviteRes = await fetch("/api/organization/employees/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          email: e.email,
          firstName: e.firstName,
          lastName: e.lastName,
          position: e.position,
          phone: e.phone,
          avatarId: e.avatarId,
          canCheckChallenge: e.canCheckChallenge,
        }),
      });
      const inviteJson = await inviteRes.json().catch(() => ({}));
      if (!inviteRes.ok || !inviteJson?.ok) {
        const detailText = typeof inviteJson?.detail === "string" ? inviteJson.detail : inviteJson?.detail?.message || inviteJson?.detail?.error || "";
        alert(inviteJson?.message || detailText || `Invite employee${i + 1} failed`);
        return;
      }
    }

    router.push("/organization/explore");
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Link href="/" className={styles.logoWrap} aria-label="Home">
          <img src="/images/logo/logo-v1-no_bg.png" alt="VCEP" className={styles.logo} />
        </Link>
        <nav className={styles.navBar} aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const disabled = item.enabled === false;
            const cls = `${styles.navItem} ${disabled ? styles.navItemDisabled : ""}`;
            return disabled ? <span key={item.label} className={cls}>{item.label}</span> : <Link key={item.label} href={item.href} className={cls}>{item.label}</Link>;
          })}
        </nav>
      </div>

      <main className={styles.main}>
        <section className={styles.card}>
          <h1 className={styles.title}>Employees</h1>
          <div className={styles.empTabs} role="tablist" aria-label="Employees tabs">
            <button type="button" className={`${styles.empTab} ${activeEmp === 0 ? styles.empTabOn : ""}`} onClick={() => setActiveEmp(0)}>employee1</button>
            {maxVisible < 2 && <button type="button" className={styles.empPlus} onClick={() => { setMaxVisible(2); setActiveEmp(1); }}>+</button>}
            {maxVisible >= 2 && <button type="button" className={`${styles.empTab} ${activeEmp === 1 ? styles.empTabOn : ""}`} onClick={() => setActiveEmp(1)}>employee2</button>}
            {maxVisible === 2 && <button type="button" className={styles.empPlus} onClick={() => { setMaxVisible(3); setActiveEmp(2); }}>+</button>}
            {maxVisible >= 3 && <button type="button" className={`${styles.empTab} ${activeEmp === 2 ? styles.empTabOn : ""}`} onClick={() => setActiveEmp(2)}>employee3</button>}
          </div>

          <div className={styles.formScroll}>
            <div className={styles.formBlock}>
              <div className={styles.grid2}>
                <input className={styles.input} placeholder="First name" value={emp.firstName} onChange={setEmpField("firstName")} />
                <input className={styles.input} placeholder="Last name" value={emp.lastName} onChange={setEmpField("lastName")} />
              </div>
              <div className={styles.grid2}>
                <input className={styles.input} placeholder="position" value={emp.position} onChange={setEmpField("position")} />
                <input className={styles.input} placeholder="Phone number" value={emp.phone} onChange={setEmpField("phone")} />
              </div>
              <input className={styles.input} placeholder="Email" value={activeEmp === 0 ? accountEmail : emp.email} onChange={activeEmp === 0 ? undefined : setEmpField("email")} readOnly={activeEmp === 0} />
              <div className={styles.hr} />
              <label className={styles.checkRow}>
                <input className={styles.checkInput} type="checkbox" checked={emp.canCheckChallenge} onChange={setEmpField("canCheckChallenge")} />
                <span className={styles.checkText}>Can check challenge activities</span>
              </label>
            </div>
          </div>
        </section>

        <section className={styles.avatarStage} aria-label="Avatar">
          <div className={styles.avatarRow}>
            <button className={styles.iconBtn} type="button" onClick={prevAvatar}>◀</button>
            <div className={styles.avatarCenter}>
              {loadingAvatars ? <div className={styles.avatarPlaceholder}>Loading...</div> : activeAvatar ? <Avatar3D modelUrl={activeAvatar.modelUrl} /> : <div className={styles.avatarPlaceholder}>No avatars</div>}
            </div>
            <button className={styles.iconBtn} type="button" onClick={nextAvatar}>▶</button>
          </div>
          <div className={styles.avatarDots}>
            {avatarOptions.map((a) => {
              const on = a.id === activeAvatar?.id;
              return <button key={a.id} type="button" className={`${styles.dot} ${on ? styles.dotOn : ""}`} onClick={() => setEmpAvatarId(a.id)} aria-label="Select avatar" />;
            })}
          </div>
          <button className={styles.nextBtn} type="button" onClick={handleNext}>Next</button>
        </section>
      </main>
    </div>
  );
}
