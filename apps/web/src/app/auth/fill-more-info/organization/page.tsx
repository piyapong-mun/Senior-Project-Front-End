"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";

import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

type BuildingOption = {
  id: string;
  name: string;
  modelUrl: string;
  previewUrl?: string | null;
  unlockLevel?: number;
  buildingSelected?: boolean;
};

const NAV_ITEMS = [
  { label: "About", href: "/about", enabled: false },
  { label: "Contact", href: "/contact", enabled: false },
  { label: "Log in", href: "/auth/sign-in" },
  { label: "Register", href: "/auth/register" },
];

function NormalizedBuilding({ url, sizeBoost = 1 }: { url: string; sizeBoost?: number }) {
  const { scene } = useGLTF(url);

  const normalized = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);

    const rawBox = new THREE.Box3().setFromObject(root);
    const rawSize = rawBox.getSize(new THREE.Vector3());

    const safeHeight = Math.max(rawSize.y, 0.0001);
    const safeWidth = Math.max(rawSize.x, 0.0001);
    const safeDepth = Math.max(rawSize.z, 0.0001);
    const footprint = Math.max(safeWidth, safeDepth);
    const aspectRatio = safeHeight / footprint;

    const autoBoost = aspectRatio > 1.45 ? 1.12 : 1;
    const targetHeight = 2.45 * autoBoost * sizeBoost;

    const scale = targetHeight / safeHeight;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(root);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    root.position.set(-scaledCenter.x, -scaledBox.min.y - 0.02, -scaledCenter.z);
    root.updateMatrixWorld(true);
    return root;
  }, [scene, sizeBoost]);

  return <primitive object={normalized} />;
}

function StaticBuildingScene({ url, sizeBoost = 1 }: { url: string; sizeBoost?: number }) {
  const yOffset = sizeBoost >= 1.4 ? -1.16 : sizeBoost >= 1.2 ? -1.02 : -0.82;

  return (
    <group position={[0, yOffset, 0]} rotation={[-0.12, 0.58, 0]}>
      <NormalizedBuilding url={url} sizeBoost={sizeBoost} />
    </group>
  );
}

