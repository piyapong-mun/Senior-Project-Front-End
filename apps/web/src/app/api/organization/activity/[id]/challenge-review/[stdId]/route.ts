// วางที่: app/api/organization/activity/[id]/challenge-review/[stdId]/route.ts

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL || "https://vcep-platform.duckdns.org";

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const found = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!found) return null;
  try { return decodeURIComponent(found.slice(name.length + 1)); }
  catch { return found.slice(name.length + 1); }
}

function getToken(req: NextRequest): string {
  const cookieHeader = req.headers.get("cookie");
  const raw = readCookie(cookieHeader, "vcep_session");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { accessToken?: string };
      if (parsed?.accessToken) return parsed.accessToken;
    } catch {}
  }
  return readCookie(cookieHeader, "vcep_access") ?? req.cookies.get("vcep_access")?.value ?? "";
}

function pickFirst(source: any, keys: string[]): any {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function parseMaybeJson(value: any): any {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  // try base64 decode first
  try {
    const decoded = Buffer.from(value, "base64").toString("utf-8");
    if (decoded.trim().startsWith("{") || decoded.trim().startsWith("[")) {
      return JSON.parse(decoded);
    }
  } catch {}
  // plain JSON string
  try { return JSON.parse(value); } catch {}
  return {};
}

function normalizeSkills(raw: any) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => ({
      skill_name: String(item?.skill_name ?? item?.skillName ?? item?.name ?? "").trim(),
      level: String(item?.level ?? item?.Level ?? "").trim(),
    }))
    .filter((item) => item.skill_name);
}

function normalizeArtifact(rawArtifact: any) {
  if (!rawArtifact) return null;

  const artifact = parseMaybeJson(rawArtifact);
  if (!artifact || typeof artifact !== "object" || Object.keys(artifact).length === 0) return null;

  const fileUrl = String(
    pickFirst(artifact, ["file_submission", "FileSubmission", "file", "url", "link", "file_url"])
  ).trim();
  const textSubmission = String(
    artifact?.text_submission ?? artifact?.TextSubmission ?? ""
  ).trim();
  const qrCode = String(
    pickFirst(artifact, ["qrcode_checkin", "QrcodeCheckin", "qrcode", "checkin_code"])
  ).trim();
  const quizPayload = artifact?.Quized ?? artifact?.quized ?? artifact?.quiz ?? null;

  if (fileUrl) {
    return {
      type: "file" as const,
      url: fileUrl,
      label: fileUrl.split("/").pop()?.split("?")[0] || "Open submission file",
      payload: textSubmission ? { text_submission: textSubmission } : null,
    };
  }
  if (qrCode) return { type: "checkin" as const, url: "", label: qrCode, payload: null };
  if (quizPayload) return { type: "quiz" as const, url: "", label: "Quiz result", payload: quizPayload };
  if (textSubmission) return { type: "raw" as const, url: "", label: "Text submission", payload: { text_submission: textSubmission } };

  return { type: "raw" as const, url: "", label: "Submission artifact", payload: artifact };
}

async function tryFetch(url: string, token: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
    const text = await res.text().catch(() => "");
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 500, data: {} };
  }
}

function normalizeReview(submissionRow: any, detailData?: any) {
  // submission row fields (snake_case from list endpoint)
  const sub = submissionRow && typeof submissionRow === "object" ? submissionRow : {};

  // detail response: { feedback: {...}, submission: {...} }
  const detail = detailData && typeof detailData === "object" ? detailData : {};
  const feedbackObj = detail?.feedback ?? {};
  const submissionDetail = detail?.submission ?? {};

  // artifact: prefer detail submission, fallback to list row
  // detail submission uses PascalCase: Artifact (may be base64)
  const rawArtifact =
    submissionDetail?.Artifact ??
    submissionDetail?.artifact ??
    sub?.artifact ??
    sub?.Artifact ??
    null;

  // text submission from artifact
  const artifactParsed = parseMaybeJson(rawArtifact);
  const textNote =
    String(artifactParsed?.text_submission ?? artifactParsed?.TextSubmission ?? "").trim() ||
    String(sub?.note ?? submissionDetail?.Note ?? "").trim();

  return {
    submissionId: String(
      sub?.submission_id ??
      submissionDetail?.SubmissionID ?? submissionDetail?.submission_id ??
      ""
    ).trim(),
    stdId: String(
      sub?.std_id ?? submissionDetail?.StdID ?? submissionDetail?.std_id ?? ""
    ).trim(),
    activityId: String(
      sub?.activity_id ?? submissionDetail?.ActivityID ?? submissionDetail?.activity_id ?? ""
    ).trim(),
    submittedAt: String(
      sub?.submitted_at ??
      submissionDetail?.SubmittedAt ?? submissionDetail?.submitted_at ??
      ""
    ).trim(),
    status: String(
      feedbackObj?.Status ?? feedbackObj?.status ??
      sub?.status ?? submissionDetail?.Status ?? submissionDetail?.status ??
      ""
    ).trim(),
    note: textNote,
    score: Number(feedbackObj?.ScoreID ? 0 : (sub?.score ?? submissionDetail?.score ?? 0)),
    xp: Number(sub?.xp ?? submissionDetail?.xp ?? submissionDetail?.XP ?? 0),
    level: String(feedbackObj?.Level ?? feedbackObj?.level ?? "").trim(),
    feedback: String(feedbackObj?.Feedback ?? feedbackObj?.feedback ?? "").trim(),
    reviewerId: String(feedbackObj?.ReviewerID ?? feedbackObj?.reviewer_id ?? "").trim(),
    skills: normalizeSkills(
      feedbackObj?.skills_name ?? feedbackObj?.SkillsName ??
      sub?.skills_name ?? sub?.skills ?? []
    ),
    artifact: normalizeArtifact(rawArtifact),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; stdId: string }> }
) {
  const { id, stdId } = await context.params;
  const token = getToken(req);

  const studentSubmissionsRes = await tryFetch(
    `${BACKEND_URL}/activity/submission/studentid/${encodeURIComponent(stdId)}`,
    token
  );

  if (!studentSubmissionsRes.ok) {
    return NextResponse.json({ ok: true, review: null });
  }

  const rows = Array.isArray(studentSubmissionsRes.data)
    ? studentSubmissionsRes.data
    : Array.isArray(studentSubmissionsRes.data?.submissions)
    ? studentSubmissionsRes.data.submissions
    : Array.isArray(studentSubmissionsRes.data?.data)
    ? studentSubmissionsRes.data.data
    : [];

  // match by activity_id — support both snake_case and PascalCase
  const matched = rows.find((row: any) => {
    const activityId = String(
      row?.activity_id ?? row?.ActivityID ?? row?.activityID ?? ""
    ).trim();
    return activityId === id;
  });

  if (!matched) return NextResponse.json({ ok: true, review: null });

  const submissionId = String(
    matched?.submission_id ?? matched?.SubmissionID ?? ""
  ).trim();

  if (!submissionId) {
    return NextResponse.json({ ok: true, review: normalizeReview(matched) });
  }

  // fetch detail: GET /activity/submission/{submission_id}
  // returns { feedback: {...}, submission: {...} }
  const detailRes = await tryFetch(
    `${BACKEND_URL}/activity/submission/${encodeURIComponent(submissionId)}`,
    token
  );

  if (!detailRes.ok) {
    return NextResponse.json({ ok: true, review: normalizeReview(matched) });
  }

  return NextResponse.json({
    ok: true,
    review: normalizeReview(matched, detailRes.data),
  });
}