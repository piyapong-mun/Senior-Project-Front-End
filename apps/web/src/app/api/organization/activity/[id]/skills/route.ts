import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";

const SKILL_LEVEL_OPTIONS = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
] as const;

type CatalogSkill = {
  skillName: string;
  skillCategory: string;
};

type DbSkillRow = {
  skill_id: string;
  level: number | string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __vcepActivityDetailPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __vcepMeetingPool: Pool | undefined;
}

const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;

function stripPgSslParams(cs: string) {
  try {
    const url = new URL(cs);
    [
      "sslmode",
      "sslcert",
      "sslkey",
      "sslrootcert",
      "ssl",
      "sslaccept",
    ].forEach((k) => url.searchParams.delete(k));
    return url.toString();
  } catch {
    return cs;
  }
}

function getPool() {
  if (global.__vcepActivityDetailPool) return global.__vcepActivityDetailPool;
  if (global.__vcepMeetingPool) return global.__vcepMeetingPool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };

  const pool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  global.__vcepActivityDetailPool = pool;
  return pool;
}

function normalizeSkillId(skill: any, fallback = ""): string {
  return String(
    skill?.skill_id ??
      skill?.skillID ??
      skill?.skillId ??
      skill?.SkillID ??
      skill?.id ??
      fallback
  ).trim();
}

function normalizeSkillName(skill: any): string {
  return String(
    skill?.skill_name ??
      skill?.skillName ??
      skill?.SkillName ??
      skill?.name ??
      ""
  ).trim();
}

function normalizeSkillCategory(skill: any): string {
  return String(
    skill?.skill_category ??
      skill?.skillCategory ??
      skill?.SkillCategory ??
      skill?.category ??
      ""
  ).trim();
}

function normalizeSkillLevelValue(raw: any): number {
  if (typeof raw === "string") {
    const trimmed = raw.trim();

    const matchedIndex = SKILL_LEVEL_OPTIONS.findIndex(
      (option) => option.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchedIndex >= 0) return matchedIndex;

    const numeric = Number(trimmed);
    if (
      Number.isFinite(numeric) &&
      numeric >= 0 &&
      numeric < SKILL_LEVEL_OPTIONS.length
    ) {
      return numeric;
    }

    return 0;
  }

  const numeric = Number(raw);
  if (
    Number.isFinite(numeric) &&
    numeric >= 0 &&
    numeric < SKILL_LEVEL_OPTIONS.length
  ) {
    return numeric;
  }

  return 0;
}

function normalizeSkillLevelLabel(value: number): string {
  return SKILL_LEVEL_OPTIONS[value] ?? SKILL_LEVEL_OPTIONS[0];
}

async function fetchWithForwardedHeaders(req: NextRequest, url: string) {
  const headers: Record<string, string> = {};

  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  const auth = req.headers.get("authorization");
  if (auth) headers.authorization = auth;

  return fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const origin = new URL(req.url).origin;

    const [detailRes, catalogRes] = await Promise.all([
      fetchWithForwardedHeaders(
        req,
        `${origin}/api/organization/activity/${encodeURIComponent(id)}`
      ),
      fetchWithForwardedHeaders(
        req,
        `${origin}/api/organization/activity/skills`
      ),
    ]);

    const detailData = await detailRes.json().catch(() => ({}));
    const catalogData = await catalogRes.json().catch(() => ({}));

    if (!detailRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            detailData?.message ||
            `Failed to load activity skills (${detailRes.status})`,
        },
        { status: detailRes.status }
      );
    }

    const catalogList = Array.isArray(catalogData?.skills)
      ? catalogData.skills
      : [];

    const catalogMap = new Map<string, CatalogSkill>(
      catalogList.map((skill: any): [string, CatalogSkill] => [
        normalizeSkillId(skill).toLowerCase(),
        {
          skillName: normalizeSkillName(skill),
          skillCategory: normalizeSkillCategory(skill),
        },
      ])
    );

    const pool = getPool();
    const dbResult = await pool.query<DbSkillRow>(
      `
        SELECT skill_id, level
        FROM activity_skills
        WHERE activity_id = $1
        ORDER BY skill_id ASC
      `,
      [id]
    );

    const normalizedSkills = dbResult.rows.map((row, index) => {
      const skillId = normalizeSkillId(row, `skill-${index}`);
      const catalogMatch = catalogMap.get(skillId.toLowerCase());
      const levelValue = normalizeSkillLevelValue(row.level);

      return {
        id: `activity-skill-${skillId}-${index}`,
        skill_id: skillId,
        skill_name: catalogMatch?.skillName || `Skill ${index + 1}`,
        skill_category: catalogMatch?.skillCategory || "",
        skill_level_value: levelValue,
        skill_level_label: normalizeSkillLevelLabel(levelValue),
      };
    });

    return NextResponse.json({
      ok: true,
      skills: normalizedSkills,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}