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
  var __vcepOrganizationPool: Pool | undefined;
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));
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
      const parsed = JSON.parse(raw) as {
        idToken?: string;
        accessToken?: string;
        refreshToken?: string;
      };

      if (parsed?.idToken) {
        return {
          idToken: parsed.idToken,
          accessToken: parsed.accessToken || "",
          refreshToken: parsed.refreshToken,
        };
      }
    } catch {}
  }

  const idToken = readCookie(cookieHeader, "vcep_id");
  const accessToken = readCookie(cookieHeader, "vcep_access");

  if (!idToken) return null;

  return {
    idToken,
    accessToken: accessToken || "",
  };
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
  if (global.__vcepOrganizationPool) return global.__vcepOrganizationPool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };

  global.__vcepOrganizationPool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  return global.__vcepOrganizationPool;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseJsonObject(value: unknown) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toPublicAssetUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (
    String(process.env.ASSETS_PUBLIC_BASE || "").trim() ||
    String(process.env.S3_PUBLIC_BASE_URL || "").trim() ||
    String(process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || "").trim()
  ).replace(/\/$/, "");

  if (!base) return raw;
  return `${base}/${raw.replace(/^\/+/, "")}`;
}

// ─── contact ต้องเป็น JSON STRING ตาม Swagger spec ──────────────────────────
// Swagger: "contact": "{ \"email\": \"...\", \"phone\": \"...\" }"
function buildContact(body: any, fallbackEmail: string): string {
  return JSON.stringify({
    email: toStringValue(body?.email, fallbackEmail),
    phone: toStringValue(body?.phone),
    location: toStringValue(body?.location),
    businessType: toStringValue(body?.businessType),
    linkedin: toStringValue(body?.linkedin),
    facebook: toStringValue(body?.facebook),
    instagram: toStringValue(body?.instagram),
    youtube: toStringValue(body?.youtube),
    tiktok: toStringValue(body?.tiktok),
  });
}

function normalizeOrg(orgRaw: any, fallbackEmail: string) {
  const contact = parseJsonObject(orgRaw?.contact);
  const social = parseJsonObject(orgRaw?.social_links);

  return {
    orgId: toStringValue(orgRaw?.org_id),
    orgName: toStringValue(orgRaw?.org_name, "Organization"),
    aboutUs: toStringValue(orgRaw?.about_org),
    companySize: toStringValue(orgRaw?.size),
    businessType:
      toStringValue(contact?.businessType) ||
      toStringValue(contact?.business_type) ||
      toStringValue(orgRaw?.business_type),
    location:
      toStringValue(contact?.location) ||
      toStringValue(contact?.address) ||
      toStringValue(orgRaw?.building_id),
    email: toStringValue(contact?.email, fallbackEmail),
    phone: toStringValue(contact?.phone),
    website: toStringValue(orgRaw?.website_url),
    logoPreview: toPublicAssetUrl(orgRaw?.logo),
    buildingId: toStringValue(orgRaw?.building_id),
    positionX: toNumber(orgRaw?.position_x),
    positionY: toNumber(orgRaw?.position_y),
    linkedin: toStringValue(social?.linkedin) || toStringValue(contact?.linkedin),
    facebook: toStringValue(social?.facebook) || toStringValue(contact?.facebook),
    instagram:
      toStringValue(social?.instagram) || toStringValue(contact?.instagram),
    youtube: toStringValue(social?.youtube) || toStringValue(contact?.youtube),
    tiktok: toStringValue(social?.tiktok) || toStringValue(contact?.tiktok),
    raw: orgRaw,
  };
}

type EmployeeContext = {
  userId: string;
  empId: string;
  orgId: string;
  email: string;
  emailFromToken: string;
  role: string;
  tokenRole: string;
  accessToken: string;
  needsEmployeeBootstrap: boolean;
};

