import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

const BACKEND = process.env.BACKEND_URL!;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";

type SessionTokens = {
  accessToken: string;
  idToken: string;
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
    } catch {}
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
      accept: "application/json",
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
      `${url} failed: ${res.status} ${
        typeof json === "string" ? json : JSON.stringify(json)
      }`
    );
  }

  return json;
}

async function postJson(url: string, accessToken: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
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
      `${url} failed: ${res.status} ${
        typeof json === "string" ? json : JSON.stringify(json)
      }`
    );
  }

  return json;
}

async function findBackendUserByCognitoSub(
  cognitoSub: string,
  accessToken: string
) {
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

  return (
    users.find(
      (user) =>
        String(user?.cognito_user_id ?? "") === cognitoSub ||
        String(user?.cognitoUserId ?? "") === cognitoSub
    ) ?? null
  );
}

async function findStudentByUserId(userId: string, accessToken: string) {
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

  return (
    students.find((student) => String(student?.user_id ?? "") === userId) ?? null
  );
}

export async function POST(req: Request) {
  try {
    const sess = getSessionTokens(req);
    if (!sess?.idToken || !sess?.accessToken) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const activityId = String(body?.activity_id ?? "").trim();

    if (!activityId) {
      return NextResponse.json(
        { ok: false, message: "Activity ID is required" },
        { status: 400 }
      );
    }

    const jwt = decodeJwt(sess.idToken);
    const cognitoUserId = String(jwt?.sub ?? "").trim();

    if (!cognitoUserId) {
      return NextResponse.json(
        { ok: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    const backendUser = await findBackendUserByCognitoSub(
      cognitoUserId,
      sess.accessToken
    );

    if (!backendUser?.user_id) {
      return NextResponse.json(
        { ok: false, message: "Backend user not found" },
        { status: 404 }
      );
    }

    const student = await findStudentByUserId(backendUser.user_id, sess.accessToken);
    if (!student?.std_id) {
      return NextResponse.json(
        { ok: false, message: "Student profile not found" },
        { status: 404 }
      );
    }

    let result: any;
    try {
      result = await postJson(`${BACKEND}/activity/register`, sess.accessToken, {
        activity_id: activityId,
        student_id: String(student.std_id),
      });
    } catch (registerError: any) {
      const msg = String(registerError?.message ?? "").toLowerCase();
      const isAlreadyRegistered =
        msg.includes("already") ||
        msg.includes("duplicate") ||
        msg.includes("registered") ||
        msg.includes("409");

      if (isAlreadyRegistered) {
        return NextResponse.json({
          ok: false,
          already_registered: true,
          message: "Already registered for this activity",
        });
      }
      throw registerError;
    }

    return NextResponse.json({
      ok: true,
      data: result,
      student_id: String(student.std_id),
      activity_id: activityId,
    });
  } catch (error: any) {
    console.error("POST /api/student/explore/register failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Failed to register activity",
      },
      { status: 500 }
    );
  }
}