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

    const body = await req.json();
    const payload = {
      ...body,
      std_id: stdId,
    };

    const res = await fetch(`${BACKEND}/activity/submission/quiz`, {
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
      throw new Error(`Failed to submit quiz: ${errText}`);
    }

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      data: data || {},
    });
  } catch (e: any) {
    console.error("Error submitting quiz:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Server Error" },
      { status: 500 }
    );
  }
}
