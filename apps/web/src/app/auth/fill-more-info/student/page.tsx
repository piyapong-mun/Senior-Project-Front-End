"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";

type OptionItem = { id: string; name: string };
type AvatarOption = { id: string; modelUrl: string; unlockLevel: number };

const NAV_ITEMS = [
  { label: "About", href: "/about", enabled: false },
  { label: "Contact", href: "/contact", enabled: false },
  { label: "Log in", href: "/auth/sign-in" },
  { label: "Register", href: "/auth/register" },
];

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

    const clipName = pickIdleClip(names);
    const a = actions[clipName];
    if (!a) return;

    a.reset();
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.setEffectiveTimeScale(1);
    a.fadeIn(0.2);
    a.play();

    return () => {
      a.stop();
    };
  }, [actions, names, url]);

  useFrame((_, dt) => {
    mixer?.update(dt);
  });

  return (
    <group ref={group}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function ErrorCatcher({
  children,
  onError,
}: {
  children: React.ReactNode;
  onError: () => void;
}) {
  try {
    return <>{children}</>;
  } catch {
    onError();
    return null;
  }
}

function Avatar3D({ modelUrl }: { modelUrl: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    try {
      useGLTF.preload(modelUrl);
    } catch { }
  }, [modelUrl]);

  if (failed) {
    return <div className={styles.avatarPlaceholder}>Model load failed</div>;
  }

  return (
    <div className={styles.avatarFrame3d} aria-label="Avatar 3D frame">
      <Canvas camera={{ position: [0, 1.25, 1.8], fov: 42 }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 3]} intensity={1.1} />

        <Suspense fallback={null}>
          <group position={[0, -1.3, 0]} scale={2.0} rotation={[-0.5, -0.5, 0]}>
            <ErrorCatcher onError={() => setFailed(true)}>
              <AnimatedGLB key={modelUrl} url={modelUrl} />
            </ErrorCatcher>
          </group>
        </Suspense>

        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
      </Canvas>
    </div>
  );
}

function SelectorBox({
  title,
  options,
  selectedIds,
  onToggle,
}: {
  title: string;
  options: OptionItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.name.toLowerCase().includes(s));
  }, [options, q]);

  const selectedNames = useMemo(() => {
    const set = new Set(selectedIds);
    return options.filter((o) => set.has(o.id)).map((o) => o.name);
  }, [options, selectedIds]);

  return (
    <div className={styles.selectorBox}>
      <div className={styles.selectorTag}>{title}</div>

      <div className={styles.searchRow}>
        <div className={styles.searchIcon}>⌕</div>
        <input
          className={styles.searchInput}
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className={styles.optionGrid}>
        {filtered.map((o) => {
          const on = selectedIds.includes(o.id);
          return (
            <div
              key={o.id}
              className={styles.optionItem}
              onClick={() => onToggle(o.id)}
              onKeyDown={(e) =>
                e.key === "Enter" || e.key === " " ? onToggle(o.id) : null
              }
              role="button"
              tabIndex={0}
            >
              <div className={`${styles.checkBox} ${on ? styles.checkBoxOn : ""}`}>
                {on ? "✓" : ""}
              </div>
              <div className={styles.optionLabel}>{o.name}</div>
            </div>
          );
        })}
      </div>

      {selectedNames.length > 0 && (
        <p className={styles.note} style={{ marginTop: 14 }}>
          Selected: {selectedNames.join(", ")}
        </p>
      )}
    </div>
  );
}

