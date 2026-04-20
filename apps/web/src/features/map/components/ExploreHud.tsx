import { useMemo, useState } from "react";
import type { NavItem } from "@/lib/config/student/routes";
import { STUDENT_SIDEBAR_ITEMS } from "@/lib/config/student/routes";
import StudentSidebar from "@/components/shared/student/StudentSidebar";
import Avatar3D from "@/components/shared/Avatar3D";

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

type ExploreSelectedCompany = {
  org_id: string;
  name: string;
  description?: string;
  tagline?: string;
  logoUrl?: string;
  website_url?: string;
  phone?: string;
  email?: string;
  location?: string;
  activities: ExploreActivity[];
  summary: {
    published: number;
    totalActivities: number;
    challenges: number;
    courses: number;
    meetings: number;
  };
};

type ExploreHudProps = {
  selectedCompany: ExploreSelectedCompany | null;
  onCloseCompany: () => void;
  onToggleView: () => void;
  onFocusAvatar: () => void;
  onNavigate: (item: NavItem) => void;
  onLogout?: () => void;
  navItems?: NavItem[];
  userName?: string;
  level?: number;
  xpCurrent?: number;
  xpMax?: number;
  avatarModelUrl?: string;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onRegisterActivity: (activityId: string) => void;
  registeringActivityId?: string | null;
};

const LEVEL_BADGES = [
  "/images/icons/badge01.png",
  "/images/icons/badge02.png",
  "/images/icons/badge03.png",
  "/images/icons/badge04.png",
  "/images/icons/badge05.png",
];

const BADGE_THRESHOLDS = [1, 3, 5, 10, 16];

function getLevelBadgeUrl(level: number): string {
  const filledMedals = BADGE_THRESHOLDS.filter((lv) => level >= lv).length;
  const currentBadgeIndex =
    filledMedals > 0 ? Math.min(filledMedals - 1, LEVEL_BADGES.length - 1) : -1;
  return currentBadgeIndex >= 0
    ? LEVEL_BADGES[currentBadgeIndex]
    : "/images/icons/badge01-icon.png";
}

const C = {
  panel: "#D9D2C9",
  panelSoft: "#EEEAE4",
  bg: "#F3EEE8",
  white: "rgba(255,255,255,0.72)",
  whiteSolid: "#FEFEFE",
  strokeDark: "rgba(0, 0, 0, 0.48)",
  strokeSoft: "rgba(0,0,0,0.10)",
  text: "#111111",
  textMuted: "rgba(17,17,17,0.68)",
  accent: "#CFAE83",
  greenBg: "rgba(34,197,94,0.18)",
  greenText: "#175a2a",
  orangeBg: "rgba(245, 158, 11, 0.18)",
  orangeText: "#8a4b00",
  chipBg: "#ded6e9",
  chipText: "#0c1019",
};

