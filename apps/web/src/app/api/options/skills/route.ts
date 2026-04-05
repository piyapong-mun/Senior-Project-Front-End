import { NextResponse } from "next/server";

const BACKEND_URL = (
  process.env.BACKEND_URL || "https://vcep-platform.duckdns.org"
).replace(/\/$/, "");

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/activity/skills`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const rawText = await response.text();
    let body: any = [];

    try {
      body = rawText ? JSON.parse(rawText) : [];
    } catch {
      return NextResponse.json(
        { ok: false, message: "Invalid JSON from backend" },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: "Backend error", detail: body },
        { status: response.status }
      );
    }

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, message: "Unexpected response format from backend" },
        { status: 502 }
      );
    }

    // normalize → OptionItem { id, name } ที่ SelectorBox ใช้
    // รองรับทั้ง PascalCase (SkillID, SkillName) และ camelCase (skillId, skillName)
    const normalized = body
      .map((item: any) => ({
        id: String(
          item?.SkillID ?? item?.skillId ?? item?.skill_id ?? ""
        ).trim(),
        name: String(
          item?.SkillName ?? item?.skillName ?? item?.skill_name ?? ""
        ).trim(),
      }))
      .filter((item) => item.id && item.name); // ตัดรายการที่ข้อมูลไม่ครบออก

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to load skills",
        detail: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}