import StudentSidebar from "@/components/shared/student/StudentSidebar";
import { STUDENT_SIDEBAR_ITEMS } from "@/lib/config/student/routes";
import AllActivities from "./overview";

export default function StudentActiviesDashboardPage() {
  return (
      <div style={{ background: "#F3EEE8", minHeight: "100vh", padding: 18, boxSizing: "border-box" }}>
        <div
          style={{
            height: "calc(100vh - 36px)",
            display: "grid",
            gridTemplateColumns: "96px 1fr",
            gap: 24,
          }}
        >
          <div style={{ position: "sticky", top: 18, height: "calc(100vh - 36px)" }}>
            <StudentSidebar items={STUDENT_SIDEBAR_ITEMS} style={{ height: "100%" }} />
          </div>
  
          <main
            style={{
              height: "calc(100vh - 36px)",
              overflow: "auto",
              background: "#FFFFFF",
              borderRadius: 10,
              padding: 24,
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 1380 }}>
              <AllActivities />
            </div>
          </main>
  
        </div>
      </div>
    );
}
