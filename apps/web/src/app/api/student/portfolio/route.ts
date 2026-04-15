import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

const BACKEND = process.env.BACKEND_URL!;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";

type SessionTokens = {
  accessToken: string;
  idToken: string;
};

type PortfolioType =
  | "info"
  | "education"
  | "skills"
  | "certificate"
  | "experience";

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

function safeObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch { }
  }
  return {};
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    const s = String(value ?? "").trim();
    if (s && s !== "null" && s !== "undefined") return s;
  }
  return "";
}

function normalizeSource(value: unknown): "upload" | "platform" {
  return String(value ?? "").trim().toLowerCase() === "upload"
    ? "upload"
    : "platform";
}

function normalizeSkillKind(value: unknown): "soft" | "technical" {
  const s = String(value ?? "").trim().toLowerCase();
  return s.includes("soft") ? "soft" : "technical";
}

function normalizeDate(value: unknown) {
  const s = pickString(value);
  if (!s) return "";
  if (s.includes("T")) return s.slice(0, 10);
  return s;
}

function toYearText(value: unknown) {
  const s = pickString(value);
  if (!s) return "";
  if (s.includes("T")) return s.slice(0, 4);
  return s;
}

function getPortfolioContainer(root: any) {
  return safeObject(root?.portfolio ?? root?.Portfolio ?? {});
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
      `${url} failed: ${res.status} ${typeof json === "string" ? json : JSON.stringify(json)
      }`
    );
  }

  return json;
}

async function tryFetchJson(url: string, accessToken: string) {
  try {
    return await fetchJson(url, accessToken);
  } catch {
    return null;
  }
}

async function readResponseJson(res: Response) {
  const raw = await res.text();
  let json: any = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw ? { message: raw } : null;
  }

  return json;
}

async function updatePortfolioBackend(
  stdId: string,
  accessToken: string,
  type: PortfolioType,
  payload: any
) {
  const attempts = [
    {
      url: `${BACKEND}/student/${stdId}/portfolio/${type}`,
      method: "PUT",
      body: payload,
    },
    {
      url: `${BACKEND}/student/${stdId}/portfolio`,
      method: "PUT",
      body: payload,
    },
    {
      url: `${BACKEND}/student/${stdId}/portfolio`,
      method: "PATCH",
      body: { type, ...payload },
    },
    {
      url: `${BACKEND}/student/${stdId}`,
      method: "PUT",
      body: { portfolio: payload, Portfolio: payload, ...payload },
    },
  ] as const;

  let lastStatus = 500;
  let lastJson: any = { message: "Update failed" };

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: attempt.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attempt.body),
        cache: "no-store",
      });

      const json = await readResponseJson(res);
      if (res.ok) {
        return { ok: true, status: res.status, json };
      }

      lastStatus = res.status;
      lastJson = json;
    } catch (error: any) {
      lastJson = { message: error?.message || "Update failed" };
    }
  }

  return { ok: false, status: lastStatus, json: lastJson };
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

function normalizeStudentInfo(portfolioRoot: any, dashboardRoot: any) {
  const rootObj = safeObject(portfolioRoot);
  const dashboardInfo = safeObject(dashboardRoot?.student_info);
  const portfolioObj = getPortfolioContainer(rootObj);
  const infoObj = safeObject(portfolioObj?.Info ?? portfolioObj?.info);
  const profileObj = safeObject(rootObj?.profile ?? rootObj?.Profile);

  return {
    first_name: pickString(
      rootObj?.first_name,
      rootObj?.firstName,
      dashboardInfo?.first_name,
      dashboardInfo?.firstName,
      infoObj?.FirstName,
      infoObj?.first_name,
      infoObj?.firstName
    ),
    last_name: pickString(
      rootObj?.last_name,
      rootObj?.lastName,
      dashboardInfo?.last_name,
      dashboardInfo?.lastName,
      infoObj?.LastName,
      infoObj?.last_name,
      infoObj?.lastName
    ),
    birth_date: normalizeDate(
      rootObj?.birth_date ??
      rootObj?.birthDate ??
      dashboardInfo?.birth_date ??
      dashboardInfo?.birthDate
    ),
    phone: pickString(
      rootObj?.phone,
      dashboardInfo?.phone,
      infoObj?.Phone,
      infoObj?.phone
    ),
    email: pickString(
      rootObj?.email,
      infoObj?.Email,
      infoObj?.email,
      profileObj?.email
    ),
    address: pickString(
      rootObj?.address,
      dashboardInfo?.address,
      infoObj?.Address,
      infoObj?.address
    ),
    about_me: pickString(
      rootObj?.about_me,
      rootObj?.aboutMe,
      dashboardInfo?.about_me,
      dashboardInfo?.aboutMe,
      infoObj?.AboutMe,
      infoObj?.about_me,
      infoObj?.aboutMe,
      profileObj?.bio
    ),
    profile_image_url: pickString(
      rootObj?.profile_image_url,
      rootObj?.avatar_image_url,
      profileObj?.profile_image_url
    ),
  };
}

