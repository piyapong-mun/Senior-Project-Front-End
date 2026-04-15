import { useMemo, useState } from "react";
import type { NavItem } from "@/lib/config/organization/routes";
import OrgSidebar from "@/components/shared/organization/OrgSidebar";
import { ORGANIZATION_SIDEBAR_ITEMS } from "@/lib/config/organization/routes";

type OrgActivity = {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
  category?: string;
  xp_reward?: number;
  status?: string;
};

type OrgProfileSummary = {
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  totalActivities?: number;
  published?: number;
  draft?: number;
  meetings?: number;
  courses?: number;
  challenges?: number;
  participants?: number;
};

type OrgExploreHudProps = {
  orgName: string;
  orgLogoUrl?: string;
  activities?: OrgActivity[];
  profileSummary?: OrgProfileSummary;
  isOwnBuildingSelected: boolean;
  onClosePanel: () => void;
  onToggleView: () => void;
  onNavigate: (item: NavItem) => void;
  onLogout?: () => void;
  navItems?: NavItem[];
};

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
  gold: "#F3C24E",
  greenBg: "rgba(34,197,94,0.18)",
  greenText: "#175a2a",
  orangeBg: "rgba(245, 158, 11, 0.18)",
  orangeText: "#8a4b00",
  chipBg: "rgba(59,130,246,0.10)",
  chipText: "#0c1019",
};

function MetricCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div
      style={{
        minWidth: 96,
        height: 35,
        borderRadius: 4,
        background: C.accent,
        border: `2px solid ${C.strokeDark}`,
        boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
        display: "grid",
        placeItems: "center",
        padding: "0 10px",
      }}
    >
      <div style={{ textAlign: "center", lineHeight: 1 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{value}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(17,17,17,0.78)", marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value?: string }) {
  const lower = String(value ?? "").toLowerCase();
  const isPending = lower.includes("pending");
  const bg = isPending ? C.orangeBg : C.greenBg;
  const color = isPending ? C.orangeText : C.greenText;

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: "5px 10px",
        borderRadius: 5,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {value || "Open"}
    </span>
  );
}

