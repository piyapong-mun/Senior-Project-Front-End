import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

export const runtime = "nodejs";

const BACKEND = process.env.BACKEND_URL;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";

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
      };
      if (parsed?.idToken && parsed?.accessToken) return parsed;
    } catch { }
  }

  const idToken = readCookie(cookieHeader, "vcep_id");
  const accessToken = readCookie(cookieHeader, "vcep_access");

  if (!idToken || !accessToken) return null;
  return { idToken, accessToken };
}

async function getEmpId(accessToken: string, idToken: string) {
  const jwt = decodeJwt(idToken);
  const login = await fetch(`${BACKEND}/auth/login`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cognito_user_id: jwt.sub,
    }),
  });

  const raw = await login.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }

  if (login.status === 200 && json?.user_id) {
    const empIdReq = await fetch(`${BACKEND}/org/employee/${json.user_id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const rawEmpId = await empIdReq.text();
    let jsonEmpId: any = null;
    try {
      jsonEmpId = rawEmpId ? JSON.parse(rawEmpId) : null;
    } catch {
      throw new Error("User not found");
    }

    if (empIdReq.status === 200 && jsonEmpId?.org_id) {
      return { empId: jsonEmpId.emp_id, orgId: jsonEmpId.org_id };
    }
  }
  throw new Error("User not found");
}

export async function GET(req: Request) {
  try {
    const sess = getSessionTokens(req);
    const idToken = sess?.idToken;
    const accessToken = sess?.accessToken;

    if (!idToken || !accessToken) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { orgId } = await getEmpId(accessToken, idToken) as any;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, message: "Organization ID not found" },
        { status: 404 }
      );
    }

    const res = await fetch(`${BACKEND}/activity/org/${orgId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const raw = await res.text();
    // console.log(raw);
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      json = raw;
    }

    console.log("json", json);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: json?.message || raw || "Failed to fetch activities" },
        { status: res.status }
      );
    }

    // Attempt to map directly if the backend returns array inside `data` or as root.
    const activities = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);

    return NextResponse.json({
      ok: true,
      data: activities,
    });
  } catch (e: any) {
    console.error(">>> GET ACTIVITIES ROUTE ERROR: ", e?.message);
    return NextResponse.json(
      { ok: false, message: e?.message || "Server Error", stack: e?.stack },
      { status: 500 }
    );
  }
}
