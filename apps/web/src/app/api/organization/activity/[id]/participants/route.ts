import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { Pool } from "pg";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL || "https://vcep-platform.duckdns.org";
const DATABASE_URL = process.env.DATABASE_URL!;
const PGSSL_CA_PATH = process.env.PGSSL_CA_PATH;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const ASSETS_PUBLIC_BASE = (
  process.env.NEXT_PUBLIC_ASSETS_PUBLIC_BASE ||
  process.env.NEXT_PUBLIC_ASSETS_BASE ||
  process.env.ASSETS_PUBLIC_BASE ||
  "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com"
).replace(/\/+$/, "");

declare global {
  // eslint-disable-next-line no-var
  var __vcepParticipantsPool: Pool | undefined;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_REGEX.test(v);

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

function getSessionTokens(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  const raw = readCookie(cookieHeader, COOKIE_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { idToken?: string; accessToken?: string };
      if (parsed?.idToken) return parsed;
    } catch {
      // ignore malformed cookie
    }
  }

  const idToken = readCookie(cookieHeader, "vcep_id") || readCookie(cookieHeader, "id_token");
  const accessToken =
    readCookie(cookieHeader, "vcep_access") ||
    readCookie(cookieHeader, "access_token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  return {
    idToken: idToken || "",
    accessToken,
  };
}

function stripPgSslParams(cs: string) {
  try {
    const url = new URL(cs);
    ["sslmode", "sslcert", "sslkey", "sslrootcert"].forEach((k) => url.searchParams.delete(k));
    return url.toString();
  } catch {
    return cs;
  }
}

function getPool() {
  if (global.__vcepParticipantsPool) return global.__vcepParticipantsPool;

  const ssl =
    PGSSL_CA_PATH && fs.existsSync(PGSSL_CA_PATH)
      ? { ca: fs.readFileSync(PGSSL_CA_PATH, "utf8") }
      : { rejectUnauthorized: false };

  global.__vcepParticipantsPool = new Pool({
    connectionString: stripPgSslParams(DATABASE_URL),
    ssl,
  });

  return global.__vcepParticipantsPool;
}

function getRequestBaseUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || "localhost:3000";
  return `${proto}://${host}`;
}

function pickFirst(source: any, keys: string[]): any {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function toAbsoluteAssetUrl(value: any) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("s3://")) {
    const withoutScheme = raw.replace(/^s3:\/\//, "");
    const slashIndex = withoutScheme.indexOf("/");
    const key = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
    return key ? joinUrl(ASSETS_PUBLIC_BASE, key) : "";
  }
  if (raw.startsWith("/")) return raw;
  return joinUrl(ASSETS_PUBLIC_BASE, raw);
}

function buildStudentBio(student: any, registeredAt?: string) {
  const major = String(pickFirst(student, ["major", "Major"])).trim();
  const faculty = String(pickFirst(student, ["faculty", "Faculty"])).trim();
  const university = String(pickFirst(student, ["university", "University"])).trim();
  const email = String(pickFirst(student, ["email", "Email"])).trim();

  const parts = [major, faculty, university].filter(Boolean);
  if (parts.length > 0) return parts.join(" • ");
  if (email) return email;
  if (registeredAt) return `Registered at ${registeredAt}`;
  return "";
}

function normalizeParticipantStatus(status: any): "Doing" | "Completed" {
  const value = String(status ?? "").trim().toLowerCase();

  if (
    [
      "completed",
      "complete",
      "done",
      "verified",
      "passed",
      "attendance complete",
      "attendance_complete",
      "checkin_complete",
      "checked-in complete",
    ].includes(value)
  ) {
    return "Completed";
  }

  return "Doing";
}

