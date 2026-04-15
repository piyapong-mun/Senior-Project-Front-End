import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { Pool, PoolClient } from "pg";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognito } from "@/lib/auth/cognito";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const EMPLOYEE_GROUP_NAME = process.env.COGNITO_EMPLOYEE_GROUP_NAME || "employees";

declare global {
  // eslint-disable-next-line no-var
  var __vcepInviteEmployeePool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __vcepInviteEmployeeColumns: Record<string, Set<string>> | undefined;
}

type EmployeeContext = {
  userId: string;
  orgId: string;
  email: string;
  emailFromToken: string;
  role: string;
  tokenRole: string;
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
  return { idToken, accessToken };
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
  if (global.__vcepInviteEmployeePool) return global.__vcepInviteEmployeePool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };

  global.__vcepInviteEmployeePool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  return global.__vcepInviteEmployeePool;
}

async function getTableColumns(client: PoolClient, tableName: string) {
  if (!global.__vcepInviteEmployeeColumns) {
    global.__vcepInviteEmployeeColumns = {};
  }

  if (global.__vcepInviteEmployeeColumns[tableName]) {
    return global.__vcepInviteEmployeeColumns[tableName];
  }

  const res = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName]
  );

  const columns = new Set<string>(res.rows.map((row) => String(row.column_name)));
  global.__vcepInviteEmployeeColumns[tableName] = columns;
  return columns;
}

function toStringValue(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeEmail(value: unknown) {
  return toStringValue(value).toLowerCase();
}

function avatarChoiceFromIndex(value: unknown) {
  const index = Number(value);
  if (!Number.isFinite(index) || index < 0) return null;
  return `avatar${index + 1}`;
}

function asBool(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    return lowered === "true" || lowered === "1" || lowered === "yes" || lowered === "on";
  }
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getEmployeeContext(req: Request): Promise<EmployeeContext> {
  const session = getSessionTokens(req);
  const idToken = session?.idToken;

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
      SELECT user_id, email, role
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
    throw new Error("Only employee accounts can invite employees");
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
  const orgId = String(employee?.org_id || orgIdFromToken || "");

  return {
    userId: String(user.user_id),
    orgId,
    email: normalizeEmail(user.email || emailFromToken),
    emailFromToken,
    role: resolvedRole,
    tokenRole,
  };
}

function makeTemporaryPassword() {
  const token = Math.random().toString(36).slice(-8);
  return `Tmp!${token}9A`;
}

async function getUserSubByUsername(email: string) {
  const user = await cognito.send(
    new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    })
  );

  return (
    user.UserAttributes?.find((attribute) => attribute.Name === "sub")?.Value ||
    user.Username ||
    null
  );
}

async function ensureCognitoEmployeeAccess(args: { email: string; orgId: string }) {
  const { email, orgId } = args;

  let cognitoSub: string | null = null;
  let temporaryPassword: string | null = null;
  let createdNow = false;

  try {
    temporaryPassword = makeTemporaryPassword();
    const createUserResult = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        TemporaryPassword: temporaryPassword,
        DesiredDeliveryMediums: ["EMAIL"],
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "custom:role", Value: "employee" },
          { Name: "custom:orgId", Value: orgId },
        ],
      })
    );

    createdNow = true;
    cognitoSub =
      createUserResult.User?.Attributes?.find((attribute) => attribute.Name === "sub")?.Value ||
      null;
  } catch (error: any) {
    if (error?.name !== "UsernameExistsException") {
      throw error;
    }
  }

  if (!cognitoSub) {
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "custom:role", Value: "employee" },
          { Name: "custom:orgId", Value: orgId },
        ],
      })
    );

    cognitoSub = await getUserSubByUsername(email);
  }

  if (!cognitoSub) {
    throw new Error("Failed to resolve invited user in Cognito");
  }

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: EMPLOYEE_GROUP_NAME,
    })
  );

  return {
    cognitoSub,
    createdNow,
    temporaryPassword: createdNow ? temporaryPassword : null,
  };
}

