import type { NavItem } from "@/lib/config/student/routes";
import { STUDENT_SIDEBAR_ITEMS } from "@/lib/config/student/routes";
import StudentSidebar from "@/components/shared/student/StudentSidebar";
import { Company } from "../types";
import Avatar3D from "@/components/shared/Avatar3D";

type ExploreHudProps = {
  selectedCompany: Company | null;
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
};

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
}: ExploreHudProps) {
  const progressPct = Math.min((xpCurrent / xpMax) * 100, 100);

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
        <StudentSidebar items={navItems} onNavigate={onNavigate} onLogout={onLogout} style={{ height: "100%" }} />
      </div>

      {/* Search bar */}
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 28,
          width: 520,
          height: 46,
          borderRadius: 5,
          background: "rgba(255,255,255,0.72)",
          border: "2px solid rgba(0, 0, 0, 0.48)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 10,
          zIndex: 40,
        }}
      >
        <span style={{ opacity: 0.7 }}>🔎</span>
        <input
          placeholder="Search"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 14,
          }}
        />
      </div>

      {/* Toggle view button */}
      <button
        onClick={onToggleView}
        title="Toggle camera view"
        type="button"
        style={{
          position: "absolute",
          left: 150 + 520 + 12,
          top: 28 + 3,
          zIndex: 41,
          width: 40,
          height: 40,
          borderRadius: 5,
          background: "rgba(255,255,255,0.72)",
          border: "2px solid rgba(0, 0, 0, 0.48)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
          cursor: "pointer",
          fontSize: 16,
          fontWeight: 900,
          display: "grid",
          placeItems: "center",
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

      {/* Top-right HUD */}
      <div
        style={{
          position: "absolute",
          right: 28,
          top: 28,
          width: 360,
          height: 95,
          borderRadius: 4,
          background: "#D9D2C9",
          border: "2px solid rgba(0, 0, 0, 0.48)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
          display: "flex",
          alignItems: "center",
          padding: 16,
          gap: 18,
          zIndex: 40,
        }}
      >
        {/* Left content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name */}
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

          {/* Level + XP row */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
            {/* Level box */}
            <div
              style={{
                width: 84,
                height: 35,
                borderRadius: 4,
                background: "#CFAE83",
                border: "2px solid rgba(0, 0, 0, 0.48)",
                boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: 18,
                color: "#111",
              }}
            >
              {level}
            </div>

            {/* XP box */}
            <div
              style={{
                flex: 1,
                height: 35,
                borderRadius: 4,
                background: "#EEEAE4",
                border: "2px solid rgba(0, 0, 0, 0.48)",
                boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
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
                <div style={{ width: `${progressPct}%`, height: "100%", background: "rgba(0,0,0,0.45)" }} />
              </div>

              <div style={{ fontSize: 16, fontWeight: 700, color: "#111", whiteSpace: "nowrap" }}>
                {xpCurrent}/{xpMax} XP
              </div>
            </div>

            {/* Medal */}
            <div
              style={{
                position: "absolute",
                left: 62,
                top: -6,
                width: 45,
                height: 45,
                borderRadius: 999,
                background: "#F3C24E",
                border: "3px solid #fff",
                boxShadow: "0 10px 18px rgba(0,0,0,0.18)",
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.35)",
                  border: "2px solid rgba(0,0,0,0.15)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                }}
              >
                ★
              </div>
            </div>
          </div>
        </div>

        {/* Avatar circle */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 999,
            background: "#D9D2C9",
            border: "2px solid rgba(0, 0, 0, 0.48)",
            boxShadow: "0 18px 40px rgba(144, 112, 84, 0.35)",
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
              modelScale={1.80}
              modelPosition={[-2.4, -0.3, 1]}
              cameraPosition={[0, 0.95, 4.0]}
              cameraFov={56}
            />
          </div>
        </div>
      </div>

      {/* Focus avatar button */}
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
          <path d="M440-42v-80q-125-14-214.5-103.5T122-440H42v-80h80q14-125 103.5-214.5T440-838v-80h80v80q125 14 214.5 103.5T838-520h80v80h-80q-14 125-103.5 214.5T520-122v80h-80Zm238-240q82-82 82-198t-82-198q-82-82-198-82t-198 82q-82 82-82 198t82 198q82 82 198 82t198-82Zm-311-85q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm169.5-56.5Q560-447 560-480t-23.5-56.5Q513-560 480-560t-56.5 23.5Q400-513 400-480t23.5 56.5Q447-400 480-400t56.5-23.5ZM480-480Z" />
        </svg>
      </button>

      {/* Right panel */}
      {selectedCompany ? (
        <div
          style={{
            position: "absolute",
            right: 28,
            top: 160,
            width: 360,
            borderRadius: 5,
            background: "rgba(255,255,255,0.60)",
            border: "1px solid rgba(0,0,0,0.10)",
            boxShadow: "0 18px 44px rgba(0,0,0,0.16)",
            backdropFilter: "blur(12px)",
            padding: 16,
            zIndex: 55,
          }}
        >
          <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#1f1f1f" }}>
                {selectedCompany.name}
              </div>
              <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
                {selectedCompany.tagline ?? "—"}
              </div>
            </div>

            <button
              onClick={onCloseCompany}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                fontWeight: 900,
              }}
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: "6px 12px",
                borderRadius: 5,
                background: "rgba(236,72,153,0.16)",
                color: "#7a1f46",
                border: "1px solid rgba(236,72,153,0.20)",
              }}
            >
              Challenge
            </span>
            <span style={{ fontSize: 12, opacity: 0.75 }}>🌿 5+</span>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55, opacity: 0.85 }}>
            {selectedCompany.description ??
              "Learning never stops in a changing world. Each project teaches valuable lessons."}
          </div>

          <button
            style={{
              marginTop: 14,
              width: "100%",
              height: 44,
              borderRadius: 5,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(34,197,94,0.20)",
              cursor: "pointer",
              fontWeight: 900,
              color: "#175a2a",
            }}
            type="button"
            onClick={() => alert("get 20 XP")}
          >
            get 20 XP
          </button>
        </div>
      ) : null}
    </>
  );
}
