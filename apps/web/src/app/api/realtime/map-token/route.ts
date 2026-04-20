import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, decodeJwt } from "jose";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const MAP_ROOM_ID = "student-explore";

type SessionShape = {
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
};

function readSessionCookie(raw: string | undefined | null): SessionShape | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SessionShape;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const rawSessionCookie =
      cookieStore.get(AUTH_COOKIE_NAME)?.value ||
      cookieStore.get("vcep_session")?.value ||
      null;

    const parsedSession = readSessionCookie(rawSessionCookie);

    const rawAccessToken =
      cookieStore.get("vcep_access")?.value ||
      cookieStore.get("accessToken")?.value ||
      null;

    const rawIdToken =
      cookieStore.get("vcep_id_token")?.value ||
      cookieStore.get("idToken")?.value ||
      null;

    const jwt =
      parsedSession?.idToken ||
      parsedSession?.accessToken ||
      rawIdToken ||
      rawAccessToken;

    if (!jwt) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
          debug: {
            expectedCookie: AUTH_COOKIE_NAME,
            hasRawSessionCookie: !!rawSessionCookie,
            hasParsedSession: !!parsedSession,
            hasParsedIdToken: !!parsedSession?.idToken,
            hasParsedAccessToken: !!parsedSession?.accessToken,
            hasRawAccessToken: !!rawAccessToken,
            hasRawIdToken: !!rawIdToken,
          },
        },
        { status: 401 }
      );
    }

    const secret = process.env.MAP_WS_JWT_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_MAP_WS_URL;

    if (!secret || !wsUrl) {
      return NextResponse.json(
        { ok: false, message: "Missing realtime environment variables" },
        { status: 500 }
      );
    }

    const decoded = decodeJwt(jwt);
    const userId = String(decoded.sub || "");

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Invalid session token" },
        { status: 401 }
      );
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
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to mint realtime token",
        error: error?.message || "unknown error",
      },
      { status: 500 }
    );
  }
}