function normalizeOptionResponse(json: any): OptionItem[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

function normalizeAvatarResponse(json: any): AvatarOption[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

export default function FillMoreInfoStudentPage() {
  const [openJob, setOpenJob] = useState(false);
  const [openSkill, setOpenSkill] = useState(false);

  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(true);
  const [avatarId, setAvatarId] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    phone: "",
    university: "",
    faculty: "",
    major: "",
    year: "",
  });

  const [jobOptions, setJobOptions] = useState<OptionItem[]>([]);
  const [skillOptions, setSkillOptions] = useState<OptionItem[]>([]);
  const [jobSelected, setJobSelected] = useState<string[]>([]);
  const [skillSelected, setSkillSelected] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const router = useRouter();

  const setField =
    (k: keyof typeof form) =>
      (e: ChangeEvent<HTMLInputElement>) =>
        setForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch("/api/student", { cache: "no-store" });
        const json = await r.json().catch(() => null);

        if (cancelled) return;

        if (!r.ok || !json?.ok) {
          setErr(json?.message || "Load student failed");
          return;
        }

        const d = json?.data?.student_info ?? json?.data ?? {};

        setForm({
          firstName: d?.first_name ?? "",
          lastName: d?.last_name ?? "",
          birthDate: d?.birth_date ? String(d.birth_date).slice(0, 10) : "",
          phone: d?.phone ?? "",
          university: d?.university ?? "",
          faculty: d?.faculty ?? "",
          major: d?.major ?? "",
          year: d?.year !== null && d?.year !== undefined ? String(d.year) : "",
        });

        setAvatarId(d?.avatar_choice ?? null);
        setSkillSelected(Array.isArray(d?.skill) ? d.skill : []);
        setJobSelected(Array.isArray(d?.interests) ? d.interests : []);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Load student failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [jobsRes, skillsRes] = await Promise.all([
          fetch("/api/options/jobs", { cache: "no-store" }),
          fetch("/api/options/skills", { cache: "no-store" }),
        ]);

        if (jobsRes.ok) {
          const jobsJson = await jobsRes.json();
          setJobOptions(normalizeOptionResponse(jobsJson));
        } else {
          setJobOptions([]);
        }

        if (skillsRes.ok) {
          const skillsJson = await skillsRes.json();
          setSkillOptions(normalizeOptionResponse(skillsJson));
        } else {
          setSkillOptions([]);
        }
      } catch {
        setJobOptions([]);
        setSkillOptions([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingAvatars(true);
      try {
        const r = await fetch("/api/options/avatars/student", { cache: "no-store" });
        if (!r.ok) {
          setAvatarOptions([]);
          return;
        }

        const json = await r.json();
        const data = normalizeAvatarResponse(json);

        setAvatarOptions(data);

        const firstId = data?.[0]?.id ?? null;
        setAvatarId((prev) => prev ?? firstId);

        data.forEach((a) => {
          try {
            useGLTF.preload(a.modelUrl);
          } catch { }
        });
      } finally {
        setLoadingAvatars(false);
      }
    })();
  }, []);

  const toggleJob = (id: string) => {
    setJobSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSkill = (id: string) => {
    setSkillSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const activeAvatar =
    avatarOptions.find((a) => a.id === avatarId) ?? avatarOptions[0];

  const prevAvatar = () => {
    if (!avatarOptions.length) return;
    const curId = activeAvatar?.id ?? avatarOptions[0].id;
    const idx = Math.max(0, avatarOptions.findIndex((a) => a.id === curId));
    const nextIdx = (idx - 1 + avatarOptions.length) % avatarOptions.length;
    setAvatarId(avatarOptions[nextIdx].id);
  };

  const nextAvatar = () => {
    if (!avatarOptions.length) return;
    const curId = activeAvatar?.id ?? avatarOptions[0].id;
    const idx = Math.max(0, avatarOptions.findIndex((a) => a.id === curId));
    const nextIdx = (idx + 1) % avatarOptions.length;
    setAvatarId(avatarOptions[nextIdx].id);
  };

  const handleNext = async () => {
    setErr(null);

    if (!avatarId) {
      setErr("Please select avatar");
      return;
    }

    const yearNumber =
      form.year.trim() === "" ? null : Number.parseInt(form.year.trim(), 10);

    if (form.year.trim() !== "" && Number.isNaN(yearNumber as number)) {
      setErr("Year must be a number");
      return;
    }

    const payload = {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      birth_date: form.birthDate || null,
      phone: form.phone.trim() || null,
      university: form.university.trim() || null,
      faculty: form.faculty.trim() || null,
      major: form.major.trim() || null,
      year: yearNumber,
      avatar_choice: avatarId,
      interests: jobSelected,
      skill: skillSelected,
    };

    setSaving(true);

    try {
      const r = await fetch("/api/student", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await r.json().catch(() => null);

      if (!r.ok || !res?.ok) {
        const detail =
          typeof res?.detail === "string"
            ? res.detail
            : res?.detail
              ? JSON.stringify(res.detail)
              : null;

        throw new Error(detail || res?.message || "Save failed");
      }

      router.push("/student/explore");
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

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
            return disabled ? (
              <span key={item.label} className={cls} aria-disabled="true" title="Coming soon">
                {item.label}
              </span>
            ) : (
              <Link key={item.label} href={item.href} className={cls}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className={styles.main}>
        <section className={styles.card}>
          <h1 className={styles.title}>Student</h1>

          <div className={styles.formScroll}>
            <div className={styles.formBlock}>
              <div className={styles.grid2}>
                <input
                  className={styles.input}
                  placeholder="First name"
                  value={form.firstName}
                  onChange={setField("firstName")}
                />
                <input
                  className={styles.input}
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={setField("lastName")}
                />
              </div>

              <div className={styles.grid2}>
                <input
                  className={styles.input}
                  type="date"
                  value={form.birthDate}
                  onChange={setField("birthDate")}
                />
                <input
                  className={styles.input}
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={setField("phone")}
                />
              </div>

              <div className={styles.hr} />

              <div className={styles.stack}>
                <input
                  className={styles.input}
                  placeholder="University"
                  value={form.university}
                  onChange={setField("university")}
                />
                <input
                  className={styles.input}
                  placeholder="Faculty"
                  value={form.faculty}
                  onChange={setField("faculty")}
                />
              </div>

              <div className={styles.grid2}>
                <input
                  className={styles.input}
                  placeholder="Major"
                  value={form.major}
                  onChange={setField("major")}
                />
                <input
                  className={styles.input}
                  placeholder="Year"
                  value={form.year}
                  onChange={setField("year")}
                  inputMode="numeric"
                />
              </div>

              <div className={styles.hr} />

              <button
                type="button"
                className={styles.pickField}
                onClick={() => setOpenJob((v) => !v)}
              >
                <span className={styles.pickPlaceholder}>
                  {jobSelected.length ? `${jobSelected.length} selected` : "Job of interest"}
                </span>
              </button>

              {openJob && (
                <SelectorBox
                  title="Job of interest"
                  options={jobOptions}
                  selectedIds={jobSelected}
                  onToggle={toggleJob}
                />
              )}

              <button
                type="button"
                className={styles.pickField}
                onClick={() => setOpenSkill((v) => !v)}
              >
                <span className={styles.pickPlaceholder}>
                  {skillSelected.length ? `${skillSelected.length} selected` : "Your skills"}
                </span>
              </button>

              {openSkill && (
                <SelectorBox
                  title="Your skills"
                  options={skillOptions}
                  selectedIds={skillSelected}
                  onToggle={toggleSkill}
                />
              )}

              <div className={styles.hr} />
            </div>
          </div>
        </section>

        <section className={styles.avatarStage} aria-label="Avatar">
          <div className={styles.avatarRow}>
            <button
              className={styles.iconBtn}
              type="button"
              onClick={prevAvatar}
              aria-label="Previous"
            >
              ◀
            </button>

            <div className={styles.avatarCenter}>
              {loadingAvatars ? (
                <div className={styles.avatarPlaceholder}>Loading...</div>
              ) : activeAvatar ? (
                <Avatar3D
                  key={`${activeAvatar.id}-${activeAvatar.modelUrl}`}
                  modelUrl={activeAvatar.modelUrl}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>No avatars</div>
              )}
            </div>

            <button
              className={styles.iconBtn}
              type="button"
              onClick={nextAvatar}
              aria-label="Next"
            >
              ▶
            </button>
          </div>

          <div className={styles.avatarDots}>
            {avatarOptions.map((a) => {
              const on = a.id === activeAvatar?.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.dot} ${on ? styles.dotOn : ""}`}
                  onClick={() => setAvatarId(a.id)}
                  aria-label="Select avatar"
                />
              );
            })}
          </div>

          <div className={styles.nextWrap}>
            <button
              className={styles.nextBtn}
              type="button"
              onClick={handleNext}
              disabled={saving}
            >
              {saving ? "Saving..." : "Next"}
            </button>
          </div>
          <div className={styles.errorWrap}>
            {err ? <p className={styles.errorText}>{err}</p> : null}
          </div>
        </section>
      </main>
    </div>
  );
}