async function fetchJson(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function resolveOrgIdViaDashboard(req: NextRequest, accessToken: string) {
  const baseUrl = getRequestBaseUrl(req);
  const res = await fetch(`${baseUrl}/api/organization/dashboard`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      cookie: req.headers.get("cookie") || "",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  const orgId = String(data?.data?.account?.orgId || data?.account?.orgId || "").trim();
  return {
    ok: res.ok,
    orgId,
    data,
  };
}

function extractActivityList(payload: any): any[] {
  const candidates = [
    payload?.Activity,
    payload?.activity,
    payload?.activities,
    payload?.items,
    payload?.list,
    payload?.data?.Activity,
    payload?.data?.activity,
    payload,
    payload?.data,
    payload?.result,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function extractActivityId(activity: any) {
  const commonInfo = activity?.CommonInfo ?? activity?.commonInfo ?? activity?.common_info ?? activity;
  return String(commonInfo?.activity_id ?? activity?.activity_id ?? activity?.id ?? "").trim();
}

function extractParticipantList(activity: any): any[] {
  const candidates = [
    activity?.Participant,
    activity?.participant,
    activity?.participants,
    activity?.ParticipantList,
    activity?.data?.Participant,
    activity?.data?.participants,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

async function fetchStudentDetail(stdId: string, accessToken: string) {
  if (!stdId) return null;

  const { res, data } = await fetchJson(`${BACKEND_URL}/student/${stdId}`, accessToken, {
    method: "GET",
  });

  if (!res.ok) return null;

  const raw = data ?? {};
  const firstName = String(pickFirst(raw, ["first_name", "FirstName"])).trim();
  const lastName = String(pickFirst(raw, ["last_name", "LastName"])).trim();
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    String(pickFirst(raw, ["name", "full_name", "display_name"])).trim();

  const profileImage = String(
    pickFirst(raw, ["profile_image_url", "profile_image", "avatar_url", "avatar"])
  ).trim();

  const score = Number(
    pickFirst(raw, ["current_exp", "current_xp", "xp", "total_exp", "score"])
  );

  return {
    std_id: String(pickFirst(raw, ["std_id", "StdID"])).trim() || stdId,
    user_id: String(pickFirst(raw, ["user_id", "UserID"])).trim(),
    first_name: firstName,
    last_name: lastName,
    name: fullName,
    bio: buildStudentBio(raw),
    profile_image: profileImage,
    score: Number.isFinite(score) ? score : 0,
  };
}

async function mapParticipant(item: any, index: number, accessToken: string) {
  const participantInfo = item?.participant_info ?? item?.ParticipantInfo ?? {};
  const participantSubmissions = item?.participant_submissions ?? item?.ParticipantSubmissions ?? {};

  const stdId = String(
    pickFirst(participantInfo, ["participant_id", "std_id", "StdID", "student_id"])
  ).trim();

  const student = await fetchStudentDetail(stdId, accessToken);
  const registrationStatus = String(
    pickFirst(participantInfo, ["participant_status", "status"])
  ).trim();
  const submissionStatus = String(
    pickFirst(participantSubmissions, ["submission_status", "status"])
  ).trim();
  const registeredAt = String(
    pickFirst(item, ["registered_at", "RegisteredAt", "created_at", "register_at"])
  ).trim();

  const fallbackName = stdId ? `Student ${stdId.slice(0, 8)}` : `Participant ${index + 1}`;

  return {
    id:
      student?.user_id ||
      stdId ||
      String(pickFirst(participantSubmissions, ["submission_id", "id"])).trim() ||
      `participant-${index}`,
    std_id: student?.std_id || stdId,
    first_name: student?.first_name || "",
    last_name: student?.last_name || "",
    name:
      student?.name ||
      String(pickFirst(participantInfo, ["participant_name", "name"])).trim() ||
      fallbackName,
    bio:
      student?.bio ||
      buildStudentBio(student || {}, registeredAt) ||
      String(pickFirst(participantInfo, ["participant_email", "email"])).trim(),
    profile_image:
      toAbsoluteAssetUrl(student?.profile_image) ||
      toAbsoluteAssetUrl(
        pickFirst(participantInfo, ["profile_image_url", "participant_avatar", "avatar"])
      ),
    score: student?.score ?? 0,
    status: normalizeParticipantStatus(submissionStatus || registrationStatus),
    submission_status: submissionStatus,
    registration_status: registrationStatus,
    registered_at: registeredAt,
    participant_info: participantInfo,
    participant_submissions: participantSubmissions,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const session = getSessionTokens(req);
    if (!session.idToken) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized", participants: [], source: "missing-session" },
        { status: 401 }
      );
    }

    const accessToken = String(session.accessToken || "").trim();
    const dashboardCtx = await resolveOrgIdViaDashboard(req, accessToken);
    const orgId = String(dashboardCtx.orgId || "").trim();

    if (!orgId || !isUuid(orgId)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Could not resolve organization id from dashboard route",
          participants: [],
          source: "dashboard-orgid-miss",
          dashboardOk: dashboardCtx.ok,
        },
        { status: 404 }
      );
    }

    const orgListUrls = [
      `${BACKEND_URL}/activity/org/${orgId}`,
      `${BACKEND_URL}/activity/meeting/org/${orgId}`,
      `${BACKEND_URL}/activity/challenge/org/${orgId}`,
      `${BACKEND_URL}/activity/course/org/${orgId}`,
    ];

    for (const url of orgListUrls) {
      const { res, data } = await fetchJson(url, accessToken, { method: "GET" });
      if (!res.ok) continue;

      const activity = extractActivityList(data).find((item: any) => extractActivityId(item) === id);
      if (!activity) continue;

      const participantRows = extractParticipantList(activity);
      if (!participantRows.length) {
        return NextResponse.json({ ok: true, participants: [], source: "org-list-empty" });
      }

      const participants = await Promise.all(
        participantRows.map((item: any, index: number) => mapParticipant(item, index, accessToken))
      );

      return NextResponse.json({
        ok: true,
        participants,
        source: "org-list-via-dashboard",
        orgId,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Activity not found in organization activity lists",
        participants: [],
        source: "org-list-activity-miss",
        orgId,
      },
      { status: 404 }
    );
  } catch (error: any) {
    const message = error?.message || "Internal server error";
    return NextResponse.json(
      {
        ok: false,
        message,
        participants: [],
        source: "participants-via-dashboard-error",
      },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
