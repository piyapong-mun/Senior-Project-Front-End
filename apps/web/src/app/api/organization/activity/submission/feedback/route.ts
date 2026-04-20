// วางที่: app/api/organization/activity/submission/feedback/route.ts

import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

const BACKEND = process.env.BACKEND_URL!;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));
  if (!found) return null;
  const value = found.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getSessionTokens(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const raw = readCookie(cookieHeader, COOKIE_NAME);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { accessToken?: string; idToken?: string };
      if (parsed?.accessToken && parsed?.idToken) {
        return { accessToken: parsed.accessToken, idToken: parsed.idToken };
      }
    } catch {}
  }

  const accessToken = readCookie(cookieHeader, "vcep_access");
  const idToken = readCookie(cookieHeader, "vcep_id");
  if (!accessToken || !idToken) return null;
  return { accessToken, idToken };
}

async function findBackendUserByCognitoSub(cognitoSub: string, accessToken: string) {
  const res = await fetch(`${BACKEND}/auth/all`, {
    headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  const users: any[] = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.users)
    ? json.users
    : [];

  return (
    users.find(
      (u) =>
        String(u?.cognito_user_id ?? "") === cognitoSub ||
        String(u?.cognitoUserId ?? "") === cognitoSub
    ) ?? null
  );
}

export async function POST(req: Request) {
  try {
    const sess = getSessionTokens(req);
    if (!sess) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const submissionId = String(body?.submission_id ?? "").trim();
    const feedback = String(body?.feedback ?? "").trim();
    const statusBool = body?.status; // true = approved, false = rejected

    if (!submissionId) {
      return NextResponse.json({ ok: false, message: "submission_id is required" }, { status: 400 });
    }
    if (!feedback) {
      return NextResponse.json({ ok: false, message: "feedback is required" }, { status: 400 });
    }
    if (typeof statusBool !== "boolean") {
      return NextResponse.json({ ok: false, message: "status (boolean) is required" }, { status: 400 });
    }

    // resolve reviewer_id from Cognito token → backend user
    const jwt = decodeJwt(sess.idToken);
    const cognitoSub = String(jwt?.sub ?? "").trim();
    if (!cognitoSub) {
      return NextResponse.json({ ok: false, message: "Invalid token" }, { status: 401 });
    }

    const backendUser = await findBackendUserByCognitoSub(cognitoSub, sess.accessToken);
    if (!backendUser?.user_id) {
      return NextResponse.json({ ok: false, message: "Reviewer not found" }, { status: 404 });
    }

    const payload = {
      feedback,
      reviewer_id: String(backendUser.user_id),
      status: statusBool,
      submission_id: submissionId,
    };

    const res = await fetch(`${BACKEND}/activity/submission/challenge/feedback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sess.accessToken}`,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: data?.message || `Backend error: ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("POST /api/organization/activity/submission/feedback failed:", error);
    return NextResponse.json(
      { ok: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}