import { NextResponse } from "next/server";

const BACKEND_URL =
  (process.env.BACKEND_URL || "https://vcep-platform.duckdns.org").replace(/\/$/, "");

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

    if (!Array.isArray(parsedBody)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid response format from backend",
          detail: parsedBody,
        },
        { status: 502 }
      );
    }

    const normalized = parsedBody.map((item: any) => ({
      skillId: String(item?.SkillID ?? ""),
      skillName: String(item?.SkillName ?? ""),
      skillCategory: String(item?.SkillCategory ?? ""),
    }));

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