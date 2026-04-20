import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";

// =====================
// Helper functions : Read cookie
// =====================
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

// =====================
// Helper functions : Fetch authenticated cookies data
// =====================
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
        } catch { }
    }

    const accessToken = readCookie(cookieHeader, "vcep_access");
    const idToken = readCookie(cookieHeader, "vcep_id");

    if (!accessToken || !idToken) return null;

    return { accessToken, idToken };
}

// =====================
// Main API : Get Organization Activities
// =====================
// Example URL: /api/organization/org-activities?orgId=123e4567-e89b-12d3-a456-426614174000
export async function GET(req: Request) {
    try {

        // Get Cookie and Check Auth
        const sess = getSessionTokens(req);
        if (!sess) {
            return NextResponse.json(
                { ok: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get orgId from URL query param
        const { searchParams } = new URL(req.url);
        const orgId = searchParams.get("orgId") || searchParams.get("org_id") || searchParams.get("orgid");

        if (!orgId) {
            return NextResponse.json(
                { ok: false, message: "Missing orgId parameter" },
                { status: 400 }
            );
        }


        // Filter activity using backend API /activity/filter/org
        // We set status to "" for everything else initially

        //   {
        //   "enroll_end_at": "string",
        //   "enroll_start_at": "string",
        //   "org_id": "string",
        //   "run_end_at": "string",
        //   "run_start_at": "string",
        //   "status": "string",
        //   "visibility": "string"
        //   }

        const filterResOpenEnded = await fetch(`${BACKEND}/activity/filter/org`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${sess.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                org_id: orgId,
                status: "Publish",
                is_open_ended: true,
            }),
        });



        if (!filterResOpenEnded.ok) {
            const errText = await filterResOpenEnded.text();
            throw new Error(`Failed to filter activities: ${errText}`);
        }

        // "0001-01-01T00:00:00Z" time format
        const now = new Date().toISOString();
        // to expected format
        const expectedTimeFormat = now.slice(0, 19) + "Z";

        console.log("expectedTimeFormat: ", expectedTimeFormat);

        const filterResNotOpenEnded = await fetch(`${BACKEND}/activity/filter/org`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${sess.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                org_id: orgId,
                status: "Publish",
                is_open_ended: false,
                enroll_end_at: expectedTimeFormat,
                enroll_start_at: expectedTimeFormat,

            }),
        });

        const activities = await filterResOpenEnded.json() || [];
        const activities2 = await filterResNotOpenEnded.json() || [];
        const activities_res = [...activities, ...activities2];

        // Return organization activities
        return NextResponse.json({
            ok: true,
            data: activities_res || [],
        });

    } catch (e: any) {
        console.log("Error: ", e);
        return NextResponse.json(
            { ok: false, message: e?.message || "Server Error" },
            { status: 500 }
        );
    }
}