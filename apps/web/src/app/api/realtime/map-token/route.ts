import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, decodeJwt } from "jose";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const MAP_ROOM_ID = "student-explore";

function readSessionCookie(raw: string | undefined | null) {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as {
      idToken?: string;
      accessToken?: string;
      refreshToken?: string;
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = readSessionCookie(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    const idToken = session?.idToken;

    if (!idToken) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const secret = process.env.MAP_WS_JWT_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_MAP_WS_URL;

    if (!secret || !wsUrl) {
      return NextResponse.json(
        { ok: false, message: "Missing realtime environment variables" },
        { status: 500 }
      );
    }

    const decoded = decodeJwt(idToken);
    const userId = String(decoded.sub || "");

    if (!userId) {
      return NextResponse.json({ ok: false, message: "Invalid session" }, { status: 401 });
    }

    const token = await new SignJWT({
      userId,
      roomId: MAP_ROOM_ID,
      scope: "map:presence",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(secret));

    return NextResponse.json({
      ok: true,
      wsUrl,
      token,
      roomId: MAP_ROOM_ID,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Failed to mint realtime token" }, { status: 500 });
  }
}
