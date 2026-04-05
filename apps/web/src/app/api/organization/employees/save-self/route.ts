import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { Pool } from "pg";
import fs from "fs";
import crypto from "crypto";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;

declare global {
  // eslint-disable-next-line no-var
  var __vcepEmployeeSavePool: Pool | undefined;
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
  if (global.__vcepEmployeeSavePool) return global.__vcepEmployeeSavePool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH).toString() }
      : { rejectUnauthorized: false };

  global.__vcepEmployeeSavePool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  return global.__vcepEmployeeSavePool;
}

function toStringValue(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  const pool = getPool();
  let client: any = null;

  try {
    const session = getSessionTokens(req);
    if (!session?.idToken) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const token = decodeJwt(session.idToken);
    const cognitoUserId = String(token.sub || "").trim();
    const emailFromToken = String(token.email || "").trim().toLowerCase();
    const tokenRole = String(token["custom:role"] || "").trim().toLowerCase();
    const orgIdFromToken = String(token["custom:orgId"] || "").trim();

    if (!cognitoUserId) {
      return NextResponse.json({ ok: false, message: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();

    client = await pool.connect();
    await client.query("BEGIN");

    const userRes = await client.query(
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

    const dbUser = userRes.rows[0];
    if (!dbUser?.user_id) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
    }

    const resolvedRole = String(dbUser.role || tokenRole || "").toLowerCase();
    if (resolvedRole !== "employee") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          ok: false,
          message: "Only employee accounts can access this route",
          role: resolvedRole,
          tokenRole,
        },
        { status: 403 }
      );
    }

    const payload = {
      user_id: toStringValue(body?.userId || body?.user_id) || String(dbUser.user_id),
      org_id: toStringValue(body?.orgId || body?.org_id) || orgIdFromToken,
      first_name: toStringValue(body?.firstName || body?.first_name),
      last_name: toStringValue(body?.lastName || body?.last_name),
      position: toStringValue(body?.position),
      phone: toStringValue(body?.phone),
      avatar_choice: toStringValue(body?.avatarId || body?.avatar_choice || body?.avatarChoice),
      is_reviewer: Boolean(body?.canCheckChallenge || body?.is_reviewer || body?.isReviewer),
    };

    if (!payload.user_id || !payload.org_id) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, message: "Missing user_id or org_id for employee save" },
        { status: 400 }
      );
    }

    if (!payload.first_name || !payload.last_name) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, message: "Missing first_name or last_name" },
        { status: 400 }
      );
    }

    const existingRes = await client.query(
      `SELECT emp_id FROM employees WHERE user_id = $1 LIMIT 1`,
      [payload.user_id]
    );

    let result;
    if (existingRes.rows[0]?.emp_id) {
      result = await client.query(
        `
        UPDATE employees
        SET
          org_id = $2,
          first_name = $3,
          last_name = $4,
          position = $5,
          phone = $6,
          avatar_choice = NULLIF($7, '')::uuid,
          is_reviewer = $8
        WHERE user_id = $1
        RETURNING *
        `,
        [
          payload.user_id,
          payload.org_id,
          payload.first_name,
          payload.last_name,
          payload.position,
          payload.phone,
          payload.avatar_choice,
          payload.is_reviewer,
        ]
      );
    } else {
      const empId = crypto.randomUUID();
      result = await client.query(
        `
        INSERT INTO employees (
          emp_id,
          user_id,
          org_id,
          first_name,
          last_name,
          position,
          phone,
          avatar_choice,
          is_reviewer
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::uuid, $9)
        RETURNING *
        `,
        [
          empId,
          payload.user_id,
          payload.org_id,
          payload.first_name,
          payload.last_name,
          payload.position,
          payload.phone,
          payload.avatar_choice,
          payload.is_reviewer,
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      employee: result.rows[0],
    });
  } catch (error: any) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch {}

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Failed to save employee profile",
        detail: {
          name: error?.name || null,
          code: error?.code || null,
          detail: error?.detail || null,
          constraint: error?.constraint || null,
          table: error?.table || null,
          column: error?.column || null,
        },
      },
      { status: 500 }
    );
  } finally {
    try {
      client?.release();
    } catch {}
  }
}

export async function PUT(req: Request) {
  return POST(req);
}
