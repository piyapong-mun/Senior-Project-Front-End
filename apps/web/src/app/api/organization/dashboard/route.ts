import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { Pool } from "pg";
import fs from "fs";
import http from "http";
import https from "https";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const DATABASE_URL = process.env.DATABASE_URL!;
const BACKEND_URL = process.env.BACKEND_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;
const BACKEND_CA_PATH =
  process.env.BACKEND_CA_PATH || process.env.SSL_CERT_FILE || "";
const BACKEND_ALLOW_SELF_SIGNED =
  String(process.env.BACKEND_ALLOW_SELF_SIGNED || "true").toLowerCase() ===
  "true";

declare global {
  // eslint-disable-next-line no-var
  var __vcepDashboardPool: Pool | undefined;
}

const S3_ASSETS_BASE = (
  process.env.ASSETS_PUBLIC_BASE ||
  process.env.S3_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
  "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com"
).replace(/\/+$/, "");

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
    } catch { }
  }

  const idToken = readCookie(cookieHeader, "vcep_id");
  const accessToken = readCookie(cookieHeader, "vcep_access");
  if (!idToken) return null;

  return { idToken, accessToken: accessToken || "" };
}

function stripPgSslParams(connectionString: string) {
  try {
    const url = new URL(connectionString);
    ["sslmode", "sslcert", "sslkey", "sslrootcert"].forEach((k) =>
      url.searchParams.delete(k)
    );
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
  if (global.__vcepDashboardPool) return global.__vcepDashboardPool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };

  global.__vcepDashboardPool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  return global.__vcepDashboardPool;
}

function getBackendAgent(target: URL) {
  if (target.protocol !== "https:") return undefined;

  const ca =
    BACKEND_CA_PATH && fs.existsSync(BACKEND_CA_PATH)
      ? fs.readFileSync(BACKEND_CA_PATH, "utf8")
      : undefined;

  return new https.Agent({
    ca,
    rejectUnauthorized: ca ? true : !BACKEND_ALLOW_SELF_SIGNED,
  });
}

