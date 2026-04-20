import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://vcep-platform.duckdns.org";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("vcep_session")?.value ?? "";
    const accessToken = cookieStore.get("vcep_access")?.value ?? "";

    if (!sessionToken && !accessToken) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { activity_id, qrcode_checkin } = body;

    if (!activity_id || !qrcode_checkin) {
      return NextResponse.json(
        { ok: false, message: "Missing activity_id or qrcode_checkin" },
        { status: 400 }
      );
    }

    // ดึง std_id จาก session cookie (vcep_id เก็บ user id ไว้)
    const idToken = cookieStore.get("vcep_id")?.value ?? "";

    const backendRes = await fetch(`${BACKEND_URL}/activity/submission/meeting`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken || sessionToken}`,
      },
      body: JSON.stringify({
        activity_id,
        qrcode_checkin,
        std_id: idToken, // backend ดึง std_id ได้เองจาก token แต่ส่งไปด้วยกัน
      }),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, message: data?.detail ?? data?.message ?? "Check-in failed" },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({
      ok: true,
      xp: data?.xp ?? 0,
      status: data?.status ?? "Completed",
      submission_id: data?.submission_id ?? "",
      submitted_at: data?.submitted_at ?? new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[student/checkin/meeting] error:", err);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
