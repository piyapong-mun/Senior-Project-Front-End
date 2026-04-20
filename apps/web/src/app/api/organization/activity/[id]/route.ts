/**
 * src/app/api/organization/activity/[id]/route.ts
 *
 * GET   /api/organization/activity/[id]
 * PATCH /api/organization/activity/[id]
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
  var __vcepActivityDetailPool: Pool | undefined;
}

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
  if (global.__vcepActivityDetailPool) return global.__vcepActivityDetailPool;
  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };
  global.__vcepActivityDetailPool = new Pool({ connectionString: stripPgSslParams(DATABASE_URL), ssl });
  return global.__vcepActivityDetailPool;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_REGEX.test(v);

async function resolveEmployeeContext(req: NextRequest) {
  const sess = getSessionTokens(req);
  if (!sess?.idToken) throw new Error("Unauthorized");

  const payload = decodeJwt(sess.idToken);
  const cognitoUserId = String(payload.sub || "");
  const emailFromToken = String(payload.email || "").toLowerCase();
  const orgIdFromToken = String(payload["custom:orgId"] || "");
  const accessToken = String(sess.accessToken || "");

  if (!cognitoUserId) throw new Error("Invalid token");

  const pool = getPool();

  const userRes = await pool.query(
    `SELECT user_id, email FROM users
     WHERE cognito_user_id = $1 OR lower(email) = lower($2)
     ORDER BY CASE WHEN cognito_user_id = $1 THEN 0 ELSE 1 END LIMIT 1`,
    [cognitoUserId, emailFromToken]
  );
  const user = userRes.rows[0];
  if (!user?.user_id) throw new Error("User not found");

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

  return {
    accessToken,
    orgId,
    empId: String(emp?.emp_id || "").trim(),
    userId: String(user.user_id),
  };
}

function getErrorMessage(data: any, fallback: string) {
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail)) {
    return data.detail.map((i: any) => i?.msg || JSON.stringify(i)).join("; ");
  }
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

function extractActivityId(activity: any) {
  const commonInfo = activity?.commonInfo ?? activity?.common_info ?? activity;
  return String(commonInfo?.activity_id ?? activity?.activity_id ?? activity?.id ?? "");
}

function extractActivityList(payload: any): any[] {
  const candidates = [
    payload, payload?.data, payload?.result, payload?.activities,
    payload?.activity, payload?.items, payload?.list,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function unwrapActivity(payload: any) {
  return payload?.activity ?? payload?.data?.activity ?? payload?.data ?? payload;
}

function getTypedDetailCandidateUrls(id: string, prefer?: string) {
  if (prefer === "course") {
    return [
      `${BACKEND_URL}/activity/course/${id}`,
      `${BACKEND_URL}/activity/meeting/${id}`,
      `${BACKEND_URL}/activity/challenge/${id}`,
      `${BACKEND_URL}/activity/${id}`,
    ];
  }
  return [
    `${BACKEND_URL}/activity/challenge/${id}`,
    `${BACKEND_URL}/activity/meeting/${id}`,
    `${BACKEND_URL}/activity/course/${id}`,
    `${BACKEND_URL}/activity/${id}`,
  ];
}

function getOrgListCandidateUrls(orgId: string) {
  if (!orgId) return [];
  return [
    `${BACKEND_URL}/activity/challenge/org/${orgId}`,
    `${BACKEND_URL}/activity/meeting/org/${orgId}`,
    `${BACKEND_URL}/activity/course/org/${orgId}`,
    `${BACKEND_URL}/activity/org/${orgId}`,
  ];
}

async function fetchJson(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Build update payload.
 * course/update (PUT) REQUIRES created_by + creator_org_id.
 * meeting/challenge update must NOT receive them (FK violation).
 */
