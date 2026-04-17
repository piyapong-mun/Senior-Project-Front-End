import { NextResponse } from "next/server";
import { Pool } from "pg";
import fs from "fs";

export const runtime = "nodejs";

const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;

declare global {
  // eslint-disable-next-line no-var
  var __vcepOptionsBuildingsPool: Pool | undefined;
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
  if (global.__vcepOptionsBuildingsPool) return global.__vcepOptionsBuildingsPool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };

  global.__vcepOptionsBuildingsPool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  return global.__vcepOptionsBuildingsPool;
}

function toPublicAssetUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (
    String(process.env.ASSETS_PUBLIC_BASE || "").trim() ||
    String(process.env.S3_PUBLIC_BASE_URL || "").trim() ||
    String(process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || "").trim() ||
    "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com"
  ).replace(/\/$/, "");

  return `${base}/${raw.replace(/^\/+/, "")}`;
}

export async function GET() {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        b.building_id,
        b.building_name,
        b.building_model,
        b.preview_url,
        b.unlock_level,
        COALESCE(b.building_selected, false) AS building_selected
      FROM building b
      WHERE b.building_name IS NOT NULL
        AND b.building_name <> ''
        AND b.building_model IS NOT NULL
        AND b.building_model <> ''
      ORDER BY b.building_name ASC
    `);

    const items = result.rows.map((row) => ({
      id: String(row.building_id),
      name: String(row.building_name),
      modelUrl: toPublicAssetUrl(row.building_model),
      previewUrl: row.preview_url ? toPublicAssetUrl(row.preview_url) : null,
      unlockLevel: Number(row.unlock_level ?? 0),
      buildingSelected: Boolean(row.building_selected),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error: any) {
    console.error("GET /api/options/buildings ERROR:", error);
    return NextResponse.json(
      { ok: false, message: error?.message || "failed" },
      { status: 500 }
    );
  }
}
