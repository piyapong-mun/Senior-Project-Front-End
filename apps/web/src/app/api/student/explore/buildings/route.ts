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

async function fetchJson(url: string, accessToken?: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            accept: "application/json",
          }
        : {}),
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

function extractActivitiesArray(payload: any): any[] {
  return safeArray(
    payload?.activity ??
      payload?.activities ??
      payload?.data?.activity ??
      payload?.data?.activities ??
      payload?.data ??
      payload
  );
}

function extractRegistrationsArray(payload: any): any[] {
  return safeArray(
    payload?.activity_registration ??
      payload?.registrations ??
      payload?.data?.activity_registration ??
      payload?.data?.registrations ??
      payload?.data ??
      payload
  );
}

function parseMaybeJsonObject(value: any) {
  if (!value) return {};
  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeActivityStatus(value: any) {
  return String(value ?? "").trim().toLowerCase();
}

function isPublishedActivity(activity: any) {
  const raw = normalizeActivityStatus(
    activity?.activity_status ??
      activity?.ActivityStatus ??
      activity?.status ??
      activity?.Status ??
      activity?.visibility ??
      activity?.activity_visibility
  );

  return (
    raw === "publish" ||
    raw === "published" ||
    raw === "public" ||
    raw === "open"
  );
}

function normalizeActivityType(activity: any) {
  const raw = String(
    activity?.activity_type ??
      activity?.ActivityType ??
      activity?.type ??
      activity?.category ??
      ""
  )
    .trim()
    .toLowerCase();

  if (raw === "challenge" || raw === "course" || raw === "meeting") {
    return raw;
  }

  return "activity";
}

function normalizeActivityForClient(activity: any, registeredIds: Set<string>) {
  const id = String(
    activity?.activity_id ??
      activity?.ActivityID ??
      activity?.Activity_id ??
      activity?.id ??
      ""
  ).trim();

  const title = String(
    activity?.activity_name ??
      activity?.ActivityName ??
      activity?.Activity_name ??
      activity?.title ??
      "Untitled activity"
  ).trim();

  const description = String(
    activity?.activity_detail ??
      activity?.activity_description ??
      activity?.ActivityDetail ??
      activity?.description ??
      ""
  ).trim();

  const type = normalizeActivityType(activity);
  const status = String(
    activity?.activity_status ??
      activity?.ActivityStatus ??
      activity?.status ??
      activity?.Status ??
      "Published"
  ).trim();

  return {
    id,
    title,
    description,
    type,
    hours: Number(activity?.hours ?? activity?.Hours ?? 0),
    xp_reward: Number(activity?.xp_reward ?? activity?.xp ?? 0),
    status,
    is_registered: registeredIds.has(id),
  };
}

function getCreatorOrgId(activity: any) {
  return String(
    activity?.creator_org_id ??
      activity?.CreatorOrgID ??
      activity?.Creator_org_id ??
      activity?.org_id ??
      activity?.OrgID ??
      ""
  ).trim();
}

function buildOrgSummary(activities: any[]) {
  const published = activities.length;
  const challenges = activities.filter((item) => item.type === "challenge").length;
  const courses = activities.filter((item) => item.type === "course").length;
  const meetings = activities.filter((item) => item.type === "meeting").length;

  return {
    published,
    totalActivities: published,
    challenges,
    courses,
    meetings,
  };
}

async function enrichOrg(orgId: string, accessToken: string) {
  try {
    const payload = await fetchJson(`${BACKEND}/org/${orgId}`, accessToken);
    return payload?.data ?? payload ?? null;
  } catch (error) {
    console.error(`Failed to load org ${orgId}:`, error);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const sess = getSessionTokens(req);
    if (!sess?.idToken || !sess?.accessToken) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
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

    const origin = new URL(req.url).origin;

    const [activitiesRaw, registrationsRaw, buildingsRaw] = await Promise.all([
      fetchJson(`${BACKEND}/activity/all`, sess.accessToken),
      fetchJson(
        `${BACKEND}/activity/register/student/${student.std_id}`,
        sess.accessToken
      ).catch(() => []),
      fetch(`${origin}/api/organization/explore/buildings`, {
        method: "GET",
        headers: {
          cookie: req.headers.get("cookie") || "",
          accept: "application/json",
        },
        cache: "no-store",
      })
        .then(async (res) => {
          const json = await res.json().catch(() => null);
          if (!res.ok) return null;
          return json;
        })
        .catch(() => null),
    ]);

    const allActivities = extractActivitiesArray(activitiesRaw);
    const registrations = extractRegistrationsArray(registrationsRaw);

    const registeredActivityIds = new Set(
      registrations
        .map((item: any) =>
          String(item?.activity_id ?? item?.ActivityID ?? item?.Activity_id ?? "")
        )
        .filter(Boolean)
    );

    const buildingRows: any[] = safeArray(
      buildingsRaw?.data?.buildings ?? buildingsRaw?.buildings ?? []
    );

    const buildingMap = new Map<
      string,
      { org_id: string; org_name: string; building_name: string }
    >();

    buildingRows.forEach((row: any) => {
      const orgId = String(row?.org_id ?? "").trim();
      const buildingName = String(row?.building_name ?? "").trim();
      if (!orgId || !buildingName) return;

      buildingMap.set(orgId, {
        org_id: orgId,
        org_name: String(row?.org_name ?? "").trim(),
        building_name: buildingName,
      });
    });

    const publishedActivities = allActivities
      .filter((activity: any) => isPublishedActivity(activity))
      .map((activity: any) => normalizeActivityForClient(activity, registeredActivityIds))
      .filter((activity: any) => Boolean(activity.id));

    const orgIds = Array.from(
      new Set([
        ...publishedActivities
          .map((activity: any) => {
            const original = allActivities.find((raw: any) => {
              const rawId = String(
                raw?.activity_id ??
                  raw?.ActivityID ??
                  raw?.Activity_id ??
                  raw?.id ??
                  ""
              );
              return rawId === activity.id;
            });
            return getCreatorOrgId(original);
          })
          .filter(Boolean),
        ...Array.from(buildingMap.keys()),
      ])
    );

    const orgDetailList = await Promise.all(
      orgIds.map(async (orgId) => {
        const orgDetail = await enrichOrg(orgId, sess.accessToken);
        const building = buildingMap.get(orgId);

        const activities = publishedActivities.filter((activity: any) => {
          const original = allActivities.find((raw: any) => {
            const rawId = String(
              raw?.activity_id ??
                raw?.ActivityID ??
                raw?.Activity_id ??
                raw?.id ??
                ""
            );
            return rawId === activity.id;
          });

          return getCreatorOrgId(original) === orgId;
        });

        const summary = buildOrgSummary(activities);
        const contact = parseMaybeJsonObject(orgDetail?.contact);

        return {
          org_id: orgId,
          org_name: String(
            orgDetail?.org_name ?? building?.org_name ?? "Unknown organization"
          ).trim(),
          logo: String(orgDetail?.logo ?? "").trim(),
          website_url: String(orgDetail?.website_url ?? "").trim(),
          about_org: String(orgDetail?.about_org ?? "").trim(),
          phone: String(contact?.phone ?? "").trim(),
          email: String(contact?.email ?? "").trim(),
          location: String(contact?.location ?? "").trim(),
          building_name: String(building?.building_name ?? "").trim(),
          building_mesh_names: String(building?.building_name ?? "").trim()
            ? [String(building?.building_name ?? "").trim().toLowerCase()]
            : [],
          activities,
          summary,
        };
      })
    );

    const organizations = orgDetailList.filter(
      (item) =>
        item.building_mesh_names.length > 0 &&
        (item.activities.length > 0 || item.org_name)
    );

    return NextResponse.json({
      ok: true,
      data: {
        student_id: String(student.std_id),
        registered_activity_ids: Array.from(registeredActivityIds),
        organizations,
      },
    });
  } catch (error: any) {
    console.error("GET /api/student/explore/buildings failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Failed to load explore organizations",
      },
      { status: 500 }
    );
  }
}