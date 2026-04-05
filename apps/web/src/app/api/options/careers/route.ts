import { NextResponse } from "next/server";

const BACKEND_URL = (
  process.env.BACKEND_URL || "https://vcep-platform.duckdns.org"
).replace(/\/$/, "");

// GET /api/options/jobs → คืน OptionItem[] { id, name }
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/career/interest-career`, {
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
    const normalized = body
      .map((item: any) => ({
        id: String(item?.id ?? "").trim(),
        name: String(item?.career_name ?? "").trim(),
        field: String(item?.field ?? "").trim(),
      }))
      .filter((item) => item.id && item.name);

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: "Failed to load careers", detail: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/options/jobs → เพิ่ม career ใหม่
// body: { career_name: string, field?: string }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const career_name = String(body?.career_name ?? "").trim();
    const field = String(body?.field ?? "").trim();

    if (!career_name) {
      return NextResponse.json(
        { ok: false, message: "career_name is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/career/interest-career`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ career_name, field }),
      cache: "no-store",
    });

    const rawText = await response.text();
    let resBody: any = null;

    try {
      resBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      resBody = rawText;
    }

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: "Backend error", detail: resBody },
        { status: response.status }
      );
    }

    // คืน OptionItem ของรายการที่เพิ่งเพิ่ม
    const created = {
      id: String(resBody?.id ?? resBody?.career_id ?? "").trim(),
      name: career_name,
      field,
    };

    return NextResponse.json({ ok: true, item: created });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: "Failed to add career", detail: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
