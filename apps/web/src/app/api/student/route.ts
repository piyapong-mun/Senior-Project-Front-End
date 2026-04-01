import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

const BACKEND = process.env.BACKEND_URL!;
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

function toInputDate(value: unknown) {
  if (!value) return "";
  const s = String(value).trim();
  if (!s) return "";
  if (s.startsWith("0001-01-01")) return "";
  return s.slice(0, 10);
}

function toBackendDateTime(value: unknown) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  if (s.includes("T")) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00Z`;

  return s;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => String(x ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];

    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
      }
    } catch { }

    if (s.includes(",")) {
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }

    return [s];
  }

  return [];
}

function toJsonString(value: unknown): string {
  if (value === null || value === undefined) return "{}";

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return "{}";

    try {
      JSON.parse(s);
      return s;
    } catch {
      return "{}";
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function parseJsonObject(value: unknown): Record<string, any> {
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
    } catch { }
  }

  return {};
}

function toPublicAvatarUrl(value: unknown): string | null {
  const key = String(value ?? "").trim();
  if (!key) return null;

  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }

  const base =
    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
    process.env.S3_PUBLIC_BASE_URL ||
    "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com";

  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

async function fetchJson(url: string, accessToken: string) {
  const r = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const raw = await r.text();
  let json: any = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }

  if (!r.ok) {
    throw new Error(`${url} failed: ${r.status} ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }

  return json;
}

async function findBackendUserByCognitoSub(
  cognitoSub: string,
  accessToken: string
) {
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
      (u: any) =>
        u?.cognito_user_id === cognitoSub || u?.cognitoUserId === cognitoSub
    ) ?? null
  );
}

async function findStudentByUserId(userId: string, accessToken: string) {
  const json = await fetchJson(`${BACKEND}/student/all`, accessToken);

  const students = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.students)
        ? json.students
        : [];

  return students.find((s: any) => s?.user_id === userId) ?? null;
}

async function findAvatarById(
  avatarId: string | null | undefined,
  accessToken: string
) {
  if (!avatarId) return null;

  const json = await fetchJson(`${BACKEND}/auth/avatar/all`, accessToken);

  const avatars = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.avatars)
        ? json.avatars
        : [];

  return (
    avatars.find(
      (a: any) =>
        a?.avatar_id === avatarId ||
        a?.id === avatarId ||
        a?.avatar_choice === avatarId
    ) ?? null
  );
}

async function findAvatarOptionFromLocalApi(
  req: Request,
  avatarId: string | null | undefined
) {
  if (!avatarId) return null;

  try {
    const url = new URL("/api/options/avatars/student", req.url);
    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
      cache: "no-store",
    });

    if (!r.ok) return null;

    const json = await r.json();
    const items = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : [];

    return items.find((x: any) => x?.id === avatarId) ?? null;
  } catch {
    return null;
  }
}

