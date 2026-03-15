import StudentSidebar from "@/components/shared/student/StudentSidebar";
import { STUDENT_SIDEBAR_ITEMS } from "@/lib/config/student/routes";

export default function StudentOnboardingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3eee8",
        padding: 28,
        display: "grid",
        gridTemplateColumns: "96px 1fr",
        gap: 24,
      }}
    >
      <StudentSidebar items={STUDENT_SIDEBAR_ITEMS} style={{ height: "calc(100vh - 80px)" }} />
      <main
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e0d6cd",
          padding: 24,
          boxShadow: "0 16px 26px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>Onboarding</h1>
        <p style={{ marginTop: 8, color: "#5a5149" }}>
          This page is ready for onboarding steps, checklists, and progress tracking.
        </p>
      </main>
    </div>
  );
}
