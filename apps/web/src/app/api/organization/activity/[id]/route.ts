/**
 * apps/web/src/app/api/organization/activity/[id]/route.ts
 *
 * GET  /api/organization/activity/[id]   → โหลดรายละเอียด activity (ActivityDashboard)
 * PATCH /api/organization/activity/[id]  → อัปเดต status / type ของ activity
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "https://vcep-platform.duckdns.org";

function getToken(req: NextRequest): string {
  return (
    req.cookies.get("access_token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    ""
  );
}

/* ---------- GET ---------- */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const token = getToken(req);

  try {
    // ลอง endpoint แบบ by activity_id ก่อน
    const backendRes = await fetch(`${BACKEND_URL}/activity/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, message: data?.detail || data?.message || "Failed to load activity" },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (error: any) {
    console.error(`[GET /api/organization/activity/${id}]`, error);
    return NextResponse.json(
      { ok: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/* ---------- PATCH ---------- */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const token = getToken(req);

  try {
    const body = await req.json();

    const backendRes = await fetch(`${BACKEND_URL}/activity/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, message: data?.detail || data?.message || "Failed to update activity" },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (error: any) {
    console.error(`[PATCH /api/organization/activity/${id}]`, error);
    return NextResponse.json(
      { ok: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