function MetaChip({ value }: { value: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        padding: "5px 10px",
        borderRadius: 5,
        background: C.chipBg,
        color: C.chipText,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

export default function OrgExploreHud({
  orgName,
  orgLogoUrl,
  activities = [],
  profileSummary,
  isOwnBuildingSelected,
  onClosePanel,
  onToggleView,
  onNavigate,
  onLogout,
  navItems = ORGANIZATION_SIDEBAR_ITEMS,
}: OrgExploreHudProps) {
  const [activeTab, setActiveTab] = useState<"activities" | "profile">("activities");

  const summary = useMemo(
    () => ({
      totalActivities: profileSummary?.totalActivities ?? activities.length,
      published: profileSummary?.published ?? activities.length,
      draft: profileSummary?.draft ?? 0,
      meetings: profileSummary?.meetings ?? 0,
      courses: profileSummary?.courses ?? 0,
      challenges: profileSummary?.challenges ?? 0,
      participants: profileSummary?.participants ?? 0,
      description: profileSummary?.description ?? "",
      phone: profileSummary?.phone ?? "",
      email: profileSummary?.email ?? "",
      address: profileSummary?.address ?? "",
    }),
    [activities.length, profileSummary]
  );

  const totalXpReward = useMemo(
    () => activities.reduce((sum, item) => sum + Number(item.xp_reward ?? 0), 0),
    [activities]
  );

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
        <OrgSidebar items={navItems} onNavigate={onNavigate} onLogout={onLogout} style={{ height: "100%" }} />
      </div>

      <button
        onClick={onToggleView}
        title="Toggle camera view"
        type="button"
        style={{
          position: "absolute",
          right: 460,
          top: 31,
          zIndex: 41,
          width: 40,
          height: 40,
          borderRadius: 5,
          background: C.white,
          border: `2px solid ${C.strokeDark}`,
          boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#535353">
          <path d="m360-160-56-56 70-72q-128-17-211-70T80-480q0-83 115.5-141.5T480-680q169 0 284.5 58.5T880-480q0 62-66.5 111T640-296v-82q77-20 118.5-49.5T800-480q0-32-85.5-76T480-600q-149 0-234.5 44T160-480q0 24 51 57.5T356-372l-52-52 56-56 160 160-160 160Z" />
        </svg>
      </button>

      <div
        style={{
          position: "absolute",
          right: 28,
          top: 28,
          width: 420,
          minHeight: 108,
          borderRadius: 4,
          background: C.panel,
          border: `1px solid ${C.strokeDark}`,
          boxShadow: "2px 2px 4px rgba(0, 0, 0, 0.1)",
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
              fontWeight: 600,
              fontSize: 27,
              letterSpacing: 0.2,
              color: C.text,
              lineHeight: 1,
              marginBottom: 8,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {orgName}
          </div>

          <div
            style={{
              fontSize: 12,
              color: C.textMuted,
              lineHeight: 1.4,
              minHeight: 32,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              marginBottom: 10,
            }}
          >
            {summary.description || "Overview of your organization and currently active activities."}
          </div>

          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
            <MetricCard value={summary.totalActivities} label="Activities" />

            <div
              style={{
                flex: 1,
                height: 35,
                borderRadius: 4,
                background: C.panelSoft,
                border: `2px solid ${C.strokeDark}`,
                boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 14px",
                gap: 12,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted, whiteSpace: "nowrap" }}>
                {summary.draft} Draft
              </span> 
              <span style={{ width: 1, height: 16, background: "rgba(0,0,0,0.18)", flex: "0 0 auto" }} />
              <span style={{ fontSize: 12, fontWeight: 400, color: C.text, whiteSpace: "nowrap" }}>
                  {summary.published} Published
                </span>
            </div>
          </div>
        </div>

        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 999,
            background: C.panel,
            border: `2px solid ${C.strokeDark}`,
            boxShadow: "0 18px 40px rgba(144, 112, 84, 0.35)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
          title="Organization"
        >
          {orgLogoUrl ? (
            <img
              src={orgLogoUrl}
              alt={orgName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 999,
                background: C.whiteSolid,
                border: `2px solid rgba(0,0,0,0.12)`,
                display: "grid",
                placeItems: "center",
                fontSize: 28,
                fontWeight: 900,
                color: C.accent,
              }}
            >
              {orgName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 28,
          transform: "translateX(-50%)",
          zIndex: 50,
          padding: "10px 18px",
          borderRadius: 5,
          background: C.whiteSolid,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 16px 26px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: C.text,
          whiteSpace: "nowrap",
        }}
      >
        <span>👁</span>
        คุณกำลังดูแผนที่ในโหมดองค์กร
        {/* <span style={{ color: "rgba(0,0,0,0.18)" }}>|</span> */}
      </div>

      {isOwnBuildingSelected ? (
        <div
          style={{
            position: "absolute",
            right: 28,
            top: 180,
            width: 420,
            maxHeight: "calc(100vh - 190px)",
            borderRadius: 5,
            background: "rgba(255,255,255,0.60)",
            border: `1px solid ${C.strokeSoft}`,
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: "#1f1f1f", lineHeight: 1.1 }}>{orgName}</div>
              <div style={{ marginTop: 6, opacity: 0.78, fontSize: 13, lineHeight: 1.5 }}>
                {summary.description || "Organization overview"}
              </div>
            </div>

            <button
              onClick={onClosePanel}
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
            <MetaChip value={`${summary.courses} Courses`} />
            <MetaChip value={`${summary.challenges} Challenges`} />
            <MetaChip value={`${summary.meetings} Meetings`} />
            <MetaChip value={`${summary.published} Published`} />
            <MetaChip value={`${summary.draft} Draft`} />
            <MetaChip value={`${totalXpReward} XP total`} />
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
                  border: activeTab === tab ? "1px solid rgba(0,0,0,0.18)" : "1px solid rgba(0,0,0,0.10)",
                  background: activeTab === tab ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.50)",
                  padding: "0 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  color: C.text,
                  cursor: "pointer",
                }}
              >
                {tab === "activities" ? "Activities" : "Profile"}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, overflowY: "auto", paddingRight: 4 }}>
            {activeTab === "activities" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    style={{
                      borderRadius: 5,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "rgba(255,255,255,0.76)",
                      padding: 12,
                      display: "flex",
                      alignItems: "start",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 5,
                        background: "rgba(59,130,246,0.10)",
                        border: "1px solid rgba(59,130,246,0.18)",
                        display: "grid",
                        placeItems: "center",
                        flex: "0 0 auto",
                        fontSize: 18,
                      }}
                    >
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
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
                            <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: C.textMuted }}>
                              {activity.description}
                            </div>
                          ) : null}
                        </div>
                        <StatusBadge value={activity.status} />
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        {activity.difficulty ? <MetaChip value={activity.difficulty} /> : null}
                        {activity.category ? <MetaChip value={activity.category} /> : null}
                        <MetaChip value={`${activity.xp_reward ?? 0} XP`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Organization profile</div>
                <div style={{ fontSize: 12, lineHeight: 1.65, color: C.textMuted }}>
                  <div><strong style={{ color: C.text }}>Phone:</strong> {summary.phone || "-"}</div>
                  <div><strong style={{ color: C.text }}>Email:</strong> {summary.email || "-"}</div>
                  <div><strong style={{ color: C.text }}>Address:</strong> {summary.address || "-"}</div>
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
                    [summary.totalActivities, "Total activities"],
                    [summary.participants, "Total participants"],
                    [summary.courses, "Courses"],
                    [summary.challenges, "Challenges"],
                    [summary.meetings, "Meetings"],
                    [summary.published, "Published"],
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
                      <div style={{ fontWeight: 300, fontSize: 16, color: C.text }}>{value}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
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
            background: C.whiteSolid,
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

          คลิกอาคารขององค์กรคุณเพื่อดูข้อมูลกิจกรรม
        </div>
      )}
    </>
  );
}
