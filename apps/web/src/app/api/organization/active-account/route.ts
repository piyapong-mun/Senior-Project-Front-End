import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function getCookieValue(cookieStore: Awaited<ReturnType<typeof cookies>>, name: string): string | null {
  const c = cookieStore.get(name); // Cookie | undefined
  return c ? c.value : null;
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token =
      getCookieValue(cookieStore, "idToken") ||
      getCookieValue(cookieStore, "id_token") ||
      getCookieValue(cookieStore, "accessToken") ||
      getCookieValue(cookieStore, "access_token") ||
      getCookieValue(cookieStore, "token") ||
      "";

    if (!token) {
      return NextResponse.json({ ok: false, message: "missing token" }, { status: 401 });
    }

    const claims = decodeJwtPayload(token);
    if (!claims) {
      return NextResponse.json({ ok: false, message: "invalid token" }, { status: 401 });
    }

    const sub = String(claims.sub || "");
    const email = String(claims.email || claims["cognito:username"] || "").toLowerCase();
    const orgId = String(claims["custom:orgId"] || "");

    // หา userId จากตาราง users (ตาม ERD ของคุณ)
    const r = await pool.query(
      `SELECT user_id
       FROM users
       WHERE cognito_user_id = $1 OR LOWER(email) = $2
       LIMIT 1`,
      [sub, email]
    );

    const userId = r.rows?.[0]?.user_id ? String(r.rows[0].user_id) : "";

    return NextResponse.json({
      ok: true,
      userId,
      orgId,
      email,
    });
  } catch (e: any) {
    console.error("active-account GET error:", e);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
