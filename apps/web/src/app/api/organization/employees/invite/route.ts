import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const orgId = String(body.orgId || "");
    const createdByUserId = String(body.createdByUserId || ""); // ✅ ส่งมาจาก frontend (เอาจาก active-account)
    const email = String(body.email || "").trim().toLowerCase();
    const employeeSlot = Number(body.employeeSlot || 0); // 2 หรือ 3

    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const position = String(body.position || "").trim();
    const phone = String(body.phone || "").trim();
    const avatarId = String(body.avatarId || ""); // ✅ uuid
    const canCheckChallenge = !!body.canCheckChallenge;

    if (!orgId || !createdByUserId) {
      return NextResponse.json({ ok: false, message: "missing orgId/createdByUserId" }, { status: 400 });
    }
    if (!email || !firstName || !lastName) {
      return NextResponse.json({ ok: false, message: "missing fields" }, { status: 400 });
    }
    if (![2, 3].includes(employeeSlot)) {
      return NextResponse.json({ ok: false, message: "employeeSlot must be 2 or 3" }, { status: 400 });
    }
    if (!avatarId) {
      return NextResponse.json({ ok: false, message: "missing avatarId" }, { status: 400 });
    }

    // 1) generate token + hash
    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = sha256(token);

    // 7 days expiry
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 2) create cognito user (optional แต่แนะนำ)
    // NOTE: ถ้า user มีอยู่แล้ว อาจ throw UsernameExistsException
    let cognitoSub: string | null = null;
    try {
      const r = await cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: email,
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
            { Name: "custom:role", Value: "employee" },
            { Name: "custom:orgId", Value: orgId },
          ],
          // ให้คุณส่งอีเมลเองภายหลัง (accept-invite) — ไม่ส่ง temp password
          MessageAction: "SUPPRESS",
        })
      );
      cognitoSub = r.User?.Attributes?.find((a) => a.Name === "sub")?.Value ?? null;
    } catch (e: any) {
      // ถ้าซ้ำ ให้ไปต่อ (ยัง invite ได้)
      if (e?.name !== "UsernameExistsException") {
        console.error("AdminCreateUser error:", e);
        return NextResponse.json({ ok: false, message: e?.message || "cognito create failed" }, { status: 500 });
      }
    }

    // 3) insert invitation (กันซ้ำ slot เดิมของ org เดิม)
    await pool.query(
      `INSERT INTO employee_invitations
       (invite_id, org_id, email, token_hash, expires_at, used_at, created_by_user_id, cognito_sub, employee_slot, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NULL, $5, $6, $7, NOW())
       ON CONFLICT (org_id, employee_slot)
       DO UPDATE SET
         email = EXCLUDED.email,
         token_hash = EXCLUDED.token_hash,
         expires_at = EXCLUDED.expires_at,
         used_at = NULL,
         created_by_user_id = EXCLUDED.created_by_user_id,
         cognito_sub = EXCLUDED.cognito_sub,
         created_at = NOW()`,
      [orgId, email, tokenHash, expiresAt, createdByUserId, cognitoSub, employeeSlot]
    );

    // 4) ส่งกลับ invite link ให้ frontend
    const inviteLink = `${process.env.APP_BASE_URL}/auth/accept-invite?token=${token}&email=${encodeURIComponent(email)}`;

    return NextResponse.json({ ok: true, inviteLink });
  } catch (e: any) {
    console.error("invite ERROR:", e);
    return NextResponse.json({ ok: false, message: e?.message || "invite failed" }, { status: 500 });
  }
}