async function fetchStudentDashboard(stdId: string, accessToken: string) {
  return fetchJson(`${BACKEND}/student/${stdId}/dashboard`, accessToken);
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

    const jwt = decodeJwt(idToken);
    const cognitoUserId = jwt.sub;

    if (!cognitoUserId) {
      return NextResponse.json(
        { ok: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    const backendUser = await findBackendUserByCognitoSub(
      cognitoUserId,
      accessToken
    );

    if (!backendUser?.user_id) {
      return NextResponse.json(
        { ok: false, message: "Backend user not found" },
        { status: 404 }
      );
    }

    const student = await findStudentByUserId(backendUser.user_id, accessToken);

    if (!student?.std_id) {
      return NextResponse.json(
        { ok: false, message: "Student profile not found" },
        { status: 404 }
      );
    }

    const dashboardRaw = await fetchStudentDashboard(student.std_id, accessToken);
    const studentInfo = dashboardRaw?.student_info ?? {};
    const profileObj = parseJsonObject(studentInfo.profile);
    const achievementObj = parseJsonObject(studentInfo.achievement);
    const portfolioObj = parseJsonObject(studentInfo.portfolio);

    const avatar = await findAvatarById(studentInfo.avatar_choice, accessToken);
    const avatarOption = await findAvatarOptionFromLocalApi(req, studentInfo.avatar_choice);

    const avatarModelUrl =
      toPublicAvatarUrl(
        avatar?.avatar_model ??
        avatar?.modelUrl ??
        avatar?.model_url ??
        avatar?.glb_url
      ) ??
      avatarOption?.modelUrl ??
      null;

    return NextResponse.json({
      ok: true,
      data: {
        student_info: {
          user_id: studentInfo.user_id ?? backendUser.user_id,
          std_id: studentInfo.std_id ?? student.std_id,
          first_name: studentInfo.first_name ?? "",
          last_name: studentInfo.last_name ?? "",
          birth_date: toInputDate(studentInfo.birth_date),
          phone: studentInfo.phone ?? "",
          email: profileObj?.email ?? "",
          address: studentInfo.address ?? student.address ?? "",
          about_me: studentInfo.about_me ?? student.about_me ?? "",
          university: studentInfo.university ?? "",
          faculty: studentInfo.faculty ?? "",
          major: studentInfo.major ?? "",
          year:
            studentInfo.year !== null && studentInfo.year !== undefined
              ? Number(studentInfo.year)
              : "",
          interests: normalizeStringArray(studentInfo.interests),
          skill: normalizeStringArray(studentInfo.skill),
          level: Number(studentInfo.level ?? 1),
          current_exp: Number(studentInfo.current_exp ?? 0),
          xp_max: Math.max(100, Number(studentInfo.level ?? 1) * 100),
          avatar_choice: studentInfo.avatar_choice ?? null,
          profile_image_url: toPublicAvatarUrl(studentInfo.profile_image_url) ?? null,
          avatar_model_url: avatarModelUrl,
          avatar_image_url: toPublicAvatarUrl(studentInfo.profile_image_url) ?? null,
          is_profile_complete: Boolean(studentInfo.is_profile_complete),
          profile: profileObj,
          achievement: achievementObj,
          portfolio: portfolioObj,
        },
        activities_status: {
          completed_number: Number(dashboardRaw?.activities_status?.completed_number ?? 0),
          failed_number: Number(dashboardRaw?.activities_status?.failed_number ?? 0),
          registered_number: Number(dashboardRaw?.activities_status?.registered_number ?? 0),
          waiting_feedback_number: Number(
            dashboardRaw?.activities_status?.waiting_feedback_number ?? 0
          ),
        },
        done_activities: Array.isArray(dashboardRaw?.done_activities)
          ? dashboardRaw.done_activities
          : [],
        schedules: Array.isArray(dashboardRaw?.schedules) ? dashboardRaw.schedules : [],
        today_missions: Array.isArray(dashboardRaw?.today_missions)
          ? dashboardRaw.today_missions
          : [],
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
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

    const jwt = decodeJwt(idToken);
    const cognitoUserId = jwt.sub;

    if (!cognitoUserId) {
      return NextResponse.json(
        { ok: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    const backendUser = await findBackendUserByCognitoSub(
      cognitoUserId,
      accessToken
    );

    if (!backendUser?.user_id) {
      return NextResponse.json(
        { ok: false, message: "Backend user not found" },
        { status: 404 }
      );
    }

    const student = await findStudentByUserId(backendUser.user_id, accessToken);

    if (!student?.std_id) {
      return NextResponse.json(
        { ok: false, message: "Student profile not found" },
        { status: 404 }
      );
    }

    const body = await req.json();

    const first_name = String(body?.first_name ?? student.first_name ?? "").trim();
    const last_name = String(body?.last_name ?? student.last_name ?? "").trim();
    const phone = body?.phone ? String(body.phone).trim() : student.phone ?? null;
    const university = body?.university
      ? String(body.university).trim()
      : student.university ?? null;
    const faculty = body?.faculty
      ? String(body.faculty).trim()
      : student.faculty ?? null;
    const major = body?.major ? String(body.major).trim() : student.major ?? null;
    const year =
      body?.year === null || body?.year === undefined || body?.year === ""
        ? student.year ?? null
        : Number(body.year);

    const interests = normalizeStringArray(body?.interests ?? student.interests);
    const skill = normalizeStringArray(body?.skill ?? student.skill);

    const avatar_choice = body?.avatar_choice ?? student.avatar_choice ?? null;
    const birth_date = toBackendDateTime(body?.birth_date ?? student.birth_date);
    const address =
      body?.address !== undefined ? String(body.address ?? "").trim() : student.address ?? "";
    const about_me =
      body?.about_me !== undefined
        ? String(body.about_me ?? "").trim()
        : student.about_me ?? "";

    const profile_image_url =
      body?.profile_image_url !== undefined
        ? String(body.profile_image_url ?? "").trim()
        : student.profile_image_url ?? "";

    const currentProfile = parseJsonObject(student.profile);
    const nextProfile = {
      ...currentProfile,
      ...(body?.email ? { email: String(body.email).trim() } : {}),
      ...(body?.profile && typeof body.profile === "object" ? body.profile : {}),
      ...(body?.headline ? { headline: String(body.headline).trim() } : {}),
      ...(body?.bio ? { bio: String(body.bio).trim() } : {}),
    };

    const is_profile_complete = Boolean(
      first_name &&
      last_name &&
      phone &&
      university &&
      faculty &&
      major &&
      year !== null &&
      year !== undefined &&
      avatar_choice
    );

    const payload = {
      std_id: student.std_id,
      user_id: backendUser.user_id,
      first_name,
      last_name,
      birth_date,
      phone,
      avatar_choice,
      university,
      faculty,
      major,
      year,
      interests,
      skill,
      profile_image_url,
      profile: toJsonString(nextProfile),
      portfolio: toJsonString(student.portfolio),
      achievement: toJsonString(student.achievement),
      current_exp: Number(student.current_exp ?? 0),
      level: Number(student.level ?? 1),
      is_profile_complete,
      address,
      about_me,
    };

    const r = await fetch(`${BACKEND}/student`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const raw = await r.text();
    let json: any = null;

    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = { message: raw || "Unknown backend response" };
    }

    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: json?.message || "Failed to update student",
          detail: json,
          sent_payload: payload,
        },
        { status: r.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: json?.message || "Student updated successfully",
      data: json?.data ?? json ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}