function normalizeEducation(portfolioRoot: any) {
  const rootObj = safeObject(portfolioRoot);
  const portfolioObj = getPortfolioContainer(rootObj);

  const list = safeArray<any>(
    portfolioObj?.Education ??
    portfolioObj?.education ??
    rootObj?.education ??
    rootObj?.Education
  );

  return list.map((item, index) => ({
    id: pickString(item?.education_id, item?.id) || `education-${index}`,
    school: pickString(
      item?.school,
      item?.school_name,
      item?.educational_institution,
      item?.institution,
      item?.university,
      item?.facultyschool
    ),
    degree: pickString(item?.degree, item?.degree_level),
    faculty: pickString(item?.faculty),
    fieldOfStudy: pickString(
      item?.field_of_study,
      item?.fieldOfStudy,
      item?.major
    ),
    start_year: toYearText(item?.start_year ?? item?.start_date),
    end_year: toYearText(item?.end_year ?? item?.end_date),
    gpa: pickString(item?.gpa),
  }));
}

function normalizeSkills(portfolioRoot: any) {
  const rootObj = safeObject(portfolioRoot);
  const portfolioObj = getPortfolioContainer(rootObj);

  const list = safeArray<any>(
    portfolioObj?.Skills ??
    portfolioObj?.skills ??
    rootObj?.skills ??
    rootObj?.Skills ??
    rootObj?.skill
  );

  return list.map((item, index) => ({
    id: pickString(item?.skill_id, item?.id) || `skill-${index}`,
    name: pickString(item?.skill_name, item?.name, item?.title),
    kind: normalizeSkillKind(item?.skill_type ?? item?.kind ?? item?.type),
    source: normalizeSource(item?.source),
    isSelected:
      typeof item?.isSelected === "boolean" ? item.isSelected : true,
  }));
}

function normalizeCertificates(portfolioRoot: any) {
  const rootObj = safeObject(portfolioRoot);
  const portfolioObj = getPortfolioContainer(rootObj);

  const certificates = safeArray<any>(
    portfolioObj?.Certificates ??
    portfolioObj?.certificates ??
    rootObj?.certificates ??
    rootObj?.Certificates
  );

  const badges = safeArray<any>(
    portfolioObj?.Badges ??
    portfolioObj?.badges ??
    rootObj?.badges ??
    rootObj?.Badges
  );

  const merged = [...badges, ...certificates];

  return merged.map((item, index) => ({
    id: pickString(
      item?.cert_id,
      item?.certificate_id,
      item?.badge_id,
      item?.id
    ) || `certificate-${index}`,
    title: pickString(
      item?.title,
      item?.name,
      item?.certificate_name,
      item?.badge_name,
      typeof item === "string" ? item : ""
    ),
    date: normalizeDate(item?.date ?? item?.issue_date ?? item?.created_at),
    source: normalizeSource(item?.source),
    files: safeArray(item?.files),
  }));
}

