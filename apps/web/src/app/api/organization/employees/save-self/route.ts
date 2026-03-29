import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const user_id = String(body.userId || "");
    const org_id = String(body.orgId || "");
    const first_name = String(body.firstName || "").trim();
    const last_name = String(body.lastName || "").trim();
    const phone = String(body.phone || "").trim();
    const position = String(body.position || "").trim();
    const is_reviewer = !!body.canCheckChallenge;
    const avatar_choice = String(body.avatarId || ""); // ✅ uuid

    if (!user_id || !org_id) {
      return NextResponse.json({ ok: false, message: "missing userId/orgId" }, { status: 400 });
    }
    if (!first_name || !last_name) {
      return NextResponse.json({ ok: false, message: "missing name" }, { status: 400 });
    }
    if (!avatar_choice) {
      return NextResponse.json({ ok: false, message: "missing avatarId" }, { status: 400 });
    }

    const upstream = await fetch(`${process.env.BACKEND_URL}/org/employee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        org_id,
        first_name,
        last_name,
        phone,
        position,
        is_reviewer,
        avatar_choice,
      }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return new NextResponse(text, { status: upstream.status });
    }

    return new NextResponse(text, { status: 200 });
  } catch (e: any) {
    console.error("save-self ERROR:", e);
    return NextResponse.json({ ok: false, message: "save failed" }, { status: 500 });
  }
}