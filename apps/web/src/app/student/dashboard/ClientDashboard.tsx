"use client";

import styles from "./ClientDashboard.module.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* =======================
   Types
======================= */
type StudentMe = {
  name: string;
  bio: string;
  phone: string;
  email: string;
  address: string;
  education: string;
  level: number;
  xp: number;
  xpMax: number;
};

type Skill = { id: string; name: string; percent: number };
type ModalKind = "editProfile" | "badges" | "certificate" | null;

type TileId = "badges" | "certificate" | "portfolio";

/* =======================
   Mock Data (replace w/ API later)
======================= */
const MOCK_ME: StudentMe = {
  name: "Carolyn Stewart",
  bio: "Experienced professional in design bringing fresh perspectives. Committed to creating impactful solutions and driving positive change.",
  phone: "123-745-9803",
  email: "carolyn.stewart@example.com",
  address: "1754 Maple Drive Houston, PA 71107",
  education: "Mahidol University",
  level: 10,
  xp: 500,
  xpMax: 1000,
};

const LEVEL_BADGES = [
  "/images/icons/badge01.png",
  "/images/icons/badge02.png",
  "/images/icons/badge03.png",
  "/images/icons/badge04.png",
  "/images/icons/badge05.png",
];


const BADGE_TILES: Array<{ id: TileId; label: string; image: string; alt: string }> = [
  { id: "badges", label: "badges", image: "/images/icons/porttfolio-icon.png", alt: "Badges" },
  { id: "certificate", label: "certificate", image: "/images/icons/porttfolio-icon.png", alt: "Certificate" },
  { id: "portfolio", label: "portfolio", image: "/images/icons/porttfolio-icon.png", alt: "Portfolio" },
];

const ACTIVITIES = [
  { id: "a1", title: "Frontend Basics & Web Terminology", sub: "Quiz", xp: 20 },
  { id: "a2", title: "UI Layout Explanation Task", sub: "Task", xp: 15 },
  { id: "a3", title: "Responsive Web Page Workshop", sub: "Workshop", xp: 50 },
];

const MOCK_SKILLS: Skill[] = [
  { id: "s1", name: "HTML", percent: 85 },
  { id: "s2", name: "CSS", percent: 70 },
  { id: "s3", name: "JavaScript", percent: 55 },
  { id: "s4", name: "React", percent: 42 },
  { id: "s5", name: "TypeScript", percent: 35 },
  { id: "s6", name: "UI/UX", percent: 60 },
  { id: "s7", name: "Git", percent: 50 },
  { id: "s8", name: "API", percent: 40 },
  { id: "s9", name: "Testing", percent: 25 },
  { id: "s10", name: "SQL", percent: 45 },
  { id: "s11", name: "Cloud", percent: 20 },
  { id: "s12", name: "Soft Skills", percent: 65 },
];

/* =======================
   Helpers
======================= */
function cx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