async function findUserByEmailOrSub(client: PoolClient, email: string, cognitoSub: string) {
  const res = await client.query(
    `
      SELECT user_id, cognito_user_id, email, role, status
      FROM users
      WHERE cognito_user_id = $1
         OR lower(email) = lower($2)
      ORDER BY CASE WHEN cognito_user_id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [cognitoSub, email]
  );

  return res.rows[0] || null;
}

async function countEmployeesInOrg(client: PoolClient, orgId: string, excludedUserId?: string) {
  if (excludedUserId) {
    const res = await client.query(
      `SELECT COUNT(*)::int AS count FROM employees WHERE org_id = $1 AND user_id <> $2`,
      [orgId, excludedUserId]
    );
    return Number(res.rows[0]?.count || 0);
  }

  const res = await client.query(
    `SELECT COUNT(*)::int AS count FROM employees WHERE org_id = $1`,
    [orgId]
  );
  return Number(res.rows[0]?.count || 0);
}

async function upsertUserRow(args: {
  client: PoolClient;
  cognitoSub: string;
  email: string;
}) {
  const { client, cognitoSub, email } = args;
  const userColumns = await getTableColumns(client, "users");
  const existingUser = await findUserByEmailOrSub(client, email, cognitoSub);
  const userId = String(existingUser?.user_id || (isUuidLike(cognitoSub) ? cognitoSub : randomUUID()));

  if (existingUser?.role && String(existingUser.role).toLowerCase() !== "employee") {
    throw new Error("This email already belongs to a non-employee account");
  }

  if (existingUser) {
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (userColumns.has("cognito_user_id")) {
      updates.push(`cognito_user_id = $${i++}`);
      values.push(cognitoSub);
    }
    if (userColumns.has("email")) {
      updates.push(`email = $${i++}`);
      values.push(email);
    }
    if (userColumns.has("is_email_verified")) {
      updates.push(`is_email_verified = $${i++}`);
      values.push(true);
    }
    if (userColumns.has("role")) {
      updates.push(`role = $${i++}`);
      values.push("employee");
    }
    if (userColumns.has("status")) {
      updates.push(`status = $${i++}`);
      values.push("pending");
    }

    if (updates.length) {
      values.push(userId);
      await client.query(`UPDATE users SET ${updates.join(", ")} WHERE user_id = $${i}`, values);
    }
  } else {
    const cols: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];

    function push(col: string, value: any) {
      if (!userColumns.has(col)) return;
      cols.push(col);
      placeholders.push(`$${values.length + 1}`);
      values.push(value);
    }

    push("user_id", userId);
    push("cognito_user_id", cognitoSub);
    push("email", email);
    push("is_email_verified", true);
    push("role", "employee");
    push("status", "pending");
    push("last_login_at", new Date(0));

    if (!cols.length) {
      throw new Error("Users table schema is not compatible with invite flow");
    }

    await client.query(
      `INSERT INTO users (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
      values
    );
  }

  return userId;
}

