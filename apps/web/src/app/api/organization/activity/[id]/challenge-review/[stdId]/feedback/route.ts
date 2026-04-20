// วางที่: app/api/organization/activity/[id]/challenge-review/[stdId]/feedback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";

const BACKEND_URL =
  process.env.BACKEND_URL || "https://vcep-platform.duckdns.org";

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const found = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!found) return null;
  try {
    return decodeURIComponent(found.slice(name.length + 1));
  } catch {
    return found.slice(name.length + 1);
  }
}

function getTokens(req: NextRequest): { accessToken: string; idToken: string } | null {
  const cookieHeader = req.headers.get("cookie");
  const raw = readCookie(cookieHeader, "vcep_session");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { accessToken?: string; idToken?: string };
      if (parsed?.accessToken && parsed?.idToken)
        return { accessToken: parsed.accessToken, idToken: parsed.idToken };
    } catch {}
  }
  const accessToken =
    readCookie(cookieHeader, "vcep_access") ?? req.cookies.get("vcep_access")?.value ?? "";
  const idToken =
    readCookie(cookieHeader, "vcep_id") ?? req.cookies.get("vcep_id")?.value ?? "";
  if (accessToken && idToken) return { accessToken, idToken };
  return null;
}

function pickFirst(source: any, keys: string[]): string {
  for (const key of keys) {
    const v = source?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

async function fetchJson(url: string, token: string) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 500, data: { message: e?.message } };
  }
}

async function postJson(url: string, body: any, token: string) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 500, data: { message: e?.message } };
  }
}

async function resolveReviewerId(
  req: NextRequest,
  activityId: string,
  tokens: { accessToken: string; idToken: string }
): Promise<string> {
  // 1) active-account — ใช้ empId (users.user_id) ไม่ใช่ userId (emp_id)
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/organization/active-account`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        cookie: req.headers.get("cookie") || "",
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    // empId คือ users.user_id ที่ submit_feedback_reviewer_id_fkey ต้องการ
    const empId = pickFirst(data, ["empId", "emp_id"]);
    if (empId) return empId;
    // fallback: userId ถ้าไม่มี empId
    const uid = pickFirst(data, ["userId", "user_id"]);
    if (uid) return uid;
  } catch {}

  // 2) idToken sub → /auth/all
  try {
    const jwt = decodeJwt(tokens.idToken);
    const sub = String(jwt?.sub ?? "").trim();
    if (sub) {
      const usersRes = await fetchJson(`${BACKEND_URL}/auth/all`, tokens.accessToken);
      const list: any[] = Array.isArray(usersRes.data)
        ? usersRes.data
        : Array.isArray(usersRes.data?.data) ? usersRes.data.data
        : Array.isArray(usersRes.data?.users) ? usersRes.data.users : [];
      const match = list.find(
        (u) => String(u?.cognito_user_id ?? u?.cognitoUserId ?? "") === sub
      );
      if (match?.user_id) return String(match.user_id);
    }
  } catch {}

  // 3) activity created_by
  const actRes = await fetchJson(`${BACKEND_URL}/activity/${activityId}`, tokens.accessToken);
  if (actRes.ok) {
    const src = actRes.data?.activity ?? actRes.data?.data ?? actRes.data ?? {};
    const id =
      pickFirst(src, ["created_by", "creator_id", "creatorId"]) ||
      pickFirst(src?.commonInfo ?? {}, ["created_by", "creator_id", "creatorId"]);
    if (id) return id;
  }

  return "";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; stdId: string }> }
) {
  const { id } = await context.params;

  const tokens = getTokens(req);
  if (!tokens) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const submissionId = String(body?.submission_id ?? body?.submissionId ?? "").trim();
  const feedback = String(body?.feedback ?? "").trim();
  const status = typeof body?.status === "boolean" ? body.status : Boolean(body?.status);

  if (!submissionId) {
    return NextResponse.json({ ok: false, message: "submission_id is required" }, { status: 400 });
  }
  if (!feedback) {
    return NextResponse.json({ ok: false, message: "feedback is required" }, { status: 400 });
  }

  const reviewerId =
    String(body?.reviewer_id ?? body?.reviewerId ?? "").trim() ||
    (await resolveReviewerId(req, id, tokens));

  if (!reviewerId) {
    return NextResponse.json({ ok: false, message: "Could not resolve reviewer_id" }, { status: 500 });
  }

  const payload = {
    feedback,
    reviewer_id: reviewerId,
    status,
    submission_id: submissionId,
  };

  const result = await postJson(
    `${BACKEND_URL}/activity/submission/challenge/feedback`,
    payload,
    tokens.accessToken
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: result.data?.message || result.data?.detail || "Failed to submit feedback",
        backend_status: result.status,
        backend_body: result.data,
        sent_payload: payload,
      },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({ ok: true, result: result.data });
}