/**
 * apps/web/src/app/api/organization/activity/[id]/participants/route.ts
 *
 * GET /api/organization/activity/[id]/participants
 * โหลดรายชื่อผู้เข้าร่วมของ activity สำหรับ ActivityDashboard
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const token = getToken(req);

  try {
    const backendRes = await fetch(`${BACKEND_URL}/activity/${id}/participants`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      // ถ้า endpoint ยังไม่มี ให้ return empty array แทน error
      if (backendRes.status === 404) {
        return NextResponse.json({ ok: true, participants: [] });
      }
      const data = await backendRes.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, message: data?.detail || "Failed to load participants" },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json({ ok: true, participants: data?.participants ?? data ?? [] });
  } catch (error: any) {
    console.error(`[GET /api/organization/activity/${id}/participants]`, error);
    // Graceful fallback: return empty list instead of error
    return NextResponse.json({ ok: true, participants: [] });
  }
}
