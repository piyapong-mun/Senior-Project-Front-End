"use client";

import { useMemo, useState,useEffect, type ChangeEvent } from "react";
import StudentSidebar from "@/components/shared/student/StudentSidebar";
import { STUDENT_SIDEBAR_ITEMS } from "@/lib/config/student/routes";
import styles from "./page.module.css";

type Employee = {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    phone: string;
    email: string;
    canCheckChallenge: boolean;
    avatarIndex: number; // 0..n
};

const AVATARS = [
    "/images/avatar%20picture/avatar1.png",
    "/images/avatar%20picture/avatar2.png",
    "/images/avatar%20picture/avatar3.png",
];

const emptyEmp = (id: string): Employee => ({
    id,
    firstName: "",
    lastName: "",
    position: "",
    phone: "",
    email: "",
    canCheckChallenge: false,
    avatarIndex: 0,
});

export default function OrgDashboardPage() {
    // ====== mock data (เดี๋ยวค่อยเปลี่ยนเป็น fetch จาก API) ======
    const [employees, setEmployees] = useState<Employee[]>([
  {
    id: "e1",
    firstName: "Sophia",
    lastName: "Brown",
    position: "HR",
    phone: "0812345678",
    email: "sophia@company.com",
    canCheckChallenge: true,
    avatarIndex: 0,
  },
]);


    // ====== modal add employee ======
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState<Employee>(() => emptyEmp("draft"));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>("");

    const setDraftField =
        (k: keyof Employee) =>
            (e: ChangeEvent<HTMLInputElement>) => {
                const v =
                    e.target.type === "checkbox"
                        ? (e.target as HTMLInputElement).checked
                        : e.target.value;

                setDraft((prev) => ({ ...prev, [k]: v } as Employee));
            };

    const setDraftAvatar = (i: number) => setDraft((p) => ({ ...p, avatarIndex: i }));

    const openAdd = () => {
        setError("");
        setDraft(emptyEmp("draft"));
        setIsOpen(true);
    };

    const closeAdd = () => {
        if (saving) return;
        setIsOpen(false);
    };

    const submitAdd = async () => {
  setError("");

  if (!draft.firstName.trim() || !draft.lastName.trim()) {
    setError("Please fill first name and last name.");
    return;
  }
  if (!draft.email.trim()) {
    setError("Please fill email.");
    return;
  }

  setSaving(true);
  try {
    const r = await fetch("/api/org/employees/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: draft.email.trim().toLowerCase(),
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        position: draft.position.trim(),
        phone: draft.phone.trim(),
        canCheckChallenge: draft.canCheckChallenge,
        avatarIndex: draft.avatarIndex,
        employeeSlot: employees.length + 1, // 2 หรือ 3
      }),
    });

    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.ok) {
      setError(d?.message || "Invite failed");
      return;
    }

    // ✅ อัปเดต UI (ชั่วคราว) — จริง ๆ ควร refetch จาก DB เมื่อ DB พร้อม
    const newEmp: Employee = {
      ...draft,
      id: d?.empId || `e${Date.now()}`, // ถ้า API คืน id ก็ใช้
      email: draft.email.trim().toLowerCase(),
    };

    setEmployees((prev) => [...prev, newEmp]);
    setIsOpen(false);
  } catch (e: any) {
    setError(e?.message || "Failed to add employee");
  } finally {
    setSaving(false);
  }
};

    const MAX_EMP = 3;
    const shownEmployees = employees.slice(0, MAX_EMP);
    const canAddMore = shownEmployees.length < MAX_EMP;

    const [activeEmployeeEmail, setActiveEmployeeEmail] = useState<string>("");

    useEffect(() => {
        (async () => {
            const r = await fetch("/api/org/active-account");
            const d = await r.json().catch(() => ({}));
            if (r.ok && d?.ok) setActiveEmployeeEmail(String(d.email || "").toLowerCase());
        })();
    }, []);



    return (
        <div className={styles.page}>
            {/* เมนูซ้าย: ตามที่บอก ไม่แก้ */}
            <StudentSidebar items={STUDENT_SIDEBAR_ITEMS} style={{ height: "100%" }} />

            <main className={styles.main}>
                {/* ===== Row 1: Org profile + summary cards + avatar box ===== */}
                <section className={styles.topGrid}>
                    {/* Org profile card */}
                    <div className={styles.orgCard}>
                        <div className={styles.orgLogoCircle} aria-hidden="true" />
                        <div className={styles.orgInfo}>
                            <div className={styles.orgNameRow}>
                                <h1 className={styles.orgName}>PeakSystems</h1>
                                <button className={styles.editBtn} type="button" aria-label="Edit organization">
                                    ✎
                                </button>
                            </div>

                            <p className={styles.orgDesc}>
                                Quality work requires attention to detail. The best solutions come from collaboration.
                            </p>

                            <div className={styles.orgMeta}>
                                <div>Phone: (746) 807-2977</div>
                                <div>Email: emma.davis@hotmail.com</div>
                                <div>Address: 6717 Park Road, Philadelphia, PA 97076</div>
                            </div>
                        </div>
                    </div>

                    {/* Summary cards */}
                    <div className={styles.summaryCard}>
                        <div className={styles.bigNum}>15</div>
                        <div className={styles.smallLabel}>Total Activities</div>
                        <div className={styles.miniRow}>
                            <span>challenges 3</span>
                            <span>courses 8</span>
                            <span>meetings 4</span>
                        </div>
                        <div className={styles.hr} />
                        <div className={styles.bigNum}>32</div>
                        <div className={styles.smallLabel}>Total Participants</div>
                    </div>

                    {/* Avatar box (ตาม Figma) */}
                    <div className={styles.avatarBox}>
                        <div className={styles.buildingWrap}>
                            <img
                                className={styles.buildingImg}
                                src="/images/buildings/building1.png"
                                alt="Organization building"
                                onError={(e) => {
                                    // กันกรณีไม่มีไฟล์รูปในโปรเจกต์: จะไม่พัง layout
                                    (e.currentTarget as HTMLImageElement).style.opacity = "0";
                                }}
                            />
                        </div>

                        <div className={styles.avatarRow}>
                            {shownEmployees.map((emp) => {
                                const isActive = emp.email === activeEmployeeEmail; // หรือเทียบ id/sub ก็ได้
                                return (
                                    <button
                                        key={emp.id}
                                        type="button"
                                        className={styles.avatarTile}
                                        onClick={() => {
                                            // ✅ เฉพาะ demo (ถ้าไม่อยากให้กดสลับ active เอง ให้ลบบรรทัดนี้ทิ้ง)
                                            // setActiveEmployeeEmail(emp.email);
                                        }}
                                        aria-label={`${emp.firstName} ${emp.lastName}`}
                                        title={`${emp.firstName} ${emp.lastName}`}
                                    >
                                        <img
                                            src={AVATARS[emp.avatarIndex] || AVATARS[0]}
                                            alt={`${emp.firstName} avatar`}
                                            className={`${styles.avatarThumb} ${isActive ? styles.avatarThumbActive : ""}`}
                                        />
                                        <div className={styles.avatarName}>
                                            {emp.firstName} {emp.lastName}
                                        </div>
                                    </button>
                                );
                            })}

                            {/* ✅ ปุ่ม + แสดงเมื่อยังไม่ครบ 3 คน */}
                            {canAddMore && (
                                <button type="button" className={styles.addEmpBtn} onClick={openAdd} aria-label="Add employee">
                                    +
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* ===== Row 2: big chart area + right list (เอาไว้ใส่จริงทีหลัง) ===== */}
                <section className={styles.midGrid}>
                    <div className={styles.bigPanel}>
                        <div className={styles.tabRow}>
                            <button className={styles.tabBtn}>All activity statistics</button>
                            <button className={`${styles.tabBtn} ${styles.tabBtnOn}`}>
                                Statistics of participants
                            </button>
                            <button className={styles.tabBtn}>skill statistics</button>
                        </div>

                        <div className={styles.fakeChart} aria-label="Chart placeholder">
                            <div className={styles.bar} style={{ height: 120 }} />
                            <div className={styles.bar} style={{ height: 190 }} />
                            <div className={styles.bar} style={{ height: 140 }} />
                            <div className={styles.bar} style={{ height: 90 }} />
                            <div className={styles.bar} style={{ height: 130 }} />
                            <div className={styles.bar} style={{ height: 170 }} />
                            <div className={styles.bar} style={{ height: 150 }} />
                        </div>
                    </div>

                    <div className={styles.rightPanel}>
                        <h3 className={styles.rightTitle}>Participants</h3>

                        <div className={styles.personRow}>
                            <div className={styles.personAvatar} />
                            <div className={styles.personText}>
                                <div className={styles.personName}>Charlotte Garcia</div>
                                <div className={styles.personSub}>Dedicated professional in marketing...</div>
                            </div>
                            <div className={styles.personScore}>45</div>
                        </div>

                        <div className={styles.personRow}>
                            <div className={styles.personAvatar} />
                            <div className={styles.personText}>
                                <div className={styles.personName}>Emma Williams</div>
                                <div className={styles.personSub}>Creative direction focused...</div>
                            </div>
                            <div className={styles.personScore}>45</div>
                        </div>

                        <div className={styles.personRow}>
                            <div className={styles.personAvatar} />
                            <div className={styles.personText}>
                                <div className={styles.personName}>James Taylor</div>
                                <div className={styles.personSub}>Building impactful solutions...</div>
                            </div>
                            <div className={styles.personScore}>43</div>
                        </div>
                    </div>
                </section>

                {/* ===== Modal: Add employee ===== */}
                {isOpen && (
                    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                        <div className={styles.modal}>
                            <div className={styles.modalHeader}>
                                <h2 className={styles.modalTitle}>Add employee</h2>
                                <button className={styles.modalClose} type="button" onClick={closeAdd} aria-label="Close">
                                    ✕
                                </button>
                            </div>

                            <div className={styles.modalBody}>
                                <div className={styles.grid2}>
                                    <input
                                        className={styles.input}
                                        placeholder="First name"
                                        value={draft.firstName}
                                        onChange={setDraftField("firstName")}
                                    />
                                    <input
                                        className={styles.input}
                                        placeholder="Last name"
                                        value={draft.lastName}
                                        onChange={setDraftField("lastName")}
                                    />
                                </div>

                                <div className={styles.grid2}>
                                    <input
                                        className={styles.input}
                                        placeholder="Position"
                                        value={draft.position}
                                        onChange={setDraftField("position")}
                                    />
                                    <input
                                        className={styles.input}
                                        placeholder="Phone number"
                                        value={draft.phone}
                                        onChange={setDraftField("phone")}
                                    />
                                </div>

                                <input
                                    className={styles.input}
                                    placeholder="Email"
                                    value={draft.email}
                                    onChange={setDraftField("email")}
                                />

                                <div className={styles.hr} />

                                <label className={styles.checkRow}>
                                    <input
                                        className={styles.checkInput}
                                        type="checkbox"
                                        checked={draft.canCheckChallenge}
                                        onChange={setDraftField("canCheckChallenge")}
                                    />
                                    <span className={styles.checkText}>Can check challenge activities</span>
                                </label>

                                <div className={styles.avatarPickTitle}>Avatar</div>
                                <div className={styles.avatarPickRow}>
                                    {AVATARS.map((src, i) => {
                                        const on = draft.avatarIndex === i;
                                        return (
                                            <button
                                                key={src}
                                                type="button"
                                                className={`${styles.avatarPickBtn} ${on ? styles.avatarPickBtnOn : ""}`}
                                                onClick={() => setDraftAvatar(i)}
                                                aria-label={`Select avatar ${i + 1}`}
                                            >
                                                <img src={src} alt={`avatar ${i + 1}`} className={styles.avatarPickImg} />
                                            </button>
                                        );
                                    })}
                                </div>

                                {error && <div className={styles.errorText}>{error}</div>}
                            </div>

                            <div className={styles.modalFooter}>
                                <button className={styles.secondaryBtn} type="button" onClick={closeAdd} disabled={saving}>
                                    Cancel
                                </button>
                                <button className={styles.primaryBtn} type="button" onClick={submitAdd} disabled={saving}>
                                    {saving ? "Saving..." : "Send invite"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}