async function getEmployeeContext(req: Request): Promise<EmployeeContext> {
  const sess = getSessionTokens(req);
  const idToken = sess?.idToken;
  const accessToken = sess?.accessToken || "";

  if (!idToken) {
    throw new Error("Unauthorized");
  }

  const payload = decodeJwt(idToken);
  const cognitoUserId = String(payload.sub || "");
  const tokenRole = String(payload["custom:role"] || "").toLowerCase();
  const emailFromToken = String(payload.email || "").toLowerCase();
  const orgIdFromToken = String(payload["custom:orgId"] || "");

  if (!cognitoUserId) {
    throw new Error("Invalid token");
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
    throw new Error("User not found");
  }

  const resolvedRole = String(user.role || tokenRole || "").toLowerCase();
  if (resolvedRole !== "employee") {
    throw new Error("Only employee accounts can access this route");
  }

  const empRes = await pool.query(
    `
      SELECT emp_id, org_id
      FROM employees
      WHERE user_id = $1
      LIMIT 1
    `,
    [user.user_id]
  );

  const employee = empRes.rows[0] || null;

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const resolvedOrgId = (() => {
    const fromEmp = String(employee?.org_id || "").trim();
    if (fromEmp && UUID_REGEX.test(fromEmp)) return fromEmp;
    const fromToken = String(orgIdFromToken || "").trim();
    if (fromToken && UUID_REGEX.test(fromToken)) return fromToken;
    return "";
  })();

  return {
    userId: String(user.user_id),
    empId: employee?.emp_id ? String(employee.emp_id) : "",
    orgId: resolvedOrgId,
    email: String(user.email || emailFromToken || "").toLowerCase(),
    emailFromToken,
    role: resolvedRole,
    tokenRole,
    accessToken,
    needsEmployeeBootstrap: !employee,
  };
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

async function requestBackendJson(
  path: string,
  accessToken: string,
  init: {
    method?: "GET" | "POST" | "PUT";
    body?: string;
  } = {}
) {
  const target = new URL(path, BACKEND_URL);
  const isHttps = target.protocol === "https:";
  const client = isHttps ? https : http;
  const body = init.body;

  return new Promise<any>((resolve, reject) => {
    const req = client.request(
      target,
      {
        method: init.method || "GET",
        headers: {
          Accept: "application/json",
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }
            : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        agent: getBackendAgent(target),
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const status = res.statusCode || 500;
          const contentType = String(
            res.headers["content-type"] || ""
          ).toLowerCase();

          let parsed: any = raw;
          if (raw && contentType.includes("application/json")) {
            try {
              parsed = JSON.parse(raw);
            } catch {}
          } else if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch {}
          }

          if (status < 200 || status >= 300) {
            const message =
              (parsed &&
                typeof parsed === "object" &&
                (parsed.message || parsed.error ||
                  (Array.isArray(parsed.detail)
                    ? parsed.detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ")
                    : parsed.detail))) ||
              (typeof parsed === "string" && parsed) ||
              `Backend request failed with status ${status}`;
            reject(new Error(String(message)));
            return;
          }

          resolve(parsed);
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function saveOrg(
  accessToken: string,
  body: any,
  orgId: string | null,
  fallbackEmail: string,
  pool: import("pg").Pool
) {
  const logo = toStringValue(body?.logo ?? body?.logoKey);

  // ── Build payload ──────────────────────────────────────────────────────────
  const payload: Record<string, any> = {
    about_org: toStringValue(body?.aboutUs ?? body?.about_org),
    contact: buildContact(body, fallbackEmail),
    org_name: toStringValue(body?.orgName ?? body?.org_name, "Organization"),
    position_x: toNumber(body?.positionX ?? body?.position_x),
    position_y: toNumber(body?.positionY ?? body?.position_y),
    size: toStringValue(body?.companySize ?? body?.size),
    website_url: toStringValue(body?.website ?? body?.website_url),
  };

  if (logo) payload.logo = logo;

  let lastError: Error | null = null;

  if (orgId) {
    // ── Preserve existing building_id from DB to avoid FK violation ─────────
    // building_id is managed separately via the map picker — never overwrite it
    // but PUT /org requires it to be present if the record already has one
    try {
      const existing = await pool.query(
        `SELECT building_id FROM organizations WHERE org_id = $1 LIMIT 1`,
        [orgId]
      );
      const existingBuildingId = existing.rows[0]?.building_id
        ? String(existing.rows[0].building_id)
        : null;
      if (existingBuildingId) {
        payload.building_id = existingBuildingId;
      }
    } catch {
      // non-fatal — proceed without building_id
    }

    // ── Update existing org: PUT /org ───────────────────────────────────────
    try {
      return await requestBackendJson("/org", accessToken, {
        method: "PUT",
        body: JSON.stringify({ ...payload, org_id: orgId }),
      });
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // Fallback to POST if PUT returns error (e.g. org not yet created in backend)
    try {
      return await requestBackendJson("/org", accessToken, {
        method: "POST",
        body: JSON.stringify({ ...payload, org_id: orgId }),
      });
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  } else {
    // ── Create new org: POST /org ───────────────────────────────────────────
    try {
      return await requestBackendJson("/org", accessToken, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("Failed to save organization");
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const context = await getEmployeeContext(req);

    if (!context.orgId) {
      return NextResponse.json(
        { ok: false, message: "Organization not found for this employee" },
        { status: 404 }
      );
    }

    const orgRaw = await requestBackendJson(
      `/org/${encodeURIComponent(context.orgId)}`,
      context.accessToken
    );

    return NextResponse.json({
      ok: true,
      data: {
        organization: normalizeOrg(
          orgRaw,
          context.email || context.emailFromToken || ""
        ),
      },
    });
  } catch (error: any) {
    const message = error?.message || "Server error";
    const status =
      message === "Unauthorized" || message === "Invalid token"
        ? 401
        : message === "Only employee accounts can access this route"
          ? 403
          : message === "Organization not found for this employee"
            ? 404
            : 500;

    return NextResponse.json({ ok: false, message }, { status });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const context = await getEmployeeContext(req);
    const body = await req.json();

    const orgRaw = await saveOrg(
      context.accessToken,
      body,
      toStringValue(body?.orgId || body?.org_id) || context.orgId || null,
      context.email || context.emailFromToken || "",
      getPool()
    );

    return NextResponse.json({
      ok: true,
      data: {
        organization: normalizeOrg(
          orgRaw,
          context.email || context.emailFromToken || ""
        ),
      },
    });
  } catch (error: any) {
    const message = error?.message || "Failed to save organization";
    const status =
      message === "Unauthorized" || message === "Invalid token"
        ? 401
        : message === "Only employee accounts can access this route"
          ? 403
          : 500;

    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function PUT(req: Request) {
  return POST(req);
}