function MetaChip({ value }: { value: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 400,
        padding: "5px 10px",
        borderRadius: 2,
        background: C.chipBg,
        color: C.chipText,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

function ActivityTypeBadge({ value }: { value: string }) {
  const lower = String(value).toLowerCase();
  const background =
    lower === "challenge"
      ? "#AFC3D5"
      : lower === "course"
        ? "#AFC3D5"
        : "#AFC3D5";

  const color =
    lower === "challenge"
      ? "#101010"
      : lower === "course"
        ? "#101010"
        : "#101010";

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "5px 10px",
        borderRadius: 2,
        background,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

export default function ExploreHud({
  selectedCompany,
  onCloseCompany,
  onToggleView,
  onFocusAvatar,
  onNavigate,
  onLogout,
  navItems = STUDENT_SIDEBAR_ITEMS,
  userName = "Carolyn",
  level = 10,
  xpCurrent = 580,
  xpMax = 1200,
  avatarModelUrl = "",
  searchText,
  onSearchTextChange,
  onRegisterActivity,
  registeringActivityId = null,
}: ExploreHudProps) {
  const progressPct = xpMax > 0 ? Math.min((xpCurrent / xpMax) * 100, 100) : 0;
  const [activeTab, setActiveTab] = useState<"activities" | "profile">("activities");

  const filteredActivities = useMemo(() => {
    if (!selectedCompany) return [];
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return selectedCompany.activities;

    return selectedCompany.activities.filter((activity) => {
      return (
        activity.title.toLowerCase().includes(keyword) ||
        activity.description.toLowerCase().includes(keyword) ||
        activity.type.toLowerCase().includes(keyword) ||
        selectedCompany.name.toLowerCase().includes(keyword)
      );
    });
  }, [searchText, selectedCompany]);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 18,
          top: 18,
          bottom: 18,
          zIndex: 50,
        }}
      >
        <StudentSidebar
          items={navItems}
          onNavigate={onNavigate}
          onLogout={onLogout}
          style={{ height: "100%" }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 150,
          top: 28,
          width: 520,
          height: 46,
          borderRadius: 4,
          background: "rgba(255,255,255,0.72)",
          boxShadow: "3px 3px 8px rgba(111, 111, 111, 0.4)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 10,
          zIndex: 40,
        }}
      >
        <span style={{ opacity: 1 }}>
          <img src="/images/icons/search-icon.png" alt="Search" />
        </span>
        <input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search organization or published activity"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 14,
          }}
        />
      </div>

      <button
        onClick={onToggleView}
        title="Toggle camera view"
        type="button"
        style={{
          position: "absolute",
          left: 150 + 520 + 12,
          top: 31,
          zIndex: 41,
          width: 40,
          height: 40,
          borderRadius: 4,
          background: "rgba(255,255,255,0.72)",
          boxShadow: "3px 3px 8px rgba(111, 111, 111, 0.4)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          border: "none",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="24px"
          viewBox="0 -960 960 960"
          width="24px"
          fill="#535353"
        >
          <path d="m360-160-56-56 70-72q-128-17-211-70T80-480q0-83 115.5-141.5T480-680q169 0 284.5 58.5T880-480q0 62-66.5 111T640-296v-82q77-20 118.5-49.5T800-480q0-32-85.5-76T480-600q-149 0-234.5 44T160-480q0 24 51 57.5T356-372l-52-52 56-56 160 160-160 160Z" />
        </svg>
      </button>

      <div
        style={{
          position: "absolute",
          right: 28,
          top: 28,
          width: 360,
          height: 95,
          borderRadius: 4,
          background: "#efece8",
          border: "2px solid #D9D2C9",
          boxShadow: "6px 6px 0px #b8ada0",
          display: "flex",
          alignItems: "center",
          padding: 16,
          gap: 18,
          zIndex: 40,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 27,
              letterSpacing: 0.2,
              color: "#111",
              lineHeight: 1,
              marginBottom: 14,
            }}
          >
            {userName}
          </div>

          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 84,
                height: 35,
                borderRadius: 2,
                background: "#CFAE83",
                boxShadow: "3px 3px 0px rgba(126, 119, 117, 0.2)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: 18,
                color: "#111",
              }}
            >
              {level}
            </div>

            <div
              style={{
                flex: 1,
                height: 35,
                borderRadius: 2,
                background: "#EEEAE4",
                border: "1px solid rgba(137, 137, 137, 0.48)",
                boxShadow: "3px 3px 0px rgba(126, 119, 117, 0.2)",
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                gap: 10,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 2,
                  background: "rgba(0,0,0,0.12)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: "100%",
                    background: "rgba(0,0,0,0.45)",
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111",
                  whiteSpace: "nowrap",
                }}
              >
                {xpCurrent}/{xpMax} XP
              </div>
            </div>

            <img
              src={getLevelBadgeUrl(level)}
              alt={`Level badge`}
              aria-hidden
              style={{
                position: "absolute",
                left: 57,
                top: -10,
                width: 52,
                height: 52,
                pointerEvents: "none",
                objectFit: "contain",
                filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.22))",
              }}
            />
          </div>
        </div>

        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 999,
            background: "#fbfbfb",
            border: "1.7px solid rgba(135, 134, 134, 0.48)",
            boxShadow: "2px 2px 2px #D9D2C9",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
          title="Avatar"
        >
          <div style={{ width: "100%", height: "100%" }}>
            <Avatar3D
              modelUrl={avatarModelUrl || "/models/boy.glb"}
              modelScale={1.8}
              modelPosition={[-2.4, -0.3, 1]}
              cameraPosition={[0, 0.95, 4.0]}
              cameraFov={56}
            />
          </div>
        </div>
      </div>

      {selectedCompany ? (
        <div
          style={{
            position: "absolute",
            right: 28,
            top: 150,
            width: 420,
            maxHeight: "calc(100vh - 170px)",
            borderRadius: 2,
            background: "rgba(255,255,255,0.66)",
            border: "1px solid rgba(0,0,0,0.10)",
            boxShadow: "0 18px 44px rgba(0,0,0,0.16)",
            backdropFilter: "blur(12px)",
            padding: 16,
            zIndex: 55,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 999,
                overflow: "hidden",
                flex: "0 0 auto",
                background: "#fff",
                border: "2px solid rgba(0,0,0,0.08)",
                display: "grid",
                placeItems: "center",
              }}
            >
              {selectedCompany.logoUrl ? (
                <img
                  src={selectedCompany.logoUrl}
                  alt={selectedCompany.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: C.panel,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    color: "#7a5c33",
                    fontSize: 18,
                  }}
                >
                  {selectedCompany.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 20,
                  color: "#1f1f1f",
                  lineHeight: 1.1,
                }}
              >
                {selectedCompany.name}
              </div>

              <div
                style={{
                  marginTop: 6,
                  opacity: 0.8,
                  fontSize: 13,
                  lineHeight: 1.5,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {selectedCompany.description || "Organization overview"}
              </div>
            </div>

            <button
              onClick={onCloseCompany}
              style={{
                width: 34,
                height: 34,
                borderRadius: 5,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                fontWeight: 900,
                flex: "0 0 auto",
              }}
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <MetaChip value={`${selectedCompany.summary.challenges} Challenges`} />
            <MetaChip value={`${selectedCompany.summary.courses} Courses`} />
            <MetaChip value={`${selectedCompany.summary.meetings} Meetings`} />
            <MetaChip value={`${selectedCompany.summary.published} Published`} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {(["activities", "profile"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  height: 34,
                  borderRadius: 5,
                  border:
                    activeTab === tab
                      ? "1px solid rgba(0,0,0,0.18)"
                      : "1px solid rgba(0,0,0,0.10)",
                  background:
                    activeTab === tab
                      ? "rgba(255,255,255,0.90)"
                      : "rgba(255,255,255,0.50)",
                  padding: "0 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  color: C.text,
                  cursor: "pointer",
                }}
              >
                {tab === "activities" ? "Published activities" : "Profile"}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, overflowY: "auto", paddingRight: 4 }}>
            {activeTab === "activities" ? (
              filteredActivities.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredActivities.map((activity) => {
                    const isRegistering = registeringActivityId === activity.id;
                    const isRegistered = activity.is_registered;

                    return (
                      <div
                        key={activity.id}
                        style={{
                          borderRadius: 5,
                          border: "1px solid rgba(0,0,0,0.10)",
                          background: "rgba(255,255,255,0.82)",
                          padding: 12,
                          display: "flex",
                          alignItems: "start",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 5,
                            // background: "rgba(59,130,246,0.10)",
                            // border: "1px solid rgba(59,130,246,0.18)",
                            display: "grid",
                            placeItems: "center",
                            flex: "0 0 auto",
                            fontSize: 18,
                          }}
                        >
                          <img
                            src="/images/icons/jigsaw-icon.png"
                            alt=""
                          // className={styles.activityBadgeImgFull}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "start",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: 14,
                                  color: C.text,
                                  lineHeight: 1.35,
                                }}
                              >
                                {activity.title}
                              </div>

                              {activity.description ? (
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 12,
                                    lineHeight: 1.5,
                                    color: C.textMuted,
                                  }}
                                >
                                  {activity.description}
                                </div>
                              ) : null}
                            </div>

                            <ActivityTypeBadge value={activity.type} />
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                            <MetaChip value={`${activity.hours} Hours`} />
                            <MetaChip value={`${activity.xp_reward} XP`} />
                            <MetaChip value={activity.status || "Published"} />
                          </div>

                          <button
                            type="button"
                            onClick={() => onRegisterActivity(activity.id)}
                            disabled={isRegistered || isRegistering}
                            style={{
                              marginTop: 12,
                              width: "100%",
                              height: 40,
                              borderRadius: 2,
                              border: "1px solid #BED4D0",
                              background: isRegistered
                                ? "rgba(17,24,39,0.08)"
                                : "#BED4D0",
                              cursor: isRegistered ? "default" : "pointer",
                              fontWeight: 900,
                              color: isRegistered ? "#4b5563" : "#275433",
                            }}
                          >
                            {isRegistering
                              ? "Joining..."
                              : isRegistered
                                ? "Already joined"
                                : "Join activity"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 5,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(255,255,255,0.76)",
                    padding: 14,
                    color: C.textMuted,
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  No published activities match this search.
                </div>
              )
            ) : (
              <div
                style={{
                  borderRadius: 5,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "rgba(255,255,255,0.76)",
                  padding: 14,
                  color: C.text,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
                  Organization profile
                </div>

                <div style={{ fontSize: 12, lineHeight: 1.65, color: C.textMuted }}>
                  <div>
                    <strong style={{ color: C.text }}>Website:</strong>{" "}
                    {selectedCompany.website_url || "-"}
                  </div>
                  <div>
                    <strong style={{ color: C.text }}>Phone:</strong>{" "}
                    {selectedCompany.phone || "-"}
                  </div>
                  <div>
                    <strong style={{ color: C.text }}>Email:</strong>{" "}
                    {selectedCompany.email || "-"}
                  </div>
                  <div>
                    <strong style={{ color: C.text }}>Location:</strong>{" "}
                    {selectedCompany.location || "-"}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  {[
                    [selectedCompany.summary.totalActivities, "Published activities"],
                    [selectedCompany.summary.challenges, "Challenges"],
                    [selectedCompany.summary.courses, "Courses"],
                    [selectedCompany.summary.meetings, "Meetings"],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      style={{
                        borderRadius: 5,
                        background: "rgba(0,0,0,0.03)",
                        border: "1px solid rgba(0,0,0,0.08)",
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>
                        {value}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            right: 28,
            bottom: 18,
            zIndex: 50,
            padding: "10px 18px",
            borderRadius: 5,
            background: "#FEFEFE",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 16px 26px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: C.text,
            pointerEvents: "none",
          }}
        >
          คลิกตึกขององค์กรเพื่อดูข้อมูลจริงและกิจกรรมที่เปิดให้เข้าร่วม
        </div>
      )}

      <button
        onClick={onFocusAvatar}
        title="Go to my avatar"
        type="button"
        style={{
          position: "absolute",
          right: 28,
          bottom: 18,
          zIndex: 60,
          width: 55,
          height: 55,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          fontSize: 20,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 14px 28px rgba(0,0,0,0.18)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="24px"
          viewBox="0 -960 960 960"
          width="30px"
          fill="#c6c6c6"
        >
          <path d="M440-42v-80q-125-14-214.5-103.5T122-440H42v-80h80q14-125 103.5-214.5T440-838v-80h80v80q125 14 214.5 103.5T838-520h80v80h-80q-14 125-103.5 214.5T520-122v80h-80Zm40-78q150 0 255-105t105-255q0-150-105-255T480-840q-150 0-255 105T120-480q0 150 105 255t255 105Zm0-80q-117 0-198.5-81.5T200-480q0-117 81.5-198.5T480-760q117 0 198.5 81.5T760-480q0 117-81.5 198.5T480-200Zm0-120q67 0 113.5-46.5T640-480q0-67-46.5-113.5T480-640q-67 0-113.5 46.5T320-480q0 67 46.5 113.5T480-320Z" />
        </svg>
      </button>
    </>
  );
}