async function requestBackendJson(path: string, accessToken: string) {
  const target = new URL(path, BACKEND_URL);
  const isHttps = target.protocol === "https:";
  const client = isHttps ? https : http;

  return new Promise<any>((resolve, reject) => {
    const req = client.request(
      target,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        agent: getBackendAgent(target),
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          const status = res.statusCode || 500;
          let parsed: any = raw;
          try {
            parsed = JSON.parse(raw);
          } catch { }

          if (status < 200 || status >= 300) {
            const message =
              (parsed && typeof parsed === "object" && (parsed.message || parsed.error)) ||
              (typeof parsed === "string" && parsed) ||
              `Backend error ${status}`;
            reject(new Error(String(message)));
            return;
          }
          resolve(parsed);
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function toStr(v: unknown, fallback = "") {
  return String(v ?? "").trim() || fallback;
}

function toNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonObject(v: unknown): Record<string, unknown> {
  if (!v) return {};
  if (typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  try {
    const p = JSON.parse(String(v));
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

function toPublicAssetUrl(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${S3_ASSETS_BASE}/${raw.replace(/^\/+/, "")}`;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(v: string) {
  return UUID_REGEX.test(v);
}

function normalizeOrg(orgRaw: any, fallbackEmail: string) {
  const contact = parseJsonObject(orgRaw?.contact);
  const social = parseJsonObject(orgRaw?.social_links);

  return {
    orgId: toStr(orgRaw?.org_id),
    orgName: toStr(orgRaw?.org_name, "Organization"),
    aboutUs: toStr(orgRaw?.about_org),
    companySize: toStr(orgRaw?.size),
    businessType:
      toStr(contact?.businessType) ||
      toStr(contact?.business_type) ||
      toStr(orgRaw?.business_type),
    location:
      toStr(contact?.location) ||
      toStr(contact?.address) ||
      toStr(orgRaw?.building_id),
    email: toStr(contact?.email, fallbackEmail),
    phone: toStr(contact?.phone),
    website: toStr(orgRaw?.website_url),
    logoPreview: toPublicAssetUrl(orgRaw?.logo),
    buildingId: toStr(orgRaw?.building_id),
    buildingName: toStr(orgRaw?.building_name),
    positionX: toNum(orgRaw?.position_x),
    positionY: toNum(orgRaw?.position_y),
    linkedin: toStr(social?.linkedin) || toStr(contact?.linkedin),
    facebook: toStr(social?.facebook) || toStr(contact?.facebook),
    instagram: toStr(social?.instagram) || toStr(contact?.instagram),
    youtube: toStr(social?.youtube) || toStr(contact?.youtube),
    tiktok: toStr(social?.tiktok) || toStr(contact?.tiktok),
  };
}

function deriveActivityKindLabel(value: unknown) {
  const raw = toStr(value).toLowerCase();
  if (raw.includes("meeting")) return "Meetings";
  if (raw.includes("course")) return "Courses";
  return "Challenges";
}

function deriveActivityCategory(value: unknown) {
  const raw = toStr(value).toLowerCase();
  if (raw.includes("meeting")) return "Meeting";
  if (raw.includes("course")) return "Course";
  return "Challenge";
}

function deriveStatusTone(value: unknown) {
  const raw = toStr(value, "pending").toLowerCase();
  if (
    raw.includes("end") ||
    raw.includes("close") ||
    raw.includes("finish") ||
    raw.includes("complete")
  ) {
    return "ended" as const;
  }

  if (
    raw.includes("join") ||
    raw.includes("open") ||
    raw.includes("active") ||
    raw.includes("publish") ||
    raw.includes("public") ||
    raw.includes("scheduled")
  ) {
    return "join" as const;
  }

  return "pending" as const;
}

function toTitleCaseStatus(value: unknown) {
  const raw = toStr(value, "pending")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return "Pending";
  return raw
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function pickDifficulty(...values: unknown[]) {
  for (const value of values) {
    const text = toStr(value);
    if (text) return text;
  }
  return "-";
}

function normalizeActivityRecord(item: any, index: number) {
  const commonInfo = parseJsonObject(item?.commonInfo ?? item?.common_info);
  const activityDetail = parseJsonObject(
    item?.activity_detail ??
    item?.activityDetail ??
    commonInfo?.activity_detail ??
    commonInfo?.activityDetail
  );
  const challengeInfo = parseJsonObject(item?.challenge_info ?? item?.challenge ?? item?.challengeInfo);
  // level จาก LEFT JOIN challenge table
  const joinedLevel = String(item?.challenge_level ?? "").trim();
  const courseInfo = parseJsonObject(item?.course ?? item?.courseInfo);
  const meetingInfo = parseJsonObject(item?.meeting ?? item?.meetingInfo);

  const rawType =
    toStr(item?.activity_type) ||
    toStr(commonInfo?.activity_type) ||
    toStr(activityDetail?.activity_type) ||
    toStr(item?.kind) ||
    toStr(item?.category);

  const rawStatus =
    toStr(item?.activity_status) ||
    toStr(commonInfo?.activity_status) ||
    toStr(activityDetail?.activity_status) ||
    toStr(item?.status) ||
    toStr(item?.activity_visibility) ||
    toStr(commonInfo?.activity_visibility) ||
    toStr(activityDetail?.activity_visibility) ||
    "pending";

  return {
    id: toStr(
      item?.activity_id ?? item?.id ?? commonInfo?.activity_id,
      `activity-${index}`
    ),
    title: toStr(
      item?.activity_name ??
      commonInfo?.activity_name ??
      item?.title ??
      item?.name,
      "Activity"
    ),
    difficulty: pickDifficulty(
      joinedLevel,
      item?.difficulty,
      item?.level,
      challengeInfo?.difficulty,
      challengeInfo?.level,
      courseInfo?.difficulty,
      courseInfo?.level,
      meetingInfo?.difficulty,
      meetingInfo?.level,
      activityDetail?.difficulty,
      activityDetail?.level
    ),
    category: deriveActivityCategory(rawType),
    kind: deriveActivityKindLabel(rawType),
    xp: toNum(
      item?.xp_reward ??
      item?.xp ??
      item?.activity_hours ??
      item?.hours ??
      activityDetail?.xp_reward ??
      activityDetail?.xp ??
      activityDetail?.activity_hours ??
      activityDetail?.hours ??
      commonInfo?.xp_reward ??
      commonInfo?.xp ??
      commonInfo?.activity_hours ??
      commonInfo?.hours ??
      0,
      0
    ),
    status: rawStatus,
    statusTone: deriveStatusTone(rawStatus),
    statusLabel: toTitleCaseStatus(rawStatus),
  };
}

async function loadActivitiesFromDatabase(pool: Pool, orgId: string) {
  const dbRes = await pool.query(
    `SELECT
       a.*,
       c.level       AS challenge_level,
       c.problem_statement,
       c.description AS challenge_description,
       c.submit_type
     FROM activities a
     LEFT JOIN challenge c ON c.activity_id = a.activity_id
     WHERE a.creator_org_id = $1
     ORDER BY a.activity_id DESC`,
    [orgId]
  );

  return dbRes.rows.map((row: any, index: number) => normalizeActivityRecord(row, index));
}

async function countParticipants(pool: Pool, orgId: string) {
  const queries = [
    {
      text: `SELECT COUNT(DISTINCT ar.user_id) AS cnt
             FROM activity_registrations ar
             JOIN activities a ON a.activity_id = ar.activity_id
             WHERE a.creator_org_id = $1`,
      values: [orgId],
    },
    {
      text: `SELECT COUNT(*) AS cnt
             FROM activity_registrations ar
             JOIN activities a ON a.activity_id = ar.activity_id
             WHERE a.creator_org_id = $1`,
      values: [orgId],
    },
  ];

  for (const query of queries) {
    try {
      const res = await pool.query(query.text, query.values);
      return toNum(res.rows?.[0]?.cnt, 0);
    } catch {
      continue;
    }
  }

  return 0;
}

export async function GET(req: Request) {
  try {
    const sess = getSessionTokens(req);
    const idToken = sess?.idToken;
    const accessToken = (sess as any)?.accessToken || "";

    if (!idToken) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const payload = decodeJwt(idToken);
    const cognitoUserId = String(payload.sub || "");
    const tokenRole = String(payload["custom:role"] || "").toLowerCase();
    const emailFromToken = String(payload.email || "").toLowerCase();
    const orgIdFromToken = String(payload["custom:orgId"] || "");

    if (!cognitoUserId) {
      return NextResponse.json(
        { ok: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    const pool = getPool();

    const userRes = await pool.query(
      `SELECT user_id, email, role, status
       FROM users
       WHERE cognito_user_id = $1 OR lower(email) = lower($2)
       ORDER BY CASE WHEN cognito_user_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [cognitoUserId, emailFromToken]
    );

    const user = userRes.rows[0];
    if (!user?.user_id) {
      return NextResponse.json(
        { ok: false, message: "User not found" },
        { status: 404 }
      );
    }

    const resolvedRole = String(user.role || tokenRole || "").toLowerCase();
    if (resolvedRole !== "employee") {
      return NextResponse.json(
        { ok: false, message: "Only employee accounts can access this route" },
        { status: 403 }
      );
    }

    const empRes = await pool.query(
      `SELECT emp_id, org_id, first_name, last_name, position, phone,
              avatar_choice, is_reviewer
       FROM employees
       WHERE user_id = $1
       LIMIT 1`,
      [user.user_id]
    );

    const employee = empRes.rows[0] || null;

    const resolvedOrgId = (() => {
      const fromEmp = toStr(employee?.org_id);
      if (fromEmp && isValidUuid(fromEmp)) return fromEmp;
      const fromToken = toStr(orgIdFromToken);
      if (fromToken && isValidUuid(fromToken)) return fromToken;
      return "";
    })();

    if (!resolvedOrgId) {
      return NextResponse.json(
        { ok: false, message: "Organization not found for this employee" },
        { status: 404 }
      );
    }

    let orgRaw: any = null;
    try {
      orgRaw = await requestBackendJson(
        `/org/${encodeURIComponent(resolvedOrgId)}`,
        accessToken
      );
    } catch {
      orgRaw = null;
    }

    const org = orgRaw
      ? normalizeOrg(orgRaw, String(user.email || emailFromToken))
      : null;

    let buildingRow: any = null;
    const buildingId = toStr(orgRaw?.building_id);
    if (buildingId && isValidUuid(buildingId)) {
      try {
        const bRes = await pool.query(
          `SELECT building_id, building_name, building_model,
                  preview_url, unlock_level
           FROM building
           WHERE building_id = $1
           LIMIT 1`,
          [buildingId]
        );
        buildingRow = bRes.rows[0] || null;
      } catch {
        buildingRow = null;
      }
    }

    const allEmpsRes = await pool.query(
      `SELECT e.emp_id, e.user_id, e.org_id,
              e.first_name, e.last_name, e.position, e.phone,
              e.avatar_choice, e.is_reviewer,
              u.email
       FROM employees e
       LEFT JOIN users u ON u.user_id = e.user_id
       WHERE e.org_id = $1
       ORDER BY e.first_name, e.last_name`,
      [resolvedOrgId]
    );

    const employees = allEmpsRes.rows.map((e: any) => ({
      id: toStr(e.emp_id),
      empId: toStr(e.emp_id),
      userId: toStr(e.user_id),
      orgId: toStr(e.org_id),
      firstName: toStr(e.first_name),
      lastName: toStr(e.last_name),
      position: toStr(e.position),
      phone: toStr(e.phone),
      email: toStr(e.email).toLowerCase(),
      canCheckChallenge: Boolean(e.is_reviewer),
      avatarChoice: toStr(e.avatar_choice),
      avatarId: toStr(e.avatar_choice),
      avatarIndex: 0,
    }));

    const activities = await loadActivitiesFromDatabase(pool, resolvedOrgId);
    const totalParticipants = await countParticipants(pool, resolvedOrgId);

    const published = activities.filter(
      (a) =>
        a.status === "published" ||
        a.status === "public" ||
        a.statusTone === "join"
    ).length;
    const draft = Math.max(0, activities.length - published);
    const meetings = activities.filter((a) => a.kind === "Meetings").length;
    const courses = activities.filter((a) => a.kind === "Courses").length;
    const challenges = activities.filter((a) => a.kind === "Challenges").length;

    const summary = {
      totalActivities: activities.length,
      totalParticipants,
      meetings,
      courses,
      challenges,
      published,
      draft,
    };

    return NextResponse.json({
      ok: true,
      data: {
        org,
        summary,
        employees,
        activities,
        building: (() => {
          if (!buildingRow) return null;
          const rawModel = toStr(buildingRow.building_model).replace(/^\/+/, "");
          const rawPreview = toStr(buildingRow.preview_url);
          const buildingName = toStr(buildingRow.building_name);

          const modelUrl = rawModel
            ? `${S3_ASSETS_BASE}/${rawModel}`
            : null;

          const previewUrl = rawPreview
            ? (/^https?:\/\//i.test(rawPreview)
              ? rawPreview
              : `${S3_ASSETS_BASE}/${rawPreview.replace(/^\/+/, "")}`)
            : buildingName
              ? `${S3_ASSETS_BASE}/building-previews/${buildingName}.png`
              : null;

          return {
            buildingId: toStr(buildingRow.building_id),
            buildingName,
            modelUrl,
            previewUrl,
          };
        })(),
        account: {
          userId: toStr(user.user_id),
          empId: toStr(employee?.emp_id),
          email: toStr(user.email || emailFromToken),
          role: resolvedRole,
          orgId: resolvedOrgId,
        },
        participants: [],
        participantBars: [],
        skillBars: [],
      },
    });
  } catch (error: any) {
    const message = error?.message || "Server error";
    const status =
      message === "Unauthorized" || message === "Invalid token"
        ? 401
        : message === "Only employee accounts can access this route"
          ? 403
          : message.includes("not found")
            ? 404
            : 500;

    return NextResponse.json({ ok: false, message }, { status });
  }
}