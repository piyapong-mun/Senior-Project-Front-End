// วางที่: app/api/organization/student/[stdId]/route.ts

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL || "https://vcep-platform.duckdns.org";

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const found = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!found) return null;
  try { return decodeURIComponent(found.slice(name.length + 1)); }
  catch { return found.slice(name.length + 1); }
}

function getToken(req: NextRequest): string {
  const cookieHeader = req.headers.get("cookie");
  const raw = readCookie(cookieHeader, "vcep_session");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { accessToken?: string };
      if (parsed?.accessToken) return parsed.accessToken;
    } catch {}
  }
  return readCookie(cookieHeader, "vcep_access") ?? req.cookies.get("vcep_access")?.value ?? "";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ stdId: string }> }
) {
  const { stdId } = await context.params;
  const token = getToken(req);

  try {
    const res = await fetch(
      `${BACKEND_URL}/student/${encodeURIComponent(stdId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false }, { status: res.status });
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}