function buildPeriod(item: any) {
  const direct = pickString(item?.period);
  if (direct) return direct;

  const start = toYearText(
    item?.start_year ?? item?.start_at ?? item?.start_date
  );
  const end = toYearText(item?.end_year ?? item?.end_at ?? item?.end_date);

  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

function normalizeExperiences(portfolioRoot: any) {
  const rootObj = safeObject(portfolioRoot);
  const portfolioObj = getPortfolioContainer(rootObj);

  const list = safeArray<any>(
    portfolioObj?.Experience ??
    portfolioObj?.experience ??
    portfolioObj?.Experiences ??
    portfolioObj?.experiences ??
    rootObj?.experience ??
    rootObj?.Experience ??
    rootObj?.experiences ??
    rootObj?.Experiences
  );

  return list.map((item, index) => ({
    id: pickString(
      item?.experience_id,
      item?.exp_id,
      item?.activity_id,
      item?.id
    ) || `experience-${index}`,
    period: buildPeriod(item),
    title: pickString(
      item?.title,
      item?.activity_name,
      item?.name,
      typeof item === "string" ? item : ""
    ),
    description: pickString(
      item?.description,
      item?.detail,
      item?.activity_description
    ),
    source: normalizeSource(item?.source),
    files: safeArray(item?.files),
  }));
}

function buildBackendPayload(type: PortfolioType, body: any) {
  if (type === "info") {
    const firstName = pickString(body?.first_name, body?.firstName);
    const lastName = pickString(body?.last_name, body?.lastName);
    const email = pickString(body?.email);
    const phone = pickString(body?.phone);
    const address = pickString(body?.address);
    const aboutMe = pickString(body?.about_me, body?.aboutMe);
    const birthDate = pickString(body?.birth_date, body?.birthDate);

    return {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address,
      about_me: aboutMe,
      birth_date: birthDate,
      Info: {
        FirstName: firstName,
        LastName: lastName,
        Email: email,
        Phone: phone,
        Address: address,
        AboutMe: aboutMe,
      },
      info: {
        FirstName: firstName,
        LastName: lastName,
        Email: email,
        Phone: phone,
        Address: address,
        AboutMe: aboutMe,
      },
    };
  }

  if (type === "education") {
    const items = safeArray<any>(body?.Education ?? body?.education ?? body).map(
      (item) => ({
        id: pickString(item?.id, item?.education_id),
        school: pickString(
          item?.school,
          item?.school_name,
          item?.educational_institution,
          item?.institution
        ),
        degree: pickString(item?.degree, item?.degree_level),
        faculty: pickString(item?.faculty),
        field_of_study: pickString(
          item?.field_of_study,
          item?.fieldOfStudy,
          item?.major
        ),
        start_year: pickString(item?.start_year, item?.startYear),
        end_year: pickString(item?.end_year, item?.endYear),
        gpa: pickString(item?.gpa),
      })
    );

    return {
      Education: items,
      education: items,
    };
  }

  if (type === "skills") {
    const items = safeArray<any>(body?.Skills ?? body?.skills ?? body).map(
      (item) => ({
        id: pickString(item?.id, item?.skill_id),
        name: pickString(item?.name, item?.skill_name, item?.title),
        skill_type: normalizeSkillKind(item?.kind ?? item?.skill_type),
        source: normalizeSource(item?.source),
        isSelected:
          typeof item?.isSelected === "boolean" ? item.isSelected : true,
      })
    );

    return {
      Skills: items,
      skills: items,
    };
  }

  if (type === "certificate") {
    const items = safeArray<any>(
      body?.Certificates ?? body?.certificates ?? body
    ).map((item) => ({
      id: pickString(
        item?.id,
        item?.cert_id,
        item?.certificate_id,
        item?.badge_id
      ),
      title: pickString(
        item?.title,
        item?.name,
        item?.certificate_name,
        item?.badge_name
      ),
      date: pickString(item?.date, item?.issue_date),
      source: normalizeSource(item?.source),
      files: safeArray(item?.files),
    }));

    return {
      Certificates: items,
      certificates: items,
    };
  }

  if (type === "experience") {
    const items = safeArray<any>(
      body?.Experience ?? body?.experience ?? body?.experiences ?? body
    ).map((item) => ({
      id: pickString(
        item?.id,
        item?.experience_id,
        item?.exp_id,
        item?.activity_id
      ),
      period: pickString(item?.period),
      title: pickString(item?.title, item?.activity_name, item?.name),
      description: pickString(
        item?.description,
        item?.detail,
        item?.activity_description
      ),
      source: normalizeSource(item?.source),
      files: safeArray(item?.files),
    }));

    return {
      Experience: items,
      experience: items,
      experiences: items,
    };
  }

  return body;
}

export async function GET(req: Request) {
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

    const [portfolioJson, dashboardJson] = await Promise.all([
      tryFetchJson(`${BACKEND}/student/${stdId}/portfolio`, sess.accessToken),
      tryFetchJson(`${BACKEND}/student/${stdId}/dashboard`, sess.accessToken),
    ]);

    const portfolioRoot = portfolioJson?.data ?? portfolioJson ?? {};
    const dashboardRoot = dashboardJson?.data ?? dashboardJson ?? {};

    return NextResponse.json({
      ok: true,
      data: {
        student_info: normalizeStudentInfo(portfolioRoot, dashboardRoot),
        education: normalizeEducation(portfolioRoot),
        skills: normalizeSkills(portfolioRoot),
        certificates: normalizeCertificates(portfolioRoot),
        experiences: normalizeExperiences(portfolioRoot),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  console.log("PUT /api/student/portfolio");
  try {
    const sess = getSessionTokens(req);
    if (!sess) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as PortfolioType | null;
    console.log("type: ", type);

    if (!type) {
      return NextResponse.json(
        { ok: false, message: "Missing portfolio type" },
        { status: 400 }
      );
    }

    const stdId = await getStdId(sess.accessToken, sess.idToken);
    if (!stdId) {
      return NextResponse.json(
        { ok: false, message: "Student not found" },
        { status: 404 }
      );
    }

    console.log("stdId: ", stdId);

    const body = await req.json();
    const payload = buildBackendPayload(type, body);

    console.log("payload: ", payload);

    const result = await updatePortfolioBackend(
      stdId,
      sess.accessToken,
      type,
      payload
    );

    console.log("result: ", result);

    return NextResponse.json(
      {
        ok: result.ok,
        message:
          result.json?.message ||
          (result.ok ? "Portfolio updated successfully" : "Update failed"),
        data: result.json?.data ?? result.json ?? null,
      },
      { status: result.status }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Update failed" },
      { status: 500 }
    );
  }
}