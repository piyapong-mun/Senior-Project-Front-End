"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

const NAV_ITEMS = [
  { label: "About", href: "/about", enabled: false },
  { label: "Contact", href: "/contact", enabled: false },
  { label: "Log in", href: "/auth/sign-in" },
  { label: "Register", href: "/auth/register", active: true },
];

const OTP_LEN = 6;
const OTP_TTL_SEC = 24 * 60 * 60; // ✅ 24 hours
const RESEND_COOLDOWN_SEC = 30;

function keyFor(email: string) {
  return `vcep:otp_sent_at:${email.trim().toLowerCase()}`;
}

export default function ConfirmEmailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);

  const [msg, setMsg] = useState<string | null>(null);

  // ✅ countdown
  const [secondsLeft, setSecondsLeft] = useState<number>(OTP_TTL_SEC);
  const isExpired = secondsLeft <= 0;

  // ✅ resend cooldown
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // init sentAt from localStorage (or set now if not found)
  useEffect(() => {
  if (!email) return;

  const k = keyFor(email);
  const raw = localStorage.getItem(k);
  let sentAtMs = raw ? Number(raw) : NaN;

  // ✅ ถ้าไม่มี key หรือ key เก่าจนหมด TTL แล้ว → reset เป็น now
  const isStale =
    !Number.isFinite(sentAtMs) ||
    sentAtMs <= 0 ||
    Date.now() - sentAtMs > OTP_TTL_SEC * 1000; // expired แล้ว

  if (isStale) {
    sentAtMs = Date.now();
    localStorage.setItem(k, String(sentAtMs));
  }

  const update = () => {
    const left = Math.max(
      0,
      Math.ceil((sentAtMs + OTP_TTL_SEC * 1000 - Date.now()) / 1000)
    );
    setSecondsLeft(left);
  };

  update();
  const t = setInterval(update, 1000);
  return () => clearInterval(t);
}, [email]);

  // ✅ cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const timeText = useMemo(() => {
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    // 24h format: H:MM:SS
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [secondsLeft]);

  const resetOtp = () => {
    setDigits(Array(OTP_LEN).fill(""));
    inputsRef.current[0]?.focus();
  };

  const setAt = (idx: number, val: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleChange = (idx: number, raw: string) => {
    setIsError(false);
    setMsg(null);

    const only = raw.replace(/\D/g, "");
    if (!only) {
      setAt(idx, "");
      return;
    }

    const chars = only.slice(0, OTP_LEN - idx).split("");
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, i) => (next[idx + i] = c));
      return next;
    });

    const nextIndex = Math.min(idx + chars.length, OTP_LEN - 1);
    inputsRef.current[nextIndex]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[idx]) setAt(idx, "");
      else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
        setAt(idx - 1, "");
      }
    }
    if (e.key === "ArrowLeft" && idx > 0) inputsRef.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < OTP_LEN - 1) inputsRef.current[idx + 1]?.focus();
  };

  const onConfirm = async () => {
    if (!email || loading) return;

    if (isExpired) {
      setIsError(true);
      setMsg("Code expired. Please send again.");
      resetOtp();
      return;
    }

    if (code.length !== OTP_LEN) return;

    setLoading(true);
    setIsError(false);
    setMsg(null);

    try {
      const r = await fetch("/api/auth/confirm-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setIsError(true);

        if (data?.code === "EXPIRED_CODE") {
          setMsg("Code expired. Please send again.");
        } else if (data?.code === "CODE_MISMATCH") {
          setMsg("Invalid code. Please try again.");
        } else if (data?.code === "BACKEND_FIND_USER_FAILED") {
          setMsg(data?.detail || "Backend could not find this user.");
        } else if (data?.code === "BACKEND_CONFIRM_UPDATE_FAILED") {
          setMsg(data?.detail || "Backend could not update this user.");
        } else {
          setMsg(data?.message || "Confirm failed.");
        }

        resetOtp();
        return;
      }

      const role = data?.role as "student" | "employee" | undefined;

      const next =
        role === "employee"
          ? "/auth/fill-more-info/organization"
          : "/auth/fill-more-info/student";

      router.push(
        `/auth/sign-in?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`
      );
    } catch {
      setIsError(true);
      setMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (!email || loading || cooldown > 0) return;

    setLoading(true);
    setIsError(false);
    setMsg(null);

    try {
      const r = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json().catch(() => ({}));

      resetOtp();

      if (!r.ok || !data?.ok) {
        setIsError(true);
        setMsg(data?.message || "Failed to send code. Please try again.");
        return;
      }

      // ✅ reset sentAt => countdown restarts for 24h
      localStorage.setItem(keyFor(email), String(Date.now()));
      setSecondsLeft(OTP_TTL_SEC);

      setMsg("New code sent. Please check your email.");
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch {
      setIsError(true);
      setMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDisabled = loading || code.length !== OTP_LEN || isExpired;
  const resendDisabled = loading || cooldown > 0;

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

        <section className={styles.card} aria-label="Confirm email">
          <h1 className={styles.title}>Confirm email</h1>

          <div className={styles.otpRow} aria-label="6-digit code">
            {Array.from({ length: OTP_LEN }).map((_, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                className={`${styles.otpBox} ${isError ? styles.otpBoxError : ""}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={digits[i]}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          <p className={styles.note}>
            Confirm the 6-digit code from email{email ? ` (${email})` : ""}{" "}
            <span style={{ fontWeight: 600, marginLeft: 6, color: isExpired ? "crimson" : "inherit" }}>
              {isExpired ? "• Code expired" : `• Expires in ${timeText}`}
            </span>
          </p>

          {msg && (
            <p className={styles.note} style={{ color: isError ? "crimson" : "inherit", marginTop: 6 }}>
              {msg}
            </p>
          )}

          <div className={styles.actions}>
            <button className={styles.btn} type="button" onClick={onConfirm} disabled={confirmDisabled}>
              {loading ? "Confirming..." : "Confirm"}
            </button>

            <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={onResend} disabled={resendDisabled}>
              {cooldown > 0 ? `Send again (${cooldown}s)` : "Send again"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}