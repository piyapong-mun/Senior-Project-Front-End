import fs from "fs";
import crypto from "crypto";
import { decodeJwt } from "jose";
import { Pool } from "pg";

const BACKEND = process.env.BACKEND_URL!;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;

export type SessionTokens = {
  idToken: string;
  accessToken: string;
};

export type BackendUserRow = {
  user_id?: string;
  cognito_user_id?: string;
  email?: string;
  role?: string;
  status?: string;
  is_email_verified?: boolean;
};

export type EmployeeRow = {
  emp_id: string;
  user_id: string;
  org_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  avatar_choice: string | null;
  can_check_challenge: boolean | null;
  is_profile_complete: boolean | null;
};

export type EmployeeContext = {
  accessToken: string;
  idToken: string;
  cognitoUserId: string;
  role: string;
  emailFromToken: string;
  orgIdFromToken: string | null;
  backendUser: BackendUserRow | null;
  employee: EmployeeRow | null;
  userId: string | null;
  empId: string | null;
  orgId: string | null;
  email: string | null;
};

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

export function getSessionTokens(req: Request): SessionTokens | null {
  const cookieHeader = req.headers.get("cookie");

  const raw = readCookie(cookieHeader, COOKIE_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        idToken?: string;
        accessToken?: string;
      };
      if (parsed?.idToken && parsed?.accessToken) {
        return { idToken: parsed.idToken, accessToken: parsed.accessToken };
      }
    } catch {
      // ignore malformed session cookie and try the fallback cookies below
    }
  }

  const idToken = readCookie(cookieHeader, "vcep_id");
  const accessToken = readCookie(cookieHeader, "vcep_access");

  if (!idToken || !accessToken) return null;
  return { idToken, accessToken };
}

declare global {
  // eslint-disable-next-line no-var
  var __vcepOrgPool: Pool | undefined;
}

export function getPool() {
  if (global.__vcepOrgPool) return global.__vcepOrgPool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH).toString() }
      : { rejectUnauthorized: false };

  global.__vcepOrgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl,
  });

  return global.__vcepOrgPool;
}

export function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

export function toPublicAssetUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const base =
    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
    process.env.S3_PUBLIC_BASE_URL ||
    "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com";

  return `${base.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`;
}

export async function fetchJson(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: init?.body,
    cache: "no-store",
  });

  const raw = await response.text().catch(() => "");
  let json: any = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }

  if (!response.ok) {
    throw new Error(
      `${url} failed: ${response.status} ${typeof json === "string" ? json : JSON.stringify(json)}`
    );
  }

  return json;
}

export async function findBackendUserByCognitoSub(
  cognitoSub: string,
  accessToken: string
): Promise<BackendUserRow | null> {
  const json = await fetchJson(`${BACKEND}/auth/all`, accessToken);
  const users = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.users)
        ? json.users
        : [];

  return (
    users.find(
      (user: any) =>
        String(user?.cognito_user_id || "") === cognitoSub ||
        String(user?.cognitoUserId || "") === cognitoSub
    ) ?? null
  );
}

export async function findBackendUserByEmailOrSub(params: {
  email?: string | null;
  cognitoSub?: string | null;
  accessToken: string;
}): Promise<BackendUserRow | null> {
  const json = await fetchJson(`${BACKEND}/auth/all`, params.accessToken);
  const users = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.users)
        ? json.users
        : [];

  const emailNeedle = String(params.email || "").trim().toLowerCase();
  const subNeedle = String(params.cognitoSub || "").trim();

  return (
    users.find((user: any) => {
      const email = String(user?.email || "").trim().toLowerCase();
      const sub = String(user?.cognito_user_id || user?.cognitoUserId || "").trim();
      return (emailNeedle && email === emailNeedle) || (subNeedle && sub === subNeedle);
    }) ?? null
  );
}