/* =======================
   Page
======================= */
export default function ClientDashboard() {
  const router = useRouter();

  const [me, setMe] = useState<StudentMe | null>(null);
  const [skills] = useState<Skill[]>(MOCK_SKILLS);

  const avatarChoices = useMemo(
    () => [
      "/images/avatar%20picture/avatar1.png",
      "/images/avatar%20picture/avatar2.png",
      "/images/avatar%20picture/avatar3.png",
    ],
    []
  );
  const [selectedAvatar, setSelectedAvatar] = useState(0);

  // profile photo
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [imgNat, setImgNat] = useState({ w: 0, h: 0 });

  const cropBoxWidth = 280;
  const cropBoxHeight = 190;
  const baseScale =
    imgNat.w && imgNat.h
      ? Math.max(cropBoxWidth / imgNat.w, cropBoxHeight / imgNat.h)
      : 1;

  // modal
  const [modal, setModal] = useState<ModalKind>(null);

  // edit draft
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    phone: "",
    email: "",
    address: "",
    about: "",
  });

  const closeCropModal = () => {
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(null);
    setCropOpen(false);
  };

  const startCropPhoto = (f: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCropUrl(url);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setCropOpen(true);
  };

  useEffect(() => {
    return () => {
      if (photoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  useEffect(() => {
    setMe(MOCK_ME);
  }, []);

  useEffect(() => {
    if (!me) return;
    const parts = me.name.split(" ");
    setDraft((p) => ({
      ...p,
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" ") ?? "",
      phone: me.phone,
      email: me.email,
      address: me.address,
      about: me.bio,
    }));
  }, [me]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModal(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  if (!me) return null;

  const filledMedals = Math.min(5, Math.max(0, Math.floor(me.level / 2)));

  const onPickPhoto = (f: File | null) => {
    startCropPhoto(f);
  };

  const openPhotoPicker = () => fileRef.current?.click();

  const onClickTile = (id: TileId) => {
    if (id === "portfolio") return router.push("/student/portfolio");
    if (id === "badges") return setModal("badges");
    if (id === "certificate") return setModal("certificate");
  };

  const saveEdit = () => {
    const fullName = `${draft.firstName} ${draft.lastName}`.trim() || me.name;

    setMe((prev) =>
      prev
        ? {
          ...prev,
          name: fullName,
          phone: draft.phone,
          email: draft.email,
          address: draft.address,
          bio: draft.about,
        }
        : prev
    );

    setModal(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.board}>
        <div className={styles.dash}>
          {/* LEFT */}
          <div className={styles.left}>
            <TopProfileRow
              me={me}
              photoUrl={photoUrl}
              fileRef={fileRef}
              onPickPhoto={onPickPhoto}
              openPhotoPicker={openPhotoPicker}
              onEdit={() => setModal("editProfile")}
            />

            <MidRow
              me={me}
              filledMedals={filledMedals}
              skills={skills}
              onClickTile={onClickTile}
            />

            <ActivityMissionSplit />

            <BottomSplit />
          </div>

          {/* RIGHT */}
          <div className={styles.right}>
            <AvatarCard
              selected={selectedAvatar}
              onSelect={setSelectedAvatar}
              avatarChoices={avatarChoices}
            />
            <CalendarCard title="October" />
          </div>

          {/* MODALS */}
          {modal && (
            <ModalShell onClose={() => setModal(null)}>
              {modal === "editProfile" && (
                <EditProfileModal
                  draft={draft}
                  setDraft={setDraft}
                  onCancel={() => setModal(null)}
                  onSave={saveEdit}
                />
              )}

              {modal === "badges" && (
                <GridModal title="Badges" count={8} onClose={() => setModal(null)} />
              )}

              {modal === "certificate" && (
                <GridModal title="Certificate" count={6} onClose={() => setModal(null)} />
              )}
            </ModalShell>
          )}
          {cropOpen && cropUrl && (
            <div className={styles.cropOverlay} role="dialog" aria-modal="true">
              <div className={styles.cropModal}>
                <div className={styles.cropHeader}>
                  <div className={styles.cropTitle}>Crop Profile Photo</div>
                  <button
                    type="button"
                    className={styles.cropClose}
                    onClick={closeCropModal}
                  >
                    ✕
                  </button>
                </div>

                <div
                  className={styles.cropBox}
                  style={{ width: cropBoxWidth, height: cropBoxHeight }}
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
                      transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${baseScale * cropZoom})`,
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
                    onClick={closeCropModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={styles.cropBtnPrimary}
                    onClick={async () => {
                      if (!cropUrl || !imgNat.w || !imgNat.h) return;

                      const img = new Image();
                      img.src = cropUrl;
                      await new Promise<void>((res) => (img.onload = () => res()));

                      const Cw = cropBoxWidth;
                      const Ch = cropBoxHeight;

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

                      const outW = 840;
                      const outH = 570;
                      const canvas = document.createElement("canvas");
                      canvas.width = outW;
                      canvas.height = outH;

                      const ctx = canvas.getContext("2d")!;
                      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

                      const blob: Blob = await new Promise((resolve) =>
                        canvas.toBlob((b) => resolve(b!), "image/png", 0.92)
                      );

                      const nextUrl = URL.createObjectURL(blob);

                      setPhotoUrl((prev) => {
                        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                        return nextUrl;
                      });

                      closeCropModal();
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

  );
}

/* =======================
   Sections
======================= */
function TopProfileRow({
  me,
  photoUrl,
  fileRef,
  onPickPhoto,
  openPhotoPicker,
  onEdit,
}: {
  me: StudentMe;
  photoUrl: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickPhoto: (f: File | null) => void;
  openPhotoPicker: () => void;
  onEdit: () => void;
}) {
  return (
    <div className={styles.topGrid}>
      <section className={cx(styles.card, styles.photoCard)}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={styles.hiddenFile}
          onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          className={styles.photoBtn}
          onClick={openPhotoPicker}
          aria-label="Change profile photo"
        >
          <div className={styles.photoFrame}>
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className={styles.photoImg} />
            ) : (
              <div className={styles.photoPlaceholder} />
            )}
          </div>
        </button>
      </section>

      <section className={styles.bioBox}>
        <div className={styles.bioBg} />

        <button
          className={styles.editButtonIcon}
          type="button"
          aria-label="Edit personal information"
          onClick={onEdit}
        >
          ✎
        </button>

        <div className={styles.bioInformation}>
          <div className={styles.profileName}>{me.name}</div>

          <div className={styles.profileBio}>
            {me.bio}
          </div>

          <div className={styles.linesWrap}>
            <div className={styles.lineTop} />
            <div className={styles.lineBottomLeft} />
            <div className={styles.lineBottomRight} />
            <div className={styles.lineVertical} />
          </div>

          <div className={styles.profilePhone}>
            Phone: {me.phone}
          </div>

          <div className={styles.profileEmail}>
            Email: {me.email}
          </div>

          <div className={styles.profileAddress}>
            Address: {me.address}
          </div>

          <div className={styles.profileEducation}>
            Education: {me.education}
          </div>
        </div>
      </section>
    </div>
  );
}

function MidRow({
  me,
  skills,
  onClickTile,
}: {
  me: StudentMe;
  filledMedals: number;
  skills: Skill[];
  onClickTile: (id: TileId) => void;
}) {
  const badgeThresholds = [5, 6, 10, 20, 35];
  const filledMedals = badgeThresholds.filter((lv) => me.level >= lv).length;
  const currentBadgeIndex =
    filledMedals > 0 ? Math.min(filledMedals - 1, LEVEL_BADGES.length - 1) : -1;

  return (
    <div className={styles.midGrid}>
      <section className={cx(styles.card, styles.rankCard)}>
        <div className={styles.rankTop}>
          <div className={styles.levelWrap}>
            <div className={styles.levelXpBox} />

            <div className={styles.levelXpScore}>
              <span>{me.xp}/{me.xpMax}</span>
              <span>XP</span>
            </div>

            <div className={styles.levelBadgeBox}>
              <div className={styles.levelBadgeBg} />
              <div className={styles.levelValue}>{me.level}</div>
            </div>

            <img
              src={
                currentBadgeIndex >= 0
                  ? LEVEL_BADGES[currentBadgeIndex]
                  : "/images/icons/badge01-icon.png"
              }
              alt=""
              aria-hidden="true"
              className={styles.levelBadgeIcon}
            />

          </div>
        </div>

        <div className={styles.medalRow}>
          {LEVEL_BADGES.map((src, i) => {
            const unlocked = i < filledMedals;
            const active = i === currentBadgeIndex;

            return (
              <div
                key={src}
                className={cx(
                  styles.medalSlot,
                  unlocked ? styles.medalOn : styles.medalOff,
                  active && styles.medalActive
                )}
              >
                <img
                  src={src}
                  alt={`Level badge ${i + 1}`}
                  className={styles.medalImg}
                  draggable={false}
                />
              </div>
            );
          })}
        </div>

        <div className={styles.tileRow}>
          {BADGE_TILES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.tileBtn}
              onClick={() => onClickTile(t.id)}
              aria-label={t.label}
            >
              <div className={styles.tileOuter} />
              <div className={styles.tileInner} />

              <div className={styles.tileIconWrap}>
                <img src={t.image} alt={t.alt} className={styles.tileIcon} />
              </div>

              <div className={styles.tileLabel}>{t.label}</div>
            </button>
          ))}
        </div>

      </section>

      <section className={cx(styles.card, styles.skillCard)}>
        <div className={styles.skillHead}>
          <div className={styles.skillTitle}>Skill Progress graph</div>
        </div>

        <div className={styles.skillViewport}>
          <div
            className={styles.skillScroll}
            role="region"
            aria-label="Skill progress list"
          >
            <div className={styles.skillRow}>
              {skills.map((s, i) => (
                <div key={s.id} className={styles.skillCol}>
                  <div className={styles.skillPct}>{s.percent}%</div>

                  <div className={styles.skillTube}>
                    <div
                      className={cx(
                        styles.skillFill,
                        i === 0 && styles.trackGreenWide,
                        i === 1 && styles.trackPink,
                        i === 2 && styles.trackYellow,
                        i === 3 && styles.trackGreen,
                        i === 4 && styles.trackSoftPink,
                        i === 5 && styles.trackBlue,
                        i === 6 && styles.trackOrange,
                        i === 7 && styles.trackRose,
                        i === 8 && styles.trackSoftPink,
                        i === 9 && styles.trackBlue,
                        i === 10 && styles.trackOrange,
                        i === 11 && styles.trackRose
                      )}
                      style={{ height: `${s.percent}%` }}
                    />

                  </div>

                  <div className={styles.skillLabel} title={s.name}>
                    {s.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/*  Split card: Activity | Mission (Figma structure) */
function ActivityMissionSplit() {
  return (
    <section className={cx(styles.card, styles.splitCard)}>
      <div className={styles.splitCardBg} />
      <div className={styles.splitDivider} aria-hidden />

      <div className={styles.activityPane}>
        <div className={styles.activityPaneHead}>
          <div className={styles.activityOverviewTitle}>Activity Overview</div>

          <button className={styles.viewAllBtn} type="button">
            <span>view all</span>
          </button>
        </div>

        <div className={styles.activityIconWrap} aria-hidden>
          <img
            src="/images/icons/jigsaw-icon.png"
            alt=""
            className={styles.activityIconImg}
            draggable={false}
          />
        </div>

        <div className={styles.activityScrollArea}>
          <div className={styles.activityRow}>
            {ACTIVITIES.map((a) => (
              <button key={a.id} type="button" className={styles.activityCard}>
                <div className={styles.activityCardBg} />

                <div className={styles.activityCardText}>
                  <div className={styles.activityCardTitle}>{a.title}</div>
                  <div className={styles.activityCardSub}>{a.sub}</div>
                </div>

                <div className={styles.activityRewardIcon} aria-hidden>
                  ⭐
                </div>

                <div className={styles.activityRewardText}>{a.xp} XP</div>
              </button>
            ))}

            {ACTIVITIES.map((a) => (
              <button key={`${a.id}-copy`} type="button" className={styles.activityCard}>
                <div className={styles.activityCardBg} />

                <div className={styles.activityCardText}>
                  <div className={styles.activityCardTitle}>{a.title}</div>
                  <div className={styles.activityCardSub}>{a.sub}</div>
                </div>

                <div className={styles.activityRewardIcon} aria-hidden>
                  ⭐
                </div>

                <div className={styles.activityRewardText}>{a.xp} XP</div>
              </button>
            ))}
          </div>
        </div>

      </div>

      <div className={styles.missionPane}>
        <div className={styles.missionPaneTitle}>Today&apos;s mission</div>

        <div className={styles.missionPaneList}>
          <div className={styles.missionPaneItem}>
            <div className={styles.missionPaneText}>Join 2 activities</div>
            <div className={styles.missionPaneXp}>10 XP</div>
          </div>

          <div className={styles.missionPaneItem}>
            <div className={styles.missionPaneText}>Complete one activity</div>
            <div className={styles.missionPaneXp}>10 XP</div>
          </div>

          <div className={styles.missionPaneItem}>
            <div className={styles.missionPaneText}>Join activity in 15 minutes</div>
            <div className={styles.missionPaneXp}>10 XP</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Split card: Completion | XP chart (Figma structure) */
function BottomSplit() {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [selectedSegment, setSelectedSegment] = useState<
    "completed" | "inProgress" | "registered" | "incomplete" | null
  >(null);

  const completionSegments = {
    completed: {
      key: "completed" as const,
      title: "Completed",
      count: 3,
      color: "#9FD5A8",
      colorClass: styles.badgeFillGreen,
      items: [
        "Frontend Basics & Web Terminology",
        "UI Layout Explanation Task",
        "Responsive Web Page Workshop",
      ],
    },
    inProgress: {
      key: "inProgress" as const,
      title: "In Progress",
      count: 10,
      color: "#F1C97B",
      colorClass: styles.badgeFillYellowSoft,
      items: [
        "Typography Practice Challenge",
        "Color Theory Basics",
        "Landing Page Wireframe",
        "Accessibility Intro Task",
        "Component Naming Exercise",
        "Responsive Grid Exercise",
        "Portfolio Content Draft",
        "Navbar Interaction Practice",
        "Button Variant Design",
        "Card Layout Refinement",
      ],
    },
    registered: {
      key: "registered" as const,
      title: "Registered",
      count: 1,
      color: "#7EC6D9",
      colorClass: styles.badgeFillBlue,
      items: ["Advanced Prototype Session"],
    },
    incomplete: {
      key: "incomplete" as const,
      title: "Incomplete",
      count: 1,
      color: "#E58F82",
      colorClass: styles.badgeFillRed,
      items: ["JavaScript Fundamentals Quiz"],
    },
  } as const;

  const segmentOrder = [
    completionSegments.completed,
    completionSegments.incomplete,
    completionSegments.registered,
    completionSegments.inProgress,
  ];

  const totalActivities = segmentOrder.reduce((sum, seg) => sum + seg.count, 0);

  const allItems = segmentOrder.flatMap((seg) =>
    seg.items.map((item) => ({
      item,
      colorClass: seg.colorClass,
      sectionTitle: seg.title,
    }))
  );

  const currentInfo = selectedSegment ? completionSegments[selectedSegment] : null;
  const rightItems = currentInfo
    ? currentInfo.items.map((item) => ({
      item,
      colorClass: currentInfo.colorClass,
      sectionTitle: currentInfo.title,
    }))
    : allItems;

  const dailyBars = [
    { labelTop: "SUN", labelBottom: "04/01/2026", xp: 20 },
    { labelTop: "MON", labelBottom: "05/02/2026", xp: 25 },
    { labelTop: "TUE", labelBottom: "06/02/2026", xp: 15 },
    { labelTop: "WED", labelBottom: "07/02/2026", xp: 23 },
    { labelTop: "THU", labelBottom: "08/02/2026", xp: 12 },
    { labelTop: "FRI", labelBottom: "09/02/2026", xp: 25 },
    { labelTop: "SAT", labelBottom: "10/02/2026", xp: 30 },
    { labelTop: "SUN", labelBottom: "11/02/2026", xp: 18 },
    { labelTop: "MON", labelBottom: "12/02/2026", xp: 32 },
  ];

  const weeklyBars = [
    { labelTop: "week1", labelBottom: "04/01/26-10/01/26", xp: 175 },
    { labelTop: "week2", labelBottom: "11/01/26-17/01/26", xp: 90 },
    { labelTop: "week3", labelBottom: "18/01/26-24/01/26", xp: 150 },
    { labelTop: "week4", labelBottom: "25/01/26-31/01/26", xp: 110 },
    { labelTop: "week5", labelBottom: "01/02/26-07/02/26", xp: 185 },
    { labelTop: "week6", labelBottom: "08/02/26-14/02/26", xp: 140 },
  ];

  const barsRaw = period === "daily" ? dailyBars : weeklyBars;
  const maxXp = Math.max(...barsRaw.map((b) => b.xp), 1);
  const chartMaxHeight = period === "daily" ? 126 : 138;

  const bars = barsRaw.map((b) => ({
    ...b,
    h: Math.max(32, Math.round((b.xp / maxXp) * chartMaxHeight)),
  }));

  const size = 210;
  const center = size / 2;
  const radius = 56;
  const strokeWidth = 40;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  const donutSegments = segmentOrder.map((seg) => {
    const fraction = seg.count / totalActivities;
    const arc = circumference * fraction;
    const startFraction = accumulated;
    const midFraction = startFraction + fraction / 2;
    accumulated += fraction;

    const angle = midFraction * Math.PI * 2 - Math.PI / 2;
    const isActive = selectedSegment === seg.key;

    const popDistance = isActive ? 3 : 0;
    const offsetX = isActive ? Math.cos(angle) * popDistance : 0;
    const offsetY = isActive ? Math.sin(angle) * popDistance : 0;

    const labelRadius =
      seg.key === "inProgress"
        ? radius - strokeWidth / 2 + 2
        : radius - strokeWidth / 2 + 8;

    const labelX = center + Math.cos(angle) * labelRadius;
    const labelY = center + Math.sin(angle) * labelRadius;

    return {
      ...seg,
      arc,
      dashOffset: -startFraction * circumference,
      offsetX,
      offsetY,
      labelX,
      labelY,
      isActive,
    };
  });

  const yTicks = period === "daily" ? [0, 10, 20, 30, 40] : [0, 50, 100, 150, 200];
  const chartMaxValue = yTicks[yTicks.length - 1];
  const chartDrawableHeight = period === "daily" ? 116 : 124;

  const barsForRender = barsRaw.map((b) => ({
    ...b,
    h: Math.max(22, Math.round((b.xp / chartMaxValue) * chartDrawableHeight)),
  }));

  const itemWidth = period === "daily" ? 60 : 82;
  const itemGap = period === "daily" ? 8 : 12;
  const plotWidth = barsForRender.length * itemWidth + (barsForRender.length - 1) * itemGap;

  return (
    <section className={cx(styles.card, styles.splitCardBottom)}>
      <div className={styles.bottomSplitDivider} aria-hidden />

      <div className={styles.completionPane}>
        <div className={styles.completionTitle}>Activity Completion Status</div>

        <div className={styles.completionContentFigure}>
          <div className={styles.completionDonutCol}>
            <div
              className={styles.donutFigureWrap}
              onClick={() => setSelectedSegment(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedSegment(null);
                }
              }}
              aria-label="Show all activity statuses"
            >
              <svg
                viewBox={`0 0 ${size} ${size}`}
                className={styles.donutFigureSvg}
                aria-label="Activity completion donut chart"
              >
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="#F3EEE8"
                  strokeWidth={strokeWidth}
                />

                {donutSegments.map((seg) => (
                  <g
                    key={seg.key}
                    transform={`translate(${seg.offsetX} ${seg.offsetY})`}
                    className={styles.donutFigureGroup}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSegment(seg.key);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedSegment(seg.key);
                      }
                    }}
                  >
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="butt"
                      strokeDasharray={`${seg.arc} ${circumference - seg.arc}`}
                      strokeDashoffset={seg.dashOffset}
                      transform={`rotate(-90 ${center} ${center})`}
                      className={cx(
                        styles.donutFigureStroke,
                        selectedSegment === null && styles.donutFigureStrokeNeutral,
                        seg.isActive && styles.donutFigureStrokeActive,
                        selectedSegment !== null &&
                        selectedSegment !== seg.key &&
                        styles.donutFigureStrokeDim
                      )}
                    />

                    <text
                      x={seg.labelX}
                      y={seg.labelY}
                      textAnchor="middle"
                      className={cx(
                        seg.key === "inProgress"
                          ? styles.donutFigureBigNumber
                          : styles.donutFigureNumber
                      )}
                    >
                      {seg.count}
                    </text>
                  </g>
                ))}

                <circle
                  cx={center}
                  cy={center}
                  r={30}
                  fill="#F4F4F1"
                  stroke="#3A332C"
                  strokeWidth="1.4"
                />

                <text
                  x={center}
                  y={center + 6}
                  textAnchor="middle"
                  className={styles.donutFigureCenter}
                >
                  {totalActivities}
                </text>


              </svg>
            </div>

            <div className={styles.completionLegendGrid}>
              {segmentOrder.map((seg) => (
                <button
                  key={seg.key}
                  type="button"
                  className={cx(
                    styles.completionLegendButton,
                    seg.colorClass,
                    selectedSegment === seg.key && styles.completionLegendButtonActive
                  )}
                  onClick={() => setSelectedSegment(seg.key)}
                >
                  <span className={styles.completionLegendButtonText}>{seg.title}</span>
                  <span className={styles.completionLegendButtonCount}>({seg.count})</span>
                </button>
              ))}

              <button
                type="button"
                className={cx(
                  styles.completionLegendButton,
                  styles.completionLegendAllButton,
                  selectedSegment === null && styles.completionLegendButtonActive
                )}
                onClick={() => setSelectedSegment(null)}
              >
                <span className={styles.completionLegendButtonText}>All</span>
                <span className={styles.completionLegendButtonCount}>({totalActivities})</span>
              </button>
            </div>
          </div>

          <div className={styles.completionInfoCol}>
            <div
              className={cx(
                styles.completionBadgeFigure,
                currentInfo ? currentInfo.colorClass : styles.completionBadgeAll
              )}
            >
              {currentInfo ? currentInfo.title : "All Statuses"}
            </div>

            <div className={styles.completionInfoListScrollable}>
              {rightItems.map((entry, idx) => (
                <div key={`${entry.sectionTitle}-${entry.item}-${idx}`} className={styles.completionInfoItem}>
                  - {entry.item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.xpPane}>
        <div className={styles.xpChartTitle}>
          {period === "daily" ? "กราฟ XP ต่อวัน" : "กราฟ XP ต่อสัปดาห์"}
        </div>

        <div className={styles.periodButton}>
          <div className={styles.periodButtonOuter} />

          <button
            type="button"
            className={styles.periodDaily}
            onClick={() => setPeriod("daily")}
            aria-pressed={period === "daily"}
          >
            <div
              className={cx(
                styles.periodDailyBg,
                period === "daily" ? styles.periodActiveBg : styles.periodInactiveBg
              )}
            />
            <div className={styles.periodText}>daily</div>
          </button>

          <button
            type="button"
            className={styles.periodWeekly}
            onClick={() => setPeriod("weekly")}
            aria-pressed={period === "weekly"}
          >
            <div
              className={cx(
                styles.periodWeeklyBg,
                period === "weekly" ? styles.periodActiveBg : styles.periodInactiveBg
              )}
            />
            <div className={styles.periodText}>weekly</div>
          </button>

          <div className={styles.periodDividerLine} />
        </div>

        <div className={styles.barGraph}>
          <div className={styles.barScrollArea}>
            <div className={styles.barGraphInner}>
              <div className={styles.barYAxis}>
                {yTicks
                  .slice()
                  .reverse()
                  .map((tick) => (
                    <div key={tick} className={styles.barYAxisTick}>
                      <span className={styles.barYAxisLabel}>{tick}</span>
                    </div>
                  ))}
              </div>

              <div className={styles.barPlotArea} style={{ width: `${plotWidth}px` }}>
                {yTicks
                  .slice(1)
                  .reverse()
                  .map((tick, idx) => (
                    <div key={tick} className={styles.barGridLine} style={{ top: `${idx * 25}%` }}>
                      <span className={styles.barGridValue}>{tick}</span>
                    </div>
                  ))}

                <div className={styles.barBaseLine} />

                <div
                  className={cx(
                    styles.barGroup,
                    period === "weekly" && styles.barGroupWeekly
                  )}
                >
                  {barsForRender.map((b) => (
                    <div
                      key={`${period}-${b.labelTop}-${b.labelBottom}`}
                      className={cx(
                        styles.barGroupItem,
                        period === "weekly" && styles.barGroupItemWeekly
                      )}
                    >
                      <div className={styles.barRect} style={{ height: `${b.h}px` }} />
                      <div className={styles.barXp} style={{ bottom: `${b.h + 40}px` }}>
                        {b.xp} XP
                      </div>
                      <div className={styles.barDateLabel}>
                        <span className={styles.barDay}>{b.labelTop}</span>
                        <span className={styles.barDate}>{b.labelBottom}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AvatarCard({
  selected,
  onSelect,
  avatarChoices,
}: {
  selected: number;
  onSelect: (idx: number) => void;
  avatarChoices: string[];
}) {
  return (
    <section className={cx(styles.card, styles.avatarCard)}>
      <div className={styles.avatarBig}>
        <div className={styles.avatarStub} />
      </div>

      <div className={styles.avatarThumbRow}>
        {avatarChoices.map((src, idx) => (
          <button
            key={src}
            type="button"
            className={cx(styles.avatarThumbCard, idx === selected && styles.avatarThumbCardOn)}
            onClick={() => onSelect(idx)}
          >
            <div className={styles.avatarThumbImg} />
            <div className={styles.avatarCheck}>
              <span className={cx(styles.checkBox, idx === selected && styles.checkBoxOn)}>
                {idx === selected ? "✓" : ""}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

type CalendarEvent =
  | "pink"
  | "yellow"
  | "green"
  | "softPink"
  | "blue"
  | "orange"
  | "rose"
  | "greenWide";

type CalendarDayItem = {
  day: string;
  weekend?: boolean;
  otherMonth?: boolean;
  muted?: boolean;
  events: CalendarEvent[];
};

function CalendarCard({ title }: { title: string }) {
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const weeks: CalendarDayItem[][] = [
    [
      { day: "28", otherMonth: true, events: [] },
      { day: "29", otherMonth: true, events: [] },
      { day: "30", otherMonth: true, events: [] },
      { day: "1", events: ["green", "orange"] },
      { day: "2", events: ["orange"] },
      { day: "3", events: ["rose"] },
      { day: "4", weekend: true, events: [] },
    ],
    [
      { day: "5", weekend: true, events: ["pink", "yellow", "green"] },
      { day: "6", events: ["softPink", "blue"] },
      { day: "7", events: [] },
      { day: "8", events: ["greenWide", "pink"] },
      { day: "9", events: [] },
      { day: "10", events: [] },
      { day: "11", weekend: true, events: [] },
    ],
    [
      { day: "12", weekend: true, muted: true, events: [] },
      { day: "13", muted: true, events: [] },
      { day: "14", muted: true, events: [] },
      { day: "15", muted: true, events: [] },
      { day: "16", muted: true, events: [] },
      { day: "17", muted: true, events: [] },
      { day: "18", weekend: true, muted: true, events: [] },
    ],
    [
      { day: "19", weekend: true, muted: true, events: [] },
      { day: "20", muted: true, events: [] },
      { day: "21", muted: true, events: [] },
      { day: "22", muted: true, events: [] },
      { day: "23", muted: true, events: [] },
      { day: "24", muted: true, events: [] },
      { day: "25", weekend: true, muted: true, events: [] },
    ],
    [
      { day: "26", weekend: true, muted: true, events: [] },
      { day: "27", muted: true, events: [] },
      { day: "28", muted: true, events: [] },
      { day: "29", muted: true, events: [] },
      { day: "30", muted: true, events: [] },
      { day: "31", muted: true, events: [] },
      { day: "1", otherMonth: true, muted: true, events: [] },
    ],
    [
      { day: "2", otherMonth: true, events: [] },
      { day: "3", otherMonth: true, events: [] },
      { day: "4", otherMonth: true, events: [] },
      { day: "5", otherMonth: true, events: [] },
      { day: "6", otherMonth: true, events: [] },
      { day: "7", otherMonth: true, events: [] },
      { day: "8", otherMonth: true, events: [] },
    ],
  ];

  return (
    <section className={cx(styles.card, styles.calendarCard)}>
      <div className={styles.calendarPanel}>
        <div className={styles.calendarHeader}>
          <div className={styles.calendarMonthChip}>
            <div className={styles.calendarTitle}>{title}</div>
          </div>
        </div>

        <div className={styles.calendarGrid}>
          <div className={styles.calendarRow}>
            {weekDays.map((d, idx) => (
              <div
                key={d}
                className={cx(
                  styles.calendarWeekDay,
                  (idx === 0 || idx === 6) && styles.calendarWeekEnd
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, rowIdx) => (
            <div key={rowIdx} className={styles.calendarRow}>
              {week.map((item, idx) => (
                <div
                  key={`${rowIdx}-${idx}-${item.day}`}
                  className={cx(
                    styles.calendarCell,
                    item.weekend && styles.calendarWeekEnd,
                    item.otherMonth && styles.calendarOtherMonth,
                    item.muted && styles.calendarMutedCell
                  )}
                >
                  <div className={styles.calendarCellInner}>
                    <div className={styles.calendarDay}>{item.day}</div>

                    <div className={styles.calendarEvents}>
                      {item.events.map((event, i) => (
                        <div
                          key={i}
                          className={cx(
                            styles.trackBar,
                            event === "pink" && styles.trackPink,
                            event === "yellow" && styles.trackYellow,
                            event === "green" && styles.trackGreen,
                            event === "softPink" && styles.trackSoftPink,
                            event === "blue" && styles.trackBlue,
                            event === "orange" && styles.trackOrange,
                            event === "rose" && styles.trackRose,
                            event === "greenWide" && styles.trackGreenWide
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =======================
   Modal Components
======================= */
function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function EditProfileModal({
  draft,
  setDraft,
  onCancel,
  onSave,
}: {
  draft: {
    firstName: string;
    lastName: string;
    birthDate: string;
    phone: string;
    email: string;
    address: string;
    about: string;
  };
  setDraft: React.Dispatch<React.SetStateAction<any>>;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className={styles.modalTitle}>Personal Information</div>

      <div className={styles.modalForm}>
        <Field label="First name">
          <input className={styles.modalInput} value={draft.firstName} onChange={(e) => setDraft((p: any) => ({ ...p, firstName: e.target.value }))} />
        </Field>

        <Field label="Last name">
          <input className={styles.modalInput} value={draft.lastName} onChange={(e) => setDraft((p: any) => ({ ...p, lastName: e.target.value }))} />
        </Field>

        <div className={styles.modalGrid2}>
          <Field label="Birth date">
            <input className={styles.modalInput} value={draft.birthDate} onChange={(e) => setDraft((p: any) => ({ ...p, birthDate: e.target.value }))} />
          </Field>

          <Field label="Phone number">
            <input className={styles.modalInput} value={draft.phone} onChange={(e) => setDraft((p: any) => ({ ...p, phone: e.target.value }))} />
          </Field>
        </div>

        <Field label="Email">
          <input className={styles.modalInput} value={draft.email} onChange={(e) => setDraft((p: any) => ({ ...p, email: e.target.value }))} />
        </Field>

        <Field label="Address">
          <input className={styles.modalInput} value={draft.address} onChange={(e) => setDraft((p: any) => ({ ...p, address: e.target.value }))} />
        </Field>

        <Field label="About me">
          <textarea className={styles.modalTextarea} value={draft.about} onChange={(e) => setDraft((p: any) => ({ ...p, about: e.target.value }))} />
        </Field>
      </div>

      <div className={styles.modalActions}>
        <button className={cx(styles.modalBtn, styles.modalOk)} type="button" onClick={onSave} aria-label="Save">
          ✓
        </button>
        <button className={cx(styles.modalBtn, styles.modalCancel)} type="button" onClick={onCancel} aria-label="Cancel">
          ✕
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <div className={styles.modalLabel}>{label}</div>
      {children}
    </label>
  );
}

function GridModal({ title, count, onClose }: { title: string; count: number; onClose: () => void }) {
  return (
    <>
      <div className={styles.modalTitle}>{title}</div>
      <div className={styles.modalGridBadges}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={styles.modalBadgeBox} />
        ))}
      </div>
      <div className={styles.modalActions}>
        <button className={cx(styles.modalBtn, styles.modalOk)} type="button" onClick={onClose} aria-label="Close">
          ✓
        </button>
      </div>
    </>
  );
}