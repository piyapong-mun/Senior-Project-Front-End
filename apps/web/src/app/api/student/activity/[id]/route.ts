import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://vcep-platform.duckdns.org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("vcep_access")?.value ?? "";
    const sessionToken = cookieStore.get("vcep_session")?.value ?? "";
    const stdId = cookieStore.get("vcep_id")?.value ?? "";
    const token = accessToken || sessionToken;

    if (!stdId) {
      return NextResponse.json(
        { ok: false, message: "Student session not found" },
        { status: 401 }
      );
    }

    const backendRes = await fetch(
      `${BACKEND_URL}/activity/student/meeting/${id}/${stdId}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      }
    );

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, message: data?.detail ?? data?.message ?? "Activity not found" },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({ ok: true, activity: data });
  } catch (err: any) {
    console.error("[student/activity/[id]] error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}