export async function findEmployeeByUserId(userId: string): Promise<EmployeeRow | null> {
  const pool = getPool();
  const result = await pool.query<EmployeeRow>(
    `
      SELECT
        emp_id,
        user_id,
        org_id,
        first_name,
        last_name,
        position,
        phone,
        email,
        avatar_choice,
        can_check_challenge,
        is_profile_complete
      FROM employees
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function listEmployeesByOrgId(orgId: string): Promise<EmployeeRow[]> {
  const pool = getPool();
  const result = await pool.query<EmployeeRow>(
    `
      SELECT
        emp_id,
        user_id,
        org_id,
        first_name,
        last_name,
        position,
        phone,
        email,
        avatar_choice,
        can_check_challenge,
        is_profile_complete
      FROM employees
      WHERE org_id = $1
      ORDER BY created_at ASC NULLS LAST, emp_id ASC
    `,
    [orgId]
  );

  return result.rows;
}

export async function getEmployeeContext(req: Request): Promise<EmployeeContext> {
  const session = getSessionTokens(req);
  if (!session?.idToken || !session?.accessToken) {
    throw new Error("Unauthorized");
  }

  const payload = decodeJwt(session.idToken);
  const cognitoUserId = String(payload.sub || "").trim();
  const role = String(payload["custom:role"] || payload.role || "").trim() || "employee";
  const orgIdFromToken = String(payload["custom:orgId"] || "").trim() || null;
  const emailFromToken = String(payload.email || "").trim().toLowerCase();

  if (!cognitoUserId) {
    throw new Error("Invalid token");
  }

  const backendUser = await findBackendUserByCognitoSub(cognitoUserId, session.accessToken);
  const userId = backendUser?.user_id ? String(backendUser.user_id) : null;
  const employee = userId ? await findEmployeeByUserId(userId) : null;

  return {
    accessToken: session.accessToken,
    idToken: session.idToken,
    cognitoUserId,
    role,
    emailFromToken,
    orgIdFromToken,
    backendUser,
    employee,
    userId,
    empId: employee?.emp_id ?? null,
    orgId: employee?.org_id ?? orgIdFromToken,
    email: employee?.email ?? backendUser?.email ?? emailFromToken ?? null,
  };
}

export function makeTemporaryPassword(length = 16) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const symbol = "!@#$%^&*_-";
  const all = `${upper}${lower}${digit}${symbol}`;

  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digit[Math.floor(Math.random() * digit.length)],
    symbol[Math.floor(Math.random() * symbol.length)],
  ];

  while (required.length < length) {
    const bytes = crypto.randomBytes(1)[0];
    required.push(all[bytes % all.length]);
  }

  return required.sort(() => Math.random() - 0.5).join("");
}

export async function registerBackendUser(payload: {
  user_id: string;
  cognito_user_id: string;
  email: string;
  is_email_verified: boolean;
  role: string;
  status: "pending" | "active";
}) {
  const response = await fetch(`${BACKEND}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text().catch(() => "");
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
    text,
  };
}

export async function upsertEmployeeRow(payload: {
  userId: string;
  orgId: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  avatarChoice?: string | null;
  canCheckChallenge?: boolean | null;
  isProfileComplete?: boolean;
}) {
  const pool = getPool();

  const updateResult = await pool.query<EmployeeRow>(
    `
      UPDATE employees
      SET
        org_id = $2,
        first_name = $3,
        last_name = $4,
        position = $5,
        phone = $6,
        email = $7,
        avatar_choice = $8,
        can_check_challenge = $9,
        is_profile_complete = $10,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING
        emp_id,
        user_id,
        org_id,
        first_name,
        last_name,
        position,
        phone,
        email,
        avatar_choice,
        can_check_challenge,
        is_profile_complete
    `,
    [
      payload.userId,
      payload.orgId,
      payload.firstName ?? null,
      payload.lastName ?? null,
      payload.position ?? null,
      payload.phone ?? null,
      payload.email ?? null,
      payload.avatarChoice ?? null,
      payload.canCheckChallenge ?? false,
      payload.isProfileComplete ?? false,
    ]
  );

  if (updateResult.rows[0]) {
    return updateResult.rows[0];
  }

  const empId = crypto.randomUUID();
  const insertResult = await pool.query<EmployeeRow>(
    `
      INSERT INTO employees (
        emp_id,
        user_id,
        org_id,
        first_name,
        last_name,
        position,
        phone,
        email,
        avatar_choice,
        can_check_challenge,
        is_profile_complete,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING
        emp_id,
        user_id,
        org_id,
        first_name,
        last_name,
        position,
        phone,
        email,
        avatar_choice,
        can_check_challenge,
        is_profile_complete
    `,
    [
      empId,
      payload.userId,
      payload.orgId,
      payload.firstName ?? null,
      payload.lastName ?? null,
      payload.position ?? null,
      payload.phone ?? null,
      payload.email ?? null,
      payload.avatarChoice ?? null,
      payload.canCheckChallenge ?? false,
      payload.isProfileComplete ?? false,
    ]
  );

  return insertResult.rows[0];
}
