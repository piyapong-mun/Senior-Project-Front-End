"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import styles from "./page.module.css";
import { Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";

const NAV_ITEMS = [
  { label: "About", href: "/about", enabled: false },
  { label: "Contact", href: "/contact", enabled: false },
  { label: "Log in", href: "/auth/sign-in", active: true },
  { label: "Register", href: "/auth/register" },
];

const pwRules = {
  min8: (s: string) => s.length >= 8,
  upper: (s: string) => /[A-Z]/.test(s),
  lower: (s: string) => /[a-z]/.test(s),
  number: (s: string) => /[0-9]/.test(s),
  symbol: (s: string) => /[^A-Za-z0-9]/.test(s),
};

function getPwCheck(pw: string) {
  const p = pw ?? "";
  return {
    min8: pwRules.min8(p),
    upper: pwRules.upper(p),
    lower: pwRules.lower(p),
    number: pwRules.number(p),
    symbol: pwRules.symbol(p),
    ok: pwRules.min8(p) && pwRules.upper(p) && pwRules.lower(p) && pwRules.number(p) && pwRules.symbol(p),
  };
}

const OTP_LEN = 6;

type Mode = "login" | "forgot" | "reset" | "newpw";


export default function SignInPage() {
  const params = useSearchParams();
  const nextParam = params.get("next");
  const emailParam = params.get("email");


  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const em = useMemo(() => email.trim().toLowerCase(), [email]);

  
  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  // login
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // reset
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [needConfirm, setNeedConfirm] = useState(false);

  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const [showPwRules, setShowPwRules] = useState(false);
  const pwCheck = useMemo(() => getPwCheck(password), [password]);
  const hasTypedPw = password.length > 0;

  const newPwCheck = useMemo(() => getPwCheck(newPassword), [newPassword]);
  const hasTypedNewPw = newPassword.length > 0;

  const [newPwSession, setNewPwSession] = useState<string>("");

  const goLogin = () => {
    setMode("login");
    setError(null);
    setInfo(null);
  };

  const goForgot = () => {
    setMode("forgot");
    setError(null);
    setInfo(null);
    setNeedConfirm(false);
  };

  const goReset = () => {
    setMode("reset");
    setError(null);
    setInfo(null);
    setNeedConfirm(false);
    setTimeout(() => otpInputRef.current?.focus(), 0);
  };

  const submitLogin = async () => {
    setError(null);
    setInfo(null);
    setNeedConfirm(false);

    const pw = password.trim();
    if (!em || !pw) return;

    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw }),
      });

      const data = await r.json().catch(() => ({}));

      //  Cognito invited user: ต้องตั้งรหัสผ่านใหม่ก่อน
      if (data?.challenge === "NEW_PASSWORD_REQUIRED") {
        setInfo("Please set a new password to activate your account.");
        setNewPassword("");        // เคลียร์ค่าเก่า
        setShowNewPw(false);
        setNewPwSession(data?.session || "");
        setMode("newpw");
        return;
      }

      if (!r.ok) {
        if (data?.code === "USER_NOT_CONFIRMED") {
          setNeedConfirm(true);
          setError("Your email is not confirmed yet. Please confirm your email to continue.");
        } else if (data?.code === "INVALID_CREDENTIALS") {
          setError("Email or password is incorrect");
        } else {
          setError(data?.message || "Login failed");
        }
        return;
      }

      const role = data?.role || "student";

      // ถ้ามี next จาก confirm-email ให้ไปตามนั้นก่อน
      if (nextParam) {
        router.push(nextParam);
        return;
      }

      //  ไม่มี next = login ปกติ → ตรวจโปรไฟล์ว่าครบยัง
      try {
        if (role === "employee") {
          // ✅ เช็ค org_id จาก active-account
          // ถ้ามี org_id แล้ว → ไป organization/explore ได้เลย
          // ถ้ายังไม่มี → ไป fill-more-info/organization
          const meRes = await fetch("/api/organization/active-account", { cache: "no-store" });
          const me = await meRes.json().catch(() => null);
          const hasOrg = !!me?.orgId;
          router.push(hasOrg ? "/organization/explore" : "/auth/fill-more-info/organization");
        } else {
          const meRes = await fetch("/api/student/active-account", { cache: "no-store" });
          const me = await meRes.json().catch(() => null);
          const done = !!me?.is_profile_complete;
          router.push(done ? "/student/explore" : "/auth/fill-more-info/student");
        }
      } catch {
        // fallback
        router.push(role === "employee" ? "/organization/explore" : "/student/explore");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async () => {
    setError(null);
    setInfo(null);
    if (!em) return;

    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const data = await r.json().catch(() => ({}));

      // เพื่อความปลอดภัย บางกรณี backend อาจตอบ ok แม้ user ไม่อยู่ (intentional)
      if (!r.ok || !data?.ok) {
        setError(data?.message || "Failed to send reset code");
        return;
      }

      setInfo("We sent a reset code to your email. Please enter the code and set a new password.");
      goReset();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async () => {
    setError(null);
    setInfo(null);

    const code = otp.replace(/\D/g, "").slice(0, OTP_LEN);
    const pw = newPassword;

    if (!em || code.length !== OTP_LEN || !pw) return;

    if (!newPwCheck.ok) {
      setShowPwRules(true);
      setError("Password does not meet requirements.");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/auth/confirm-forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, code, newPassword: pw }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data?.ok) {
        if (data?.code === "EXPIRED_CODE") setError("Code expired. Please send again.");
        else if (data?.code === "CODE_MISMATCH") setError("Invalid code. Please try again.");
        else if (data?.code === "INVALID_PASSWORD") setError("Password does not meet requirements.");
        else setError(data?.message || "Reset password failed");
        return;
      }

      setInfo("Password updated. Please log in with your new password.");
      setPassword("");
      setOtp("");
      setNewPassword("");
      goLogin();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const resendResetCode = async () => {
    // ใช้ forgot-password ซ้ำเพื่อ resend OTP reset
    await submitForgot();
  };

  const goNewPw = (session?: string) => {
    setMode("newpw");
    setError(null);
    setInfo(null);
    setNeedConfirm(false);
    setNewPwSession(session ?? "");
    setTimeout(() => otpInputRef.current?.focus(), 0); // จะโฟกัส input แรกที่ ref ชี้ (ถ้าอยาก)
  };

  const submitNewPw = async () => {
    setError(null);
    setInfo(null);

    const pw = newPassword;
    if (!em || !pw || !newPwSession) return;

    if (!newPwCheck.ok) {
      setShowPwRules(true);
      setError("Password does not meet requirements.");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/auth/new-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, newPassword: pw, session: newPwSession }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data?.ok) {
        setError(data?.message || "Failed to set new password");
        return;
      }

      //  สำเร็จแล้ว backend จะ set cookie ให้เหมือน login
      const role = data?.role || "employee";
      router.push(role === "employee" ? "/organization/explore" : "/student/explore");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Link href="/" className={styles.logoWrap} aria-label="Home">
          <img src="/images/logo/logo-v1-no_bg.png" alt="VCEP" className={styles.logo} draggable={false} />
        </Link>

        <nav className={styles.navBar} aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const isDisabled = item.enabled === false;
            const cls = `${styles.navItem} ${item.active ? styles.navItemActive : ""} ${isDisabled ? styles.navItemDisabled : ""
              }`;

            if (isDisabled) {
              return (
                <span key={item.label} className={cls} aria-disabled="true" title="Coming soon">
                  {item.label}
                </span>
              );
            }

            return (
              <Link key={item.label} href={item.href} className={cls} aria-current={item.active ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className={styles.main}>
        <section className={styles.left} aria-hidden>
          <img className={styles.city} src="/images/building/small_map.png" alt="" draggable={false} />
        </section>

        <section className={styles.card} aria-label="Log in with email">
          <h1 className={styles.title}>
            {mode === "login" ? "Log in" : mode === "forgot" ? "Forgot password" : "Reset password"}
          </h1>

          {/* EMAIL (ใช้ร่วมกันทุก mode) */}
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            disabled={loading && mode !== "login"} // กันแก้ email ตอนกำลังส่งโค้ด
          />

          {/* LOGIN MODE */}
          {mode === "login" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await submitLogin();
              }}
            >
              <div className={styles.passwordRow}>
                <input
                  className={styles.input}
                  type={showPw ? "text" : "password"}
                  value={password}
                  placeholder="Password"
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setShowPwRules(true)}
                />
                <button
                  type="button"
                  className={styles.showPwBtn}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <div className={styles.note} style={{ color: "crimson", marginTop: 10 }}>
                  <p style={{ margin: 0 }}>{error}</p>
                </div>
              )}

              {info && (
                <div className={styles.note} style={{ marginTop: 10 }}>
                  <p style={{ margin: 0 }}>{info}</p>
                </div>
              )}

              {/* forgot password link */}
              <div className={styles.linkRow}>
                <button
                  type="button"
                  onClick={goForgot}
                  className={styles.confirmEmailLink}
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                >
                  Forgot password?
                </button>

                {needConfirm && (
                  <Link
                    href={`/auth/confirm-email?email=${encodeURIComponent(em)}`}
                    className={styles.confirmEmailLink}
                  >
                    Confirm email
                  </Link>
                )}
              </div>



              <button className={styles.confirm} type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Log in"}
              </button>
            </form>
          )}

          {/* FORGOT MODE (ส่งโค้ด) */}
          {mode === "forgot" && (
            <div>
              <p className={styles.note}>Enter your email and we’ll send a reset code.</p>

              {error && (
                <div className={styles.note} style={{ color: "crimson" }}>
                  <p style={{ margin: 0 }}>{error}</p>
                </div>
              )}
              {info && (
                <div className={styles.note}>
                  <p style={{ margin: 0 }}>{info}</p>
                </div>
              )}

              <div className={styles.actionRow}>
                <button className={styles.confirm} type="button" onClick={submitForgot} disabled={loading || !em}>
                  {loading ? "Sending..." : "Send code"}
                </button>

                <button className={styles.confirmSecondary} type="button" onClick={goLogin} disabled={loading}>
                  Back to login
                </button>
              </div>
            </div>
          )}

          {/* RESET MODE (กรอก OTP + รหัสใหม่) */}
          {mode === "reset" && (
            <div>
              <p className={styles.note}>Enter the 6-digit code and your new password.</p>

              <input
                ref={otpInputRef}
                className={styles.input}
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LEN))}
                placeholder="6-digit code"
              />

              <div className={styles.passwordRow}>
                <input
                  className={styles.input}
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  placeholder="New password"
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setShowPwRules(true)}
                />
                <button
                  type="button"
                  className={styles.showPwBtn}
                  onClick={() => setShowNewPw((v) => !v)}
                  aria-label={showNewPw ? "Hide password" : "Show password"}
                >
                  {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {showPwRules && (
                <div className={styles.note} style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Password requirements:</div>

                  <div style={{ color: newPwCheck.min8 && hasTypedNewPw ? "green" : "rgba(0,0,0,0.62)" }}>
                    • At least 8 characters
                  </div>
                  <div style={{ color: newPwCheck.upper && hasTypedNewPw ? "green" : "rgba(0,0,0,0.62)" }}>
                    • 1 uppercase (A–Z)
                  </div>
                  <div style={{ color: newPwCheck.lower && hasTypedNewPw ? "green" : "rgba(0,0,0,0.62)" }}>
                    • 1 lowercase (a–z)
                  </div>
                  <div style={{ color: newPwCheck.number && hasTypedNewPw ? "green" : "rgba(0,0,0,0.62)" }}>
                    • 1 number (0–9)
                  </div>
                  <div style={{ color: newPwCheck.symbol && hasTypedNewPw ? "green" : "rgba(0,0,0,0.62)" }}>
                    • 1 symbol (!@#$…)
                  </div>
                </div>
              )}

              {error && (
                <p className={styles.errorNote}>{error}</p>
              )}
              {info && (
                <div className={styles.note}>
                  <p style={{ margin: 0 }}>{info}</p>
                </div>
              )}

              <div className={styles.actionRow}>
                <button
                  className={styles.confirm}
                  type="button"
                  onClick={submitReset}
                  disabled={loading || !em || otp.length !== OTP_LEN || !newPwCheck.ok}
                >
                  {loading ? "Updating..." : "Update password"}
                </button>

                <button
                  className={styles.confirmSecondary}
                  type="button"
                  onClick={resendResetCode}
                  disabled={loading || !em}
                >
                  Send code again
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={goLogin}
                  className={styles.confirmEmailLink}
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                >
                  Back to login
                </button>
              </div>
            </div>
          )}

          {mode === "newpw" && (
            <>
              <h1 className={styles.title}>Set new password</h1>
              <p className={styles.note}>
                This is your first login. Please set a new password to activate your account.
              </p>

              <input className={styles.input} value={em} disabled />

              <div className={styles.passwordRow}>
                <input
                  className={styles.input}
                  type={showNewPw ? "text" : "password"}
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setShowPwRules(true)}
                />
                <button
                  type="button"
                  className={styles.showPwBtn}
                  onClick={() => setShowNewPw((s) => !s)}
                  aria-label="Toggle password"
                >
                  {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* ใช้ pw rules box เดิมของคุณได้เลย ถ้าคุณมี JSX แสดง rules อยู่แล้ว */}

              <div className={styles.actionsRow}>
                <button className={styles.confirm} type="button" onClick={submitNewPw} disabled={loading}>
                  Update password
                </button>
                <button className={styles.confirm} type="button" onClick={goLogin} disabled={loading}>
                  Back to login
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}