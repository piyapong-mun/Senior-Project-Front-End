import { NextResponse } from "next/server";

const BACKEND_URL =
  (process.env.BACKEND_URL || "https://vcep-platform.duckdns.org").replace(/\/$/, "");

function normalizeSkill(item: any) {
  return {
    skillId: String(
      item?.skillId ??
      item?.skillID ??
      item?.SkillID ??
      item?.skill_id ??
      item?.id ??
      ""
    ),
    skillName: String(
      item?.skillName ??
      item?.SkillName ??
      item?.skill_name ??
      item?.name ??
      ""
    ),
    skillCategory: String(
      item?.skillCategory ??
      item?.SkillCategory ??
      item?.skill_category ??
      item?.category ??
      ""
    ),
  };
}

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/activity/skills`, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });

    const rawText = await response.text();
    let parsedBody: any = [];

    try {
      parsedBody = rawText ? JSON.parse(rawText) : [];
    } catch {
      parsedBody = rawText;
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Failed to load activity skills",
          detail: parsedBody,
        },
        { status: response.status }
      );
    }

    const rawSkills = Array.isArray(parsedBody)
      ? parsedBody
      : Array.isArray(parsedBody?.skills)
      ? parsedBody.skills
      : [];

    if (!Array.isArray(rawSkills)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid response format from backend",
          detail: parsedBody,
        },
        { status: 502 }
      );
    }

    const normalized = rawSkills
      .map((item: any) => normalizeSkill(item))
      .filter((item) => item.skillId && item.skillName);

    return NextResponse.json({
      ok: true,
      skills: normalized,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to load activity skills",
        detail: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}