function BuildingViewer({
  url,
  errorText,
  sizeBoost = 1,
}: {
  url: string | null;
  errorText?: string;
  sizeBoost?: number;
}) {
  if (!url) {
    return (
      <div className={styles.avatarFrame3d}>
        <div className={styles.modelFallback}>{errorText || "No building model"}</div>
      </div>
    );
  }

  return (
    <div className={styles.avatarFrame3d} aria-label="Building model frame">
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 1.4, 7.4], fov: 34 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[8, 12, 8]} intensity={1.15} />
        <directionalLight position={[-6, 5, -5]} intensity={0.42} />
        <Suspense fallback={null}>
          <StaticBuildingScene url={url} sizeBoost={sizeBoost} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default function FillMoreInfoOrgPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [buildingIndex, setBuildingIndex] = useState(0);
  const [buildingError, setBuildingError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    orgName: "",
    companySize: "",
    businessType: "",
    location: "",
    aboutUs: "",
    logoFile: null as File | null,
    email: "",
    phone: "",
    website: "",
    linkedin: "",
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: "",
    buildingId: "",
  });

  const selectedBuilding = buildings[buildingIndex] ?? null;

  const selectedBuildingBoost = useMemo(() => {
    const source = `${selectedBuilding?.name ?? ""} ${selectedBuilding?.modelUrl ?? ""}`.toLowerCase();
    if (
      source.includes("building a") ||
      source.includes("typea") ||
      source.includes("building-model-typea")
    )
      return 1.42;
    if (
      source.includes("building b") ||
      source.includes("typeb") ||
      source.includes("building-model-typeb")
    )
      return 1.38;
    return 1;
  }, [selectedBuilding]);

  const selectBuildingAt = (index: number) => {
    if (!buildings.length) return;
    const safeIndex = ((index % buildings.length) + buildings.length) % buildings.length;
    const picked = buildings[safeIndex];
    setBuildingIndex(safeIndex);
    setForm((prev) => (prev.buildingId === picked.id ? prev : { ...prev, buildingId: picked.id }));
  };

  const loadPageData = async () => {
    const [buildingsRes, orgRes] = await Promise.all([
      fetch("/api/options/buildings", { cache: "no-store" }),
      fetch("/api/organization", { cache: "no-store" }),
    ]);

    const orgJson = orgRes.ok ? await orgRes.json().catch(() => null) : null;
    const org = orgJson?.data?.organization ?? null;
    const currentOrgBuildingId = String(org?.buildingId || "");

    let nextBuildings: BuildingOption[] = [];

    if (buildingsRes.ok) {
      const rows = await buildingsRes.json().catch(() => null);
      const rawBuildings = Array.isArray(rows)
        ? rows
        : Array.isArray(rows?.items)
          ? rows.items
          : [];

      nextBuildings = rawBuildings.filter((building: BuildingOption) => {
        return !building.buildingSelected || building.id === currentOrgBuildingId;
      });

      setBuildings(nextBuildings);
      setBuildingError(nextBuildings.length === 0 ? "No available building" : "");
    } else {
      const err = await buildingsRes.json().catch(() => null);
      setBuildings([]);
      setBuildingError(err?.message || "Failed to load building model");
    }

    if (org) {
      setForm((prev) => ({
        ...prev,
        orgName: org.orgName || "",
        companySize: org.companySize || "",
        businessType: org.businessType || "",
        location: org.location || "",
        aboutUs: org.aboutUs || "",
        email: org.email || "",
        phone: org.phone || "",
        website: org.website || "",
        linkedin: org.linkedin || "",
        facebook: org.facebook || "",
        instagram: org.instagram || "",
        youtube: org.youtube || "",
        tiktok: org.tiktok || "",
        buildingId: currentOrgBuildingId || prev.buildingId,
      }));
    }

    if (currentOrgBuildingId && nextBuildings.length > 0) {
      const currentIndex = nextBuildings.findIndex((building) => building.id === currentOrgBuildingId);
      if (currentIndex >= 0) {
        setBuildingIndex(currentIndex);
        setForm((prev) => ({ ...prev, buildingId: currentOrgBuildingId }));
        return;
      }
    }

    if (nextBuildings.length > 0) {
      setBuildingIndex(0);
      setForm((prev) => ({
        ...prev,
        buildingId: nextBuildings[0].id,
      }));
      return;
    }

    setBuildingIndex(0);
    setForm((prev) => ({ ...prev, buildingId: "" }));
  };

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      try {
        await loadPageData();
      } catch (error: any) {
        if (!isCancelled) {
          setBuildings([]);
          setBuildingError(error?.message || "Failed to load building model");
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.logoFile) return;
    const url = URL.createObjectURL(form.logoFile);
    return () => URL.revokeObjectURL(url);
  }, [form.logoFile]);

  const prevBuilding = () => selectBuildingAt(buildingIndex - 1);
  const nextBuilding = () => selectBuildingAt(buildingIndex + 1);

  const saveOrganization = async () => {
    if (!form.orgName.trim()) {
      alert("Please enter organization name");
      return;
    }
    if (!form.buildingId) {
      alert("Please select building");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: form.orgName,
          companySize: form.companySize,
          businessType: form.businessType,
          location: form.location,
          aboutUs: form.aboutUs,
          email: form.email,
          phone: form.phone,
          website: form.website,
          linkedin: form.linkedin,
          facebook: form.facebook,
          instagram: form.instagram,
          youtube: form.youtube,
          tiktok: form.tiktok,
          buildingId: form.buildingId,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        alert(json?.message || "Failed to save organization");

        if (res.status === 409) {
          await loadPageData().catch(() => null);
        }
        return;
      }

      const orgId =
        json?.data?.organization?.orgId ||
        json?.data?.organization?.org_id ||
        json?.data?.orgId ||
        json?.orgId ||
        "";

      router.push(
        orgId
          ? `/auth/fill-more-info/organization/employee?orgId=${encodeURIComponent(orgId)}`
          : "/auth/fill-more-info/organization/employee"
      );
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
          <h1 className={styles.title}>Organization</h1>

          <div className={styles.formScroll}>
            <div className={styles.formBlock}>
              <div className={styles.sectionTitle}>Basic Information</div>

              <div className={styles.grid2_OrgName}>
                <input
                  className={styles.input}
                  placeholder="Organization Name"
                  value={form.orgName}
                  onChange={(e) => setForm((p) => ({ ...p, orgName: e.target.value }))}
                />
                <input
                  className={styles.input}
                  placeholder="Company Size"
                  value={form.companySize}
                  onChange={(e) => setForm((p) => ({ ...p, companySize: e.target.value }))}
                />
              </div>

              <input
                className={styles.input}
                placeholder="Business Type"
                value={form.businessType}
                onChange={(e) => setForm((p) => ({ ...p, businessType: e.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              />

              <div className={styles.gridAboutLogo}>
                <textarea
                  className={styles.textarea}
                  placeholder="About Us"
                  value={form.aboutUs}
                  onChange={(e) => setForm((p) => ({ ...p, aboutUs: e.target.value }))}
                />
                <div className={styles.logoBox}>
                  <div className={styles.logoLabel}>Logo</div>
                  <label className={styles.logoDrop}>
                    <input
                      type="file"
                      accept="image/*"
                      className={styles.fileInput}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          logoFile: e.target.files?.[0] ?? null,
                        }))
                      }
                    />
                    <div className={styles.logoDropInner}>
                      <div className={styles.uploadText}>upload</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className={styles.hr} />
              <div className={styles.sectionTitle}>Contact</div>

              <div className={styles.grid2}>
                <input
                  className={styles.input}
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
                <input
                  className={styles.input}
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>

              <input
                className={styles.input}
                placeholder="Website"
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              />

              <div className={styles.hr} />
              <div className={styles.sectionTitle}>Organization</div>

              <input
                className={styles.input}
                placeholder="LinkedIn link"
                value={form.linkedin}
                onChange={(e) => setForm((p) => ({ ...p, linkedin: e.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="Facebook link"
                value={form.facebook}
                onChange={(e) => setForm((p) => ({ ...p, facebook: e.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="Instagram link"
                value={form.instagram}
                onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="YouTube link"
                value={form.youtube}
                onChange={(e) => setForm((p) => ({ ...p, youtube: e.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="TikTok link"
                value={form.tiktok}
                onChange={(e) => setForm((p) => ({ ...p, tiktok: e.target.value }))}
              />
            </div>
          </div>
        </section>

        <section className={styles.avatarStage} aria-label="Building selector">
          <BuildingViewer
            url={selectedBuilding?.modelUrl ?? null}
            errorText={buildingError}
            sizeBoost={selectedBuildingBoost}
          />
          <div className={styles.modelName}>{selectedBuilding?.name || "Building"}</div>

          <div className={styles.avatarDots}>
            {buildings.map((building, i) => (
              <button
                key={building.id}
                type="button"
                className={`${styles.dot} ${i === buildingIndex ? styles.dotOn : ""}`}
                onClick={() => selectBuildingAt(i)}
                aria-label={`Select ${building.name}`}
              />
            ))}
          </div>

          <div className={styles.avatarControls}>
            <button
              className={styles.iconBtn}
              type="button"
              onClick={prevBuilding}
              aria-label="Previous building"
              disabled={!buildings.length}
            >
              {"<"}
            </button>
            <button
              className={styles.iconBtn}
              type="button"
              onClick={nextBuilding}
              aria-label="Next building"
              disabled={!buildings.length}
            >
              {">"}
            </button>
          </div>

          <button className={styles.nextBtn} type="button" onClick={saveOrganization} disabled={saving}>
            {saving ? "Saving..." : "Next"}
          </button>
        </section>
      </main>
    </div>
  );
}