function buildUpdatePayload(
  id: string,
  body: any,
  ctx: { empId: string; orgId: string; userId: string },
  inferredType: string
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { creator_org_id: _coi, created_by: _cb, ...safeBody } = body;

  const base = {
    ...safeBody,
    activity_id: id,
    activity_type: inferredType || safeBody.activity_type,
  };

  // course/update requires these fields
  if (inferredType === "course") {
    return {
      ...base,
      created_by: ctx.empId || ctx.userId,
      creator_org_id: ctx.orgId,
    };
  }

  return base;
}

async function detectExistingActivityType(id: string, accessToken: string) {
  for (const url of getTypedDetailCandidateUrls(id)) {
    const { res, data } = await fetchJson(url, accessToken, { method: "GET" });
    if (!res.ok) continue;
    const activity = unwrapActivity(data);
    const commonInfo = activity?.commonInfo ?? activity?.common_info ?? activity;
    const type = String(commonInfo?.activity_type ?? activity?.activity_type ?? "").trim().toLowerCase();
    if (type) return type;
  }
  return "";
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const prefer = new URL(req.url).searchParams.get("prefer") ?? undefined;

  try {
    const { accessToken, orgId } = await resolveEmployeeContext(req);
    let lastMessage = "Not Found";

    for (const url of getTypedDetailCandidateUrls(id, prefer)) {
      const { res, data } = await fetchJson(url, accessToken, { method: "GET" });
      if (res.ok) {
        return NextResponse.json({ ok: true, activity: unwrapActivity(data) });
      }
      lastMessage = getErrorMessage(data, lastMessage);
    }

    for (const url of getOrgListCandidateUrls(orgId)) {
      const { res, data } = await fetchJson(url, accessToken, { method: "GET" });
      if (!res.ok) continue;
      const found = extractActivityList(data).find((item) => extractActivityId(item) === id);
      if (found) {
        return NextResponse.json({ ok: true, activity: found });
      }
    }

    return NextResponse.json({ ok: false, message: lastMessage || "Not Found" }, { status: 404 });
  } catch (error: any) {
    const message = error?.message || "Internal server error";
    const status = message === "Unauthorized" || message === "Invalid token" ? 401
      : message === "User not found" ? 404 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const ctx = await resolveEmployeeContext(req);
    const { accessToken } = ctx;
    const body = await req.json().catch(() => ({}));

    const existingType = await detectExistingActivityType(id, accessToken);
    const inferredType = String(body?.activity_type || existingType || "").toLowerCase();

    const payload = buildUpdatePayload(id, body, ctx, inferredType);

    const candidateRequests: Array<{ url: string; method: "PUT" | "PATCH"; body: string }> = [];

    if (inferredType === "meeting") {
      candidateRequests.push({
        url: `${BACKEND_URL}/activity/meeting/update`,
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }

    if (inferredType === "challenge") {
      candidateRequests.push({
        url: `${BACKEND_URL}/activity/challenge/update`,
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }

    if (inferredType === "course") {
      candidateRequests.push({
        url: `${BACKEND_URL}/activity/course/update`,
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }

    // fallback: PATCH on each typed endpoint
    for (const url of getTypedDetailCandidateUrls(id)) {
      candidateRequests.push({ url, method: "PATCH", body: JSON.stringify(payload) });
    }

    let lastMessage = "Failed to update activity";
    let lastStatus = 404;

    for (const candidate of candidateRequests) {
      const { res, data } = await fetchJson(candidate.url, accessToken, {
        method: candidate.method,
        body: candidate.body,
      });

      if (res.ok) {
        return NextResponse.json({ ok: true, activity: unwrapActivity(data) });
      }

      lastMessage = getErrorMessage(data, lastMessage);
      lastStatus = res.status;
    }

    return NextResponse.json({ ok: false, message: lastMessage }, { status: lastStatus });
  } catch (error: any) {
    const message = error?.message || "Internal server error";
    const status = message === "Unauthorized" || message === "Invalid token" ? 401
      : message === "User not found" ? 404 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}