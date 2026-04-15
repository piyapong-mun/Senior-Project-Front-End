/**
 * apps/web/src/app/api/organization/logo/route.ts
 *
 * POST /api/organization/logo
 * Upload org logo to S3: org-logos/{orgId}/logo.png
 * Pattern เดียวกับ student/profile-image/route.ts
 */

import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { Pool } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ap-southeast-2";
const S3_PUBLIC_BASE_URL =
  process.env.S3_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
  `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;

declare global {
  // eslint-disable-next-line no-var
  var __vcepLogoPool: Pool | undefined;
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
      };
      if (parsed?.idToken) return parsed;
    } catch {}
  }

  const idToken = readCookie(cookieHeader, "vcep_id");
  if (!idToken) return null;

  return { idToken };
}

function stripPgSslParams(cs: string) {
  try {
    const url = new URL(cs);
    ["sslmode", "sslcert", "sslkey", "sslrootcert"].forEach((k) =>
      url.searchParams.delete(k)
    );
    return url.toString();
  } catch {
    return cs;
  }
}

function getPool() {
  if (global.__vcepLogoPool) return global.__vcepLogoPool;
  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };
  global.__vcepLogoPool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });
  return global.__vcepLogoPool;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const s3 = new S3Client({ region: S3_REGION });

export async function POST(req: Request) {
  try {
    const sess = getSessionTokens(req);
    const idToken = sess?.idToken;

    if (!idToken) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const jwt = decodeJwt(idToken);
    const cognitoUserId = jwt.sub;
    const emailFromToken = String(jwt.email || "").toLowerCase();
    const orgIdFromToken = String(jwt["custom:orgId"] || "");

    if (!cognitoUserId) {
      return NextResponse.json(
        { ok: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    // Resolve orgId from DB
    const pool = getPool();

    const userRes = await pool.query(
      `SELECT user_id FROM users
       WHERE cognito_user_id = $1 OR lower(email) = lower($2)
       ORDER BY CASE WHEN cognito_user_id = $1 THEN 0 ELSE 1 END LIMIT 1`,
      [cognitoUserId, emailFromToken]
    );
    const user = userRes.rows[0];
    if (!user?.user_id) {
      return NextResponse.json(
        { ok: false, message: "User not found" },
        { status: 404 }
      );
    }

    const empRes = await pool.query(
      `SELECT org_id FROM employees WHERE user_id = $1 LIMIT 1`,
      [user.user_id]
    );
    const emp = empRes.rows[0];

    const orgId = (() => {
      const fromEmp = String(emp?.org_id || "").trim();
      if (fromEmp && UUID_REGEX.test(fromEmp)) return fromEmp;
      const fromToken = String(orgIdFromToken || "").trim();
      if (fromToken && UUID_REGEX.test(fromToken)) return fromToken;
      return null;
    })();

    if (!orgId) {
      return NextResponse.json(
        { ok: false, message: "Organization not found for this account" },
        { status: 400 }
      );
    }

    // Parse file — same pattern as student/profile-image
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "File is required" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { ok: false, message: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // key: org-logos/{orgId}/logo.png  (เขียนทับของเดิมเหมือน student)
    const key = `org-logos/${orgId}/logo.png`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "image/png",
        CacheControl: "no-cache, no-store, must-revalidate",
      })
    );

    const version = Date.now();
    const url = `${S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}?v=${version}`;

    return NextResponse.json({
      ok: true,
      key,
      url,
      version,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Upload failed" },
      { status: 500 }
    );
  }
}