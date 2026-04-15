import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BACKEND = process.env.BACKEND_URL!;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const S3_BUCKET = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET!;
const S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL || process.env.ASSETS_PUBLIC_BASE!;
const S3_REGION = process.env.S3_REGION || process.env.AWS_REGION!;

type SessionTokens = {
  accessToken: string;
  idToken: string;
};

const s3 = new S3Client({
  region: S3_REGION,
});

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

function getSessionTokens(req: Request): SessionTokens | null {
  const cookieHeader = req.headers.get("cookie");
  const raw = readCookie(cookieHeader, COOKIE_NAME);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        accessToken?: string;
        idToken?: string;
      };

      if (parsed?.accessToken && parsed?.idToken) {
        return {
          accessToken: parsed.accessToken,
          idToken: parsed.idToken,
        };
      }
    } catch { }
  }

  const accessToken = readCookie(cookieHeader, "vcep_access");
  const idToken = readCookie(cookieHeader, "vcep_id");

  if (!accessToken || !idToken) return null;

  return { accessToken, idToken };
}

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const raw = await res.text();
  let json: any = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }

  if (!res.ok) {
    throw new Error(
      `${url} failed: ${res.status} ${typeof json === "string" ? json : JSON.stringify(json)}`
    );
  }

  return json;
}

async function getStdId(accessToken: string, idToken: string) {
  const jwt = decodeJwt(idToken);

  const userJson = await fetchJson(`${BACKEND}/auth/all`, accessToken);
  const users = safeArray<any>(
    Array.isArray(userJson)
      ? userJson
      : Array.isArray(userJson?.data)
        ? userJson.data
        : Array.isArray(userJson?.users)
          ? userJson.users
          : []
  );

  const user = users.find(
    (u) => u?.cognito_user_id === jwt.sub || u?.cognitoUserId === jwt.sub
  );

  if (!user?.user_id) return null;

  const studentJson = await fetchJson(`${BACKEND}/student/all`, accessToken);
  const students = safeArray<any>(
    Array.isArray(studentJson)
      ? studentJson
      : Array.isArray(studentJson?.data)
        ? studentJson.data
        : Array.isArray(studentJson?.students)
          ? studentJson.students
          : []
  );

  return students.find((s) => s?.user_id === user.user_id)?.std_id ?? null;
}

export async function POST(req: Request) {
  try {
    const sess = getSessionTokens(req);
    if (!sess) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const stdId = await getStdId(sess.accessToken, sess.idToken);
    if (!stdId) {
      return NextResponse.json(
        { ok: false, message: "Student not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();

    const activityId = formData.get("activity_id") as string;
    const textSubmission = formData.get("description") as string || "";
    const qrData = formData.get("qrdata") as string || "";
    const isFileUpdateStr = formData.get("is_file_update") as string;
    const isFileUpdate = isFileUpdateStr === "true";
    let fileSubmissionUrl = formData.get("file_submission") as string || "";
    const file = formData.get("file") as File | null;

    if (isFileUpdate) {
      if (file && file.size > 0) {
        const jwt = decodeJwt(sess.idToken);
        const cognitoUserId = jwt.sub;
        const key = `student-files/${cognitoUserId}/${Date.now()}_${file.name}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: file.type,
            CacheControl: "no-cache, no-store, must-revalidate",
          })
        );

        const version = Date.now();
        fileSubmissionUrl = `${S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}?v=${version}`;
      }
    }

    // example payload
    // {
    //   "activity_id": "123e4567-e89b-12d3-a456-426614174000",
    //   "qrcode_checkin": "X123",
    //   "std_id": "123e4567-e89b-12d3-a456-426614174000"
    // }

    const payload = {
      activity_id: activityId,
      qrcode_checkin: qrData,
      std_id: stdId,
    };

    const res = await fetch(`${BACKEND}/activity/submission/meeting`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sess.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to submit meeting: ${errText}`);
    }

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      data: data || {},
    });
  } catch (e: any) {
    console.error("Error submitting meeting:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Server Error" },
      { status: 500 }
    );
  }
}
