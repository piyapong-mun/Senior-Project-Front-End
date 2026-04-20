/**
 * apps/web/src/app/api/organization/activity/course/route.ts
 *
 * POST /api/organization/activity/course → สร้าง Meeting Activity
 * Injects created_by (emp_id) + creator_org_id (org_id) จาก session ก่อนส่งต่อ backend
 */

import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { Pool } from "pg";
import fs from "fs";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL!;
const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";

declare global {
  // eslint-disable-next-line no-var
  var __vcepActivityCoursePool: Pool | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(name + "="));
  if (!found) return null;
  const v = found.slice(name.length + 1);
  try { return decodeURIComponent(v); } catch { return v; }
}

function getSessionTokens(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  const raw = readCookie(cookieHeader, COOKIE_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { idToken?: string; accessToken?: string };
      if (parsed?.idToken) return parsed;
    } catch {}
  }
  const idToken = readCookie(cookieHeader, "vcep_id");
  const accessToken = readCookie(cookieHeader, "vcep_access");
  if (!idToken) return null;
  return { idToken, accessToken: accessToken || "" };
}

function stripPgSslParams(cs: string) {
  try {
    const url = new URL(cs);
    ["sslmode", "sslcert", "sslkey", "sslrootcert"].forEach((k) => url.searchParams.delete(k));
    return url.toString();
  } catch { return cs; }
}

function getPool() {
  if (global.__vcepActivityCoursePool) return global.__vcepActivityCoursePool;
  const ssl = PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
    ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
    : { rejectUnauthorized: false };
  global.__vcepActivityCoursePool = new Pool({ connectionString: stripPgSslParams(DATABASE_URL), ssl });
  return global.__vcepActivityCoursePool;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_REGEX.test(v);

// ─── Resolve employee context from session ────────────────────────────────────

async function resolveEmployeeContext(req: NextRequest) {
  const sess = getSessionTokens(req);
  if (!sess?.idToken) throw new Error("Unauthorized");

  const payload = decodeJwt(sess.idToken);
  const cognitoUserId = String(payload.sub || "");
  const emailFromToken = String(payload.email || "").toLowerCase();
  const orgIdFromToken = String(payload["custom:orgId"] || "");
  const accessToken = (sess as any).accessToken || "";

  if (!cognitoUserId) throw new Error("Invalid token");

  const pool = getPool();

  // 1. Resolve user
  const userRes = await pool.query(
    `SELECT user_id, email, role FROM users
     WHERE cognito_user_id = $1 OR lower(email) = lower($2)
     ORDER BY CASE WHEN cognito_user_id = $1 THEN 0 ELSE 1 END LIMIT 1`,
    [cognitoUserId, emailFromToken]
  );
  const user = userRes.rows[0];
  if (!user?.user_id) throw new Error("User not found");

  // 2. Resolve employee
  const empRes = await pool.query(
    `SELECT emp_id, org_id FROM employees WHERE user_id = $1 LIMIT 1`,
    [user.user_id]
  );
  const emp = empRes.rows[0] || null;

  const orgId = (() => {
    const fromEmp = String(emp?.org_id || "").trim();
    if (fromEmp && isUuid(fromEmp)) return fromEmp;
    const fromToken = String(orgIdFromToken || "").trim();
    if (fromToken && isUuid(fromToken)) return fromToken;
    return "";
  })();

  const empId = emp?.emp_id ? String(emp.emp_id) : "";

  return { userId: String(user.user_id), empId, orgId, accessToken };
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveEmployeeContext(req);

    if (!ctx.orgId) {
      return NextResponse.json(
        { ok: false, message: "Organization not found for this employee" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Inject required fields from server-side context
    // These fields must come from the authenticated session, not the client
    const payload = {
      ...body,
      created_by: ctx.empId || ctx.userId,
      creator_org_id: ctx.orgId,
    };

    const backendRes = await fetch(`${BACKEND_URL}/activity/course`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.accessToken ? { Authorization: `Bearer ${ctx.accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      const message =
        typeof data?.detail === "string"
          ? data.detail
          : Array.isArray(data?.detail)
            ? data.detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ")
            : data?.message || `Backend error ${backendRes.status}`;

      return NextResponse.json({ ok: false, message }, { status: backendRes.status });
    }

    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (error: any) {
    const message = error?.message || "Internal server error";
    const status =
      message === "Unauthorized" || message === "Invalid token" ? 401
      : message === "User not found" ? 404
      : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
