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

function normalizeStatsPayload(payload: any) {
  return payload?.data ?? payload ?? {};
}

function normalizeFilterPayload(payload: any) {
  return payload?.data ?? payload ?? {};
}

function getOrgIdFromActivity(activity: any) {
  return String(
    activity?.CreatorOrgID ||
      activity?.Creator_org_id ||
      activity?.creator_org_id ||
      activity?.org_id ||
      activity?.OrgID ||
      ""
  ).trim();
}

function getOrgIdFromOrg(org: any) {
  return String(org?.org_id || org?.OrgID || org?.id || "").trim();
}

async function enrichOrganizations(
  orgList: any[],
  allActivities: any[],
  accessToken: string
) {
  const sourceMap = new Map<string, any>();

  orgList.forEach((org) => {
    const id = getOrgIdFromOrg(org);
    if (id) sourceMap.set(id, org);
  });

  allActivities.forEach((activity) => {
    const id = getOrgIdFromActivity(activity);
    if (!id) return;
    if (!sourceMap.has(id)) {
      sourceMap.set(id, {
        org_id: id,
        org_name: activity?.organization || "",
      });
    }
  });

  const orgIds = Array.from(sourceMap.keys());

  const enriched = await Promise.all(
    orgIds.map(async (orgId) => {
      const baseOrg = sourceMap.get(orgId) || {};

      try {
        const orgJson = await fetchJson(`${BACKEND}/org/${orgId}`, accessToken);
        const orgData = orgJson?.data ?? orgJson ?? {};

        return {
          ...baseOrg,
          ...orgData,
          org_id: orgData?.org_id || baseOrg?.org_id || orgId,
        };
      } catch (error) {
        console.error(`Failed to enrich organization ${orgId}:`, error);
        return baseOrg;
      }
    })
  );

  return enriched;
}

function getActivityId(activity: any) {
  return String(
    activity?.ActivityID ||
      activity?.Activity_id ||
      activity?.activity_id ||
      activity?.activityId ||
      activity?.id ||
      ""
  ).trim();
}

function getActivityOwnStatus(activity: any) {
  return String(
    activity?.SubmissionStatus ||
      activity?.submission_status ||
      activity?.Status ||
      activity?.status ||
      ""
  ).trim();
}


async function fetchStudentSkills(stdId: string, accessToken: string) {
  try {
    const json = await fetchJson(`${BACKEND}/student/skill/${stdId}`, accessToken);
    console.log("[activitystats] fetchStudentSkills raw:", JSON.stringify(json).slice(0, 500));
    const list = Array.isArray(json) ? json
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.skills) ? json.skills
      : [];
    console.log("[activitystats] studentSkills list length:", list.length, "sample:", JSON.stringify(list[0]).slice(0, 200));
    return list;
  } catch (e: any) {
    console.log("[activitystats] fetchStudentSkills FAILED:", e?.message);
    return [];
  }
}

function mergeSkillLevels(backendSkills: any[], studentSkills: any[]): any[] {
  if (!studentSkills.length) return backendSkills;

  // build map: skill_id → highest level from student_skills
  const maxLevelMap = new Map<string, { level: number; skill_name: string }>();
  for (const s of studentSkills) {
    const id = String(s?.skill_id ?? s?.skillId ?? s?.skill_id ?? "").trim();
    const name = String(s?.skill_name ?? s?.skillName ?? s?.name ?? "").trim();
    const level = Number(s?.level ?? s?.skill_level ?? s?.bloom_level ?? 0);
    if (!id) continue;
    const prev = maxLevelMap.get(id);
    if (!prev || level > prev.level) {
      maxLevelMap.set(id, { level, skill_name: name });
    }
  }

  if (!maxLevelMap.size) return backendSkills;

  // update backendSkills with higher levels from student_skills
  const updated = backendSkills.map((s: any) => {
    const id = String(s?.skill_id ?? "").trim();
    const better = maxLevelMap.get(id);
    if (better && better.level > Number(s?.skill_level ?? s?.level ?? 0)) {
      return { ...s, skill_level: better.level, bloom_level: better.level, level: better.level };
    }
    return s;
  });

  // add skills from student_skills not in backendSkills
  const existingIds = new Set(backendSkills.map((s: any) => String(s?.skill_id ?? "")));
  for (const [id, info] of maxLevelMap) {
    if (!existingIds.has(id)) {
      updated.push({ skill_id: id, skill_name: info.skill_name, skill_level: info.level, bloom_level: info.level, level: info.level });
    }
  }

  return updated;
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

    const origin = new URL(req.url).origin;

    const [statsRes, filterRes] = await Promise.all([
      fetch(`${BACKEND}/activity/stats/${stdId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sess.accessToken}`,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        cache: "no-store",
      }),
      fetch(`${origin}/api/student/filteractivity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          activity_name: "",
          activity_type: "",
          org_id: "",
          run_end_at: "",
          run_start_at: "",
          status: "",
        }),
        cache: "no-store",
      }),
    ]);

    if (!statsRes.ok) {
      const errText = await statsRes.text();
      throw new Error(`Activity stats fetch failed: ${errText}`);
    }

    const statsJson = await statsRes.json();
    const statsData = normalizeStatsPayload(statsJson);

    let allActivities: any[] = [];
    let orgList: any[] = [];

    if (filterRes.ok) {
      const filterJson = await filterRes.json();
      const filterData = normalizeFilterPayload(filterJson);
      allActivities = safeArray(filterData?.activities);
      orgList = safeArray(filterData?.org_list);
    }

    const doneMap = new Map<string, string>();
    safeArray(statsData?.done_activities).forEach((a: any) => {
      const id = getActivityId(a);
      const status = String(
        a?.submission_status ||
          a?.SubmissionStatus ||
          a?.status ||
          a?.Status ||
          ""
      ).trim();

      if (id && status) {
        doneMap.set(id, status);
      }
    });

    if (allActivities.length === 0) {
      allActivities = safeArray(statsData?.done_activities);
    }

    const mergedActivities = allActivities.map((activity: any) => {
      const id = getActivityId(activity);
      const ownStatus = getActivityOwnStatus(activity);
      const doneStatus = doneMap.get(id) || "";

      return {
        ...activity,
        // ให้สถานะจาก all_activities มาก่อน
        // done_activities ใช้เป็น fallback เท่านั้น
        submission_status: ownStatus || doneStatus || "In progress",
      };
    });

    const enrichedOrgList = await enrichOrganizations(
      orgList,
      mergedActivities,
      sess.accessToken
    );

    // fetch student's actual skill levels and merge with backend stats
    const studentSkills = await fetchStudentSkills(stdId, sess.accessToken);
    console.log("[activitystats] backendSkills sample:", JSON.stringify(safeArray(statsData?.skill_levels)[0]).slice(0,200));
    const mergedSkillLevels = mergeSkillLevels(
      safeArray(statsData?.skill_levels),
      studentSkills
    );

    return NextResponse.json({
      ok: true,
      data: {
        activities_status: statsData?.activities_status ?? {},
        skill_levels: mergedSkillLevels,
        schedules: safeArray(statsData?.schedules),
        all_activities: mergedActivities,
        org_list: enrichedOrgList,
        organizations: enrichedOrgList,
        done_activities: safeArray(statsData?.done_activities),
      },
    });
  } catch (e: any) {
    console.error("Error fetching student activity stats:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Server Error" },
      { status: 500 }
    );
  }
}