async function upsertEmployeeRow(args: {
  client: PoolClient;
  userId: string;
  orgId: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  phone: string;
  avatarChoice: string | null;
  canCheckChallenge: boolean;
}) {
  const {
    client,
    userId,
    orgId,
    email,
    firstName,
    lastName,
    position,
    phone,
    avatarChoice,
    canCheckChallenge,
  } = args;

  const employeeColumns = await getTableColumns(client, "employees");

  let existingEmployee: any = null;
  if (employeeColumns.has("email")) {
    const res = await client.query(
      `
        SELECT *
        FROM employees
        WHERE user_id = $1 OR lower(email) = lower($2)
        ORDER BY CASE WHEN user_id = $1 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [userId, email]
    );
    existingEmployee = res.rows[0] || null;
  } else {
    const res = await client.query(
      `SELECT * FROM employees WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    existingEmployee = res.rows[0] || null;
  }

  if (existingEmployee?.org_id && String(existingEmployee.org_id) !== orgId) {
    throw new Error("This employee already belongs to another organization");
  }

  const currentCount = await countEmployeesInOrg(client, orgId, existingEmployee ? userId : undefined);
  if (!existingEmployee && currentCount >= 3) {
    throw new Error("This organization already has the maximum number of employees");
  }

  const reviewerColumn = employeeColumns.has("can_check_challenge")
    ? "can_check_challenge"
    : employeeColumns.has("is_reviewer")
      ? "is_reviewer"
      : null;

  if (existingEmployee) {
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    function set(col: string, value: any) {
      if (!employeeColumns.has(col)) return;
      updates.push(`${col} = $${i++}`);
      values.push(value);
    }

    set("org_id", orgId);
    set("first_name", firstName);
    set("last_name", lastName);
    set("position", position);
    set("phone", phone);
    set("email", email);
    set("avatar_choice", avatarChoice);
    if (reviewerColumn) {
      updates.push(`${reviewerColumn} = $${i++}`);
      values.push(canCheckChallenge);
    }
    set("is_profile_complete", false);

    if (updates.length) {
      values.push(userId);
      await client.query(`UPDATE employees SET ${updates.join(", ")} WHERE user_id = $${i}`, values);
    }
  } else {
    const cols: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];

    function push(col: string, value: any) {
      if (!employeeColumns.has(col)) return;
      cols.push(col);
      placeholders.push(`$${values.length + 1}`);
      values.push(value);
    }

    push("emp_id", randomUUID());
    push("user_id", userId);
    push("org_id", orgId);
    push("first_name", firstName);
    push("last_name", lastName);
    push("position", position);
    push("phone", phone);
    push("email", email);
    push("avatar_choice", avatarChoice);
    if (reviewerColumn) push(reviewerColumn, canCheckChallenge);
    push("is_profile_complete", false);

    if (!cols.length) {
      throw new Error("Employees table schema is not compatible with invite flow");
    }

    await client.query(
      `INSERT INTO employees (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
      values
    );
  }

  const employeeRes = await client.query(
    `
      SELECT emp_id,
             org_id,
             ${employeeColumns.has("email") ? "email" : "NULL::text AS email"},
             first_name,
             last_name,
             position,
             phone,
             avatar_choice,
             ${employeeColumns.has("can_check_challenge")
      ? "can_check_challenge"
      : employeeColumns.has("is_reviewer")
        ? "is_reviewer AS can_check_challenge"
        : "false AS can_check_challenge"}
      FROM employees
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return employeeRes.rows[0] || null;
}

export async function POST(req: Request) {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    const context = await getEmployeeContext(req);

    if (!context.orgId) {
      return NextResponse.json(
        { ok: false, message: "Create organization before inviting employees" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const firstName = toStringValue(body?.firstName || body?.first_name);
    const lastName = toStringValue(body?.lastName || body?.last_name);
    const position = toStringValue(body?.position);
    const phone = toStringValue(body?.phone);
    const canCheckChallenge = asBool(body?.canCheckChallenge ?? body?.can_check_challenge);
    const avatarChoice =
      toStringValue(body?.avatarChoice || body?.avatar_choice || body?.avatarId) ||
      avatarChoiceFromIndex(body?.avatarIndex);

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { ok: false, message: "Missing required employee fields" },
        { status: 400 }
      );
    }

    if (email === context.email) {
      return NextResponse.json(
        { ok: false, message: "Use save-self for the current employee account" },
        { status: 400 }
      );
    }

    const cognitoResult = await ensureCognitoEmployeeAccess({
      email,
      orgId: context.orgId,
    });

    client = await pool.connect();
    await client.query("BEGIN");

    const userId = await upsertUserRow({
      client,
      cognitoSub: cognitoResult.cognitoSub,
      email,
    });

    const employee = await upsertEmployeeRow({
      client,
      userId,
      orgId: context.orgId,
      email,
      firstName,
      lastName,
      position,
      phone,
      avatarChoice: avatarChoice || null,
      canCheckChallenge,
    });

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      message: cognitoResult.createdNow
        ? "Employee invite sent successfully"
        : "Employee already existed in Cognito and was linked to this organization",
      employee: {
        empId: employee?.emp_id ? String(employee.emp_id) : "",
        orgId: employee?.org_id ? String(employee.org_id) : context.orgId,
        email: String(employee?.email || email),
        firstName: String(employee?.first_name || firstName),
        lastName: String(employee?.last_name || lastName),
        position: String(employee?.position || position),
        phone: String(employee?.phone || phone),
        canCheckChallenge: Boolean(employee?.can_check_challenge ?? canCheckChallenge),
        avatarChoice: String(employee?.avatar_choice || avatarChoice || ""),
      },
      invitedUser: {
        email,
        cognitoSub: cognitoResult.cognitoSub,
        role: "employee",
        orgId: context.orgId,
        cognitoGroup: EMPLOYEE_GROUP_NAME,
      },
      tempPasswordIssued: Boolean(cognitoResult.temporaryPassword),
    });
  } catch (error: any) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch { }
    }

    const message = error?.message || "Failed to invite employee";
    const status =
      message === "Unauthorized" || message === "Invalid token"
        ? 401
        : message === "Only employee accounts can invite employees"
          ? 403
          : message === "Missing required employee fields" ||
            message === "Create organization before inviting employees" ||
            message === "Use save-self for the current employee account" ||
            message === "This organization already has the maximum number of employees" ||
            message === "This email already belongs to a non-employee account" ||
            message === "This employee already belongs to another organization"
            ? 400
            : 500;

    return NextResponse.json({ ok: false, message }, { status });
  } finally {
    client?.release();
  }
}
