/**
 * apps/web/src/app/api/organization/activity/meeting/route.ts
 * 
 * API Route สำหรับสร้าง Meeting Activity
 * Proxy ไปยัง FastAPI backend: POST /activity/meeting
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
// หรือใช้ Cognito token แล้วแต่ auth setup ของโปรเจกต์

const BACKEND_URL = process.env.BACKEND_URL || "https://vcep-platform.duckdns.org";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ดึง auth token จาก cookie หรือ session
    // ปรับตาม auth setup ของโปรเจกต์ (Amazon Cognito)
    const token = req.cookies.get("access_token")?.value
      || req.headers.get("authorization")?.replace("Bearer ", "");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const backendRes = await fetch(`${BACKEND_URL}/activity/meeting`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, message: data?.detail || data?.message || "Backend error" },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/organization/activity/meeting]", error);
    return NextResponse.json(
      { ok: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
