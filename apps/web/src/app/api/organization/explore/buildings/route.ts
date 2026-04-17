import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { Pool } from "pg";
import fs from "fs";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;

declare global {
  // eslint-disable-next-line no-var
  var __vcepExploreBuildingsPool: Pool | undefined;
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(`${name}=`));
  if (!found) return null;
  const value = found.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getSessionTokens(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const raw = readCookie(cookieHeader, COOKIE_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { idToken?: string };
      if (parsed?.idToken) return { idToken: parsed.idToken };
    } catch {}
  }
  const idToken = readCookie(cookieHeader, "vcep_id");
  if (!idToken) return null;
  return { idToken };
}

function stripPgSslParams(connectionString: string) {
  try {
    const url = new URL(connectionString);
    ["sslmode", "sslcert", "sslkey", "sslrootcert"].forEach((k) =>
      url.searchParams.delete(k)
    );
    return url.toString();
  } catch {
    return connectionString;
  }
}

function getPool() {
  if (global.__vcepExploreBuildingsPool) return global.__vcepExploreBuildingsPool;
  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };
  global.__vcepExploreBuildingsPool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });
  return global.__vcepExploreBuildingsPool;
}

export async function GET(req: Request) {
  try {
    const sess = getSessionTokens(req);
    if (!sess?.idToken) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const payload = decodeJwt(sess.idToken);
    const cognitoUserId = String(payload.sub || "");
    if (!cognitoUserId) {
      return NextResponse.json({ ok: false, message: "Invalid token" }, { status: 401 });
    }

    const pool = getPool();

    const result = await pool.query(`
      SELECT
        o.org_id,
        o.org_name,
        o.building_id,
        b.building_name
      FROM organizations o
      INNER JOIN building b ON b.building_id = o.building_id
      WHERE o.building_id IS NOT NULL
        AND COALESCE(b.building_selected, false) = true
        AND b.building_name IS NOT NULL
        AND b.building_name <> ''
      ORDER BY b.building_name ASC
    `);

    const buildings: { org_id: string; org_name: string; building_name: string }[] =
      result.rows.map((row) => ({
        org_id: String(row.org_id),
        org_name: String(row.org_name),
        building_name: String(row.building_name),
      }));

    return NextResponse.json({ ok: true, data: { buildings } });
  } catch (error: any) {
    const message = error?.message || "Server error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
