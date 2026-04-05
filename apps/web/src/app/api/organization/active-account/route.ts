import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { Pool } from "pg";
import fs from "fs";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;

declare global {
  // eslint-disable-next-line no-var
  var __vcepActiveAccountPool: Pool | undefined;
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(name + "="));
  if (!found) return null;
  const v = found.slice(name.length + 1);
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function getSessionTokens(req: Request) {
  const cookieHeader = req.headers.get("cookie");

  const raw = readCookie(cookieHeader, COOKIE_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        idToken?: string;
        accessToken?: string;
        refreshToken?: string;
      };
      if (parsed?.idToken) return parsed;
    } catch {}
  }

  const idToken = readCookie(cookieHeader, "vcep_id");
  if (!idToken) return null;

  return { idToken };
}

function stripPgSslParams(connectionString: string) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("sslcert");
    url.searchParams.delete("sslkey");
    url.searchParams.delete("sslrootcert");
    return url.toString();
  } catch {
    return connectionString
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/([?&])sslcert=[^&]*/gi, "$1")
      .replace(/([?&])sslkey=[^&]*/gi, "$1")
      .replace(/([?&])sslrootcert=[^&]*/gi, "$1")
      .replace(/[?&]$/, "");
  }
}

function getPool() {
  if (global.__vcepActiveAccountPool) return global.__vcepActiveAccountPool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH).toString() }
      : { rejectUnauthorized: false };

  global.__vcepActiveAccountPool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  return global.__vcepActiveAccountPool;
}

export async function GET(req: Request) {
  try {
    const sess = getSessionTokens(req);
    const idToken = sess?.idToken;

    if (!idToken) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const payload = decodeJwt(idToken);
    const cognitoUserId = payload.sub as string | undefined;
    const tokenRole = String(payload["custom:role"] || "").toLowerCase();
    const emailFromToken = String(payload.email || "").toLowerCase();
    const orgIdFromToken = String(payload["custom:orgId"] || "");

    if (!cognitoUserId) {
      return NextResponse.json({ ok: false, message: "Invalid token" }, { status: 401 });
    }

    const pool = getPool();

    const userRes = await pool.query(
      `
      SELECT user_id, email, role, status
      FROM users
      WHERE cognito_user_id = $1
         OR lower(email) = lower($2)
      ORDER BY CASE WHEN cognito_user_id = $1 THEN 0 ELSE 1 END
      LIMIT 1
      `,
      [cognitoUserId, emailFromToken]
    );

    const user = userRes.rows[0];
    if (!user?.user_id) {
      return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
    }

    // IMPORTANT: DB role is source of truth. Do not block just because custom:role in token is stale.
    const resolvedRole = String(user.role || tokenRole || "").toLowerCase();
    if (resolvedRole !== "employee") {
      return NextResponse.json(
        {
          ok: false,
          message: "Only employee accounts can access this route",
          role: resolvedRole,
          tokenRole,
          email: user.email || emailFromToken,
        },
        { status: 403 }
      );
    }

    const empRes = await pool.query(
      `
      SELECT emp_id, org_id, first_name, last_name, position, phone, avatar_choice, is_reviewer
      FROM employees
      WHERE user_id = $1
      LIMIT 1
      `,
      [user.user_id]
    );

    const employee = empRes.rows[0] || null;
    const resolvedOrgId = String(employee?.org_id || orgIdFromToken || "");

    return NextResponse.json({
      ok: true,
      userId: String(user.user_id),
      empId: employee?.emp_id ? String(employee.emp_id) : "",
      orgId: resolvedOrgId,
      email: String(user.email || emailFromToken || "").toLowerCase(),
      employee,
      role: resolvedRole,
      tokenRole,
      status: String(user.status || ""),
      needsEmployeeBootstrap: !employee,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
