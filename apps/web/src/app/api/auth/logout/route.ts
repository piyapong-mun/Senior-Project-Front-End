import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  response.cookies.set("vcep_session", "", cookieOptions);
  response.cookies.set("vcep_id", "", cookieOptions);
  response.cookies.set("vcep_access", "", cookieOptions);

  return response;
}