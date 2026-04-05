import { NextResponse } from "next/server";
import {
  fetchJson,
  getEmployeeContext,
  listEmployeesByOrgId,
  parseJsonObject,
  toPublicAssetUrl,
} from "@/lib/organization/server";

const BACKEND = process.env.BACKEND_URL!;

type ActivityStatusTone = "pending" | "join" | "ended";
type ActivityKind = "Meetings" | "Courses" | "Challenges";
type NormalizedActivity = ReturnType<typeof normalizeActivity>;
type NormalizedParticipant = ReturnType<typeof normalizeParticipant>;

function toContact(value: unknown) {
  return parseJsonObject(value);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = "") {
  const str = String(value ?? "").trim();
  return str || fallback;
}

function buildInitials(firstName?: string | null, lastName?: string | null, email?: string | null) {
  const joined = `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim();
  if (joined) {
    return joined
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }

  const mail = String(email || "").trim();
  return (mail.slice(0, 2) || "NA").toUpperCase();
}

function avatarIndexFromChoice(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const match = raw.match(/(\d+)/);
  if (!match) return 0;
  return Math.max(0, (Number(match[1]) || 1) - 1) % 3;
}

function deriveActivityKind(value: unknown): ActivityKind {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw.includes("meeting")) return "Meetings";
  if (raw.includes("course")) return "Courses";
  return "Challenges";
}

function deriveStatusTone(value: unknown): ActivityStatusTone {
  const raw = String(value ?? "").trim().toLowerCase();
  if (
    raw.includes("end") ||
    raw.includes("close") ||
    raw.includes("complete") ||
    raw.includes("finish")
  ) {
    return "ended";
  }

  if (
    raw.includes("join") ||
    raw.includes("open") ||
    raw.includes("active") ||
    raw.includes("publish") ||
    raw.includes("public")
  ) {
    return "join";
  }

  return "pending";
}

function normalizeActivity(item: any, index: number) {
  const kind = deriveActivityKind(item?.activity_type ?? item?.category ?? item?.kind);
  return {
    id: toStringValue(item?.activity_id ?? item?.id, `activity-${index}`),
    title: toStringValue(item?.activity_name ?? item?.title, "Activity"),
    difficulty: toStringValue(item?.difficulty ?? item?.activity_difficulty, "-") || "-",
    category: toStringValue(item?.category ?? item?.activity_type ?? item?.type, kind),
    kind,
    xp: toNumber(item?.xp ?? item?.activity_xp ?? item?.xp_reward ?? 0),
    status: toStringValue(item?.activity_status ?? item?.status, "pending"),
    statusTone: deriveStatusTone(item?.activity_status ?? item?.status),
  };
}

function normalizeParticipant(item: any, index: number) {
  const firstName = toStringValue(item?.first_name ?? item?.participant_first_name);
  const lastName = toStringValue(item?.last_name ?? item?.participant_last_name);
  const name =
    `${firstName} ${lastName}`.trim() ||
    toStringValue(item?.participant_name ?? item?.name, `Participant ${index + 1}`);

  return {
    id: toStringValue(item?.participant_id ?? item?.user_id ?? item?.id, `participant-${index}`),
    name,
    subtitle:
      toStringValue(item?.major) ||
      toStringValue(item?.faculty) ||
      toStringValue(item?.university) ||
      toStringValue(item?.email, "Participant"),
    score: toNumber(item?.score ?? item?.xp ?? item?.level ?? item?.current_exp ?? 0),
    avatarBg: ["#f1d6d8", "#efd0bf", "#c7dce7", "#e5d7c8", "#d8e7f1"][index % 5],
    initials: buildInitials(firstName, lastName, item?.email ?? item?.participant_email),
  };
}

function normalizeOrg(orgRaw: any, fallbackEmail: string) {
  const contact = toContact(orgRaw?.contact);
  const social = toContact(orgRaw?.social_links);

  return {
    orgId: toStringValue(orgRaw?.org_id),
    orgName: toStringValue(orgRaw?.org_name, "Organization"),
    aboutUs: toStringValue(orgRaw?.about_org),
    companySize: toStringValue(orgRaw?.size),
    businessType:
      toStringValue(contact?.businessType) ||
      toStringValue(contact?.business_type) ||
      toStringValue(orgRaw?.business_type),
    location:
      toStringValue(contact?.location) ||
      toStringValue(contact?.address) ||
      toStringValue(orgRaw?.building_id),
    email: toStringValue(contact?.email, fallbackEmail),
    phone: toStringValue(contact?.phone),
    website: toStringValue(orgRaw?.website_url),
    logoPreview: toPublicAssetUrl(orgRaw?.logo),
    buildingId: toStringValue(orgRaw?.building_id),
    positionX: toNumber(orgRaw?.position_x),
    positionY: toNumber(orgRaw?.position_y),
    linkedin: toStringValue(social?.linkedin) || toStringValue(contact?.linkedin),
    facebook: toStringValue(social?.facebook) || toStringValue(contact?.facebook),
    instagram: toStringValue(social?.instagram) || toStringValue(contact?.instagram),
    youtube: toStringValue(social?.youtube) || toStringValue(contact?.youtube),
    tiktok: toStringValue(social?.tiktok) || toStringValue(contact?.tiktok),
    raw: orgRaw,
  };
}

export async function GET(req: Request) {
  try {
    const context = await getEmployeeContext(req);

    if (context.role !== "employee") {
      return NextResponse.json(
        { ok: false, message: "Only employee accounts can access this route" },
        { status: 403 }
      );
    }

    if (!context.orgId) {
      return NextResponse.json(
        { ok: false, message: "Organization not found for this employee" },
        { status: 404 }
      );
    }

    const [orgRaw, dashboardRaw, employeeRows] = await Promise.all([
      fetchJson(`${BACKEND}/org/${encodeURIComponent(context.orgId)}`, context.accessToken),
      context.empId
        ? fetchJson(`${BACKEND}/org/dashboard/${encodeURIComponent(context.empId)}`, context.accessToken)
        : Promise.resolve({}),
      listEmployeesByOrgId(context.orgId),
    ]);

    const activitiesRaw: any[] = Array.isArray(dashboardRaw?.activity_info)
      ? dashboardRaw.activity_info
      : Array.isArray(dashboardRaw?.activities)
        ? dashboardRaw.activities
        : Array.isArray(dashboardRaw?.data?.activity_info)
          ? dashboardRaw.data.activity_info
          : [];

    const activities: NormalizedActivity[] = activitiesRaw.map((item, index) =>
      normalizeActivity(item, index)
    );

    const publishedCount = activities.filter((item) => item.statusTone === "join").length;
    const pendingCount = activities.filter((item) => item.statusTone === "pending").length;
    const meetingCount = activities.filter((item) => item.kind === "Meetings").length;
    const courseCount = activities.filter((item) => item.kind === "Courses").length;
    const challengeCount = activities.filter((item) => item.kind === "Challenges").length;

    const participantsRaw: any[] = Array.isArray(dashboardRaw?.participants)
      ? dashboardRaw.participants
      : Array.isArray(dashboardRaw?.participant_info)
        ? dashboardRaw.participant_info
        : Array.isArray(dashboardRaw?.students)
          ? dashboardRaw.students
          : [];

    const participants: NormalizedParticipant[] = participantsRaw.map((item, index) =>
      normalizeParticipant(item, index)
    );

    const employees = employeeRows.map((row) => ({
      id: row.emp_id,
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      position: row.position || "",
      phone: row.phone || "",
      email: row.email || "",
      canCheckChallenge: Boolean(row.can_check_challenge),
      avatarIndex: avatarIndexFromChoice(row.avatar_choice),
      avatarChoice: row.avatar_choice,
      isProfileComplete: Boolean(row.is_profile_complete),
    }));

    const summary = {
      totalActivities:
        toNumber(dashboardRaw?.total_activities, activities.length) || activities.length,
      totalParticipants:
        toNumber(dashboardRaw?.total_participants, participants.length) || participants.length,
      meetings: toNumber(dashboardRaw?.meeting_count, meetingCount) || meetingCount,
      courses: toNumber(dashboardRaw?.course_count, courseCount) || courseCount,
      challenges: toNumber(dashboardRaw?.challenge_count, challengeCount) || challengeCount,
      published: toNumber(dashboardRaw?.published_count, publishedCount) || publishedCount,
      draft: toNumber(dashboardRaw?.draft_count, pendingCount) || pendingCount,
    };

    return NextResponse.json({
      ok: true,
      data: {
        account: {
          userId: context.userId,
          empId: context.empId,
          orgId: context.orgId,
          email: context.email,
        },
        org: normalizeOrg(orgRaw, context.email || context.emailFromToken || ""),
        summary,
        activities,
        participants,
        employees,
      },
    });
  } catch (error: any) {
    const message = error?.message || "Server error";
    const status = message === "Unauthorized" || message === "Invalid token" ? 401 : 500;

    return NextResponse.json({ ok: false, message }, { status });
  }
}
