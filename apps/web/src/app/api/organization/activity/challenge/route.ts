/**
 * apps/web/src/app/api/organization/activity/challenge/route.ts
 *
 * POST /api/organization/activity/challenge
 */

import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { Pool } from "pg";
import fs from "fs";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL || "https://vcep-platform.duckdns.org";
const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";

declare global {
  // eslint-disable-next-line no-var
  var __vcepChallengePool: Pool | undefined;
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(name + "="));
  if (!found) return null;
  const v = found.slice(name.length + 1);
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
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
  } catch {
    return cs;
  }
}

function getPool() {
  if (global.__vcepChallengePool) return global.__vcepChallengePool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };

  global.__vcepChallengePool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  return global.__vcepChallengePool;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeDt(v: unknown) {
  return typeof v === "string" && v.trim() !== "" ? v : "2022-01-01T00:00:00Z";
}

async function resolveContext(req: NextRequest) {
  const sess = getSessionTokens(req);
  if (!sess?.idToken) throw new Error("Unauthorized");

  const jwt = decodeJwt(sess.idToken);
  const cognitoId = String(jwt.sub || "");
  const email = String(jwt.email || "").toLowerCase();
  const orgIdFromToken = String(jwt["custom:orgId"] || "");
  const accessToken = String(sess.accessToken || "");
  if (!cognitoId) throw new Error("Invalid token");

  const pool = getPool();
  const userRes = await pool.query(
    `SELECT user_id FROM users
     WHERE cognito_user_id = $1 OR lower(email) = lower($2)
     ORDER BY CASE WHEN cognito_user_id = $1 THEN 0 ELSE 1 END LIMIT 1`,
    [cognitoId, email]
  );
  const user = userRes.rows[0];
  if (!user?.user_id) throw new Error("User not found");

  const empRes = await pool.query(
    `SELECT emp_id, org_id FROM employees WHERE user_id = $1 LIMIT 1`,
    [user.user_id]
  );
  const emp = empRes.rows[0] || null;

  const orgId = (() => {
    const e = String(emp?.org_id || "").trim();
    if (e && UUID_RE.test(e)) return e;
    const t = String(orgIdFromToken || "").trim();
    if (t && UUID_RE.test(t)) return t;
    return "";
  })();

  return { accessToken, orgId, empId: String(emp?.emp_id || "").trim() };
}

function getErrorMessage(data: any, fallback: string) {
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail)) {
    return data.detail.map((i: any) => i?.msg || JSON.stringify(i)).join("; ");
  }
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

export async function POST(req: NextRequest) {
  try {
    const { accessToken, orgId, empId } = await resolveContext(req);
    const body = await req.json().catch(() => ({}));

    const payload = {
      ...body,
      enroll_start_at: sanitizeDt(body?.enroll_start_at),
      enroll_end_at: sanitizeDt(body?.enroll_end_at),
      run_start_at: sanitizeDt(body?.run_start_at),
      run_end_at: sanitizeDt(body?.run_end_at),
      ...(orgId ? { creator_org_id: orgId } : {}),
      ...(empId ? { created_by: empId } : {}),
    };

    const backendRes = await fetch(`${BACKEND_URL}/activity/challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, message: getErrorMessage(data, `Failed to create challenge (${backendRes.status})`) },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        activity_id:
          data?.activity_id ??
          data?.id ??
          data?.activity?.activity_id ??
          data?.activity?.commonInfo?.activity_id ??
          data?.commonInfo?.activity_id ??
          null,
        activity: data?.activity ?? data,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const message = error?.message || "Internal server error";
    const status =
      message === "Unauthorized" || message === "Invalid token"
        ? 401
        : message === "User not found"
          ? 404
          : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { accessToken, orgId, empId } = await resolveContext(req);
    const body = await req.json().catch(() => ({}));

    const activityId = String(body?.activity_id ?? body?.id ?? "").trim();
    if (!activityId) {
      return NextResponse.json(
        { ok: false, message: "activity_id is required" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { creator_org_id: _coi, created_by: _cb, ...safeBody } = body;

    const payload = {
      ...safeBody,
      activity_id: activityId,
      activity_type: "challenge",
      enroll_start_at: sanitizeDt(body?.enroll_start_at),
      enroll_end_at: sanitizeDt(body?.enroll_end_at),
      run_start_at: sanitizeDt(body?.run_start_at),
      run_end_at: sanitizeDt(body?.run_end_at),
    };

    const backendRes = await fetch(`${BACKEND_URL}/activity/challenge/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      console.error("Challenge update failed:", {
        status: backendRes.status,
        payload,
        data,
      });

      return NextResponse.json(
        {
          ok: false,
          message: getErrorMessage(data, `Failed to update challenge (${backendRes.status})`),
        },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({
      ok: true,
      activity_id:
        data?.activity_id ??
        data?.id ??
        data?.activity?.activity_id ??
        data?.activity?.commonInfo?.activity_id ??
        payload.activity_id,
      activity: data?.activity ?? data,
    });
  } catch (error: any) {
    const message = error?.message || "Internal server error";
    const status =
      message === "Unauthorized" || message === "Invalid token"
        ? 401
        : message === "User not found"
          ? 404
          : 500;

    return NextResponse.json({ ok: false, message }, { status });
  }
}