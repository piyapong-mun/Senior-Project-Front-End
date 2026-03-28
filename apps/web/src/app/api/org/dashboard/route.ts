import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

const BACKEND = process.env.BACKEND_URL;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";


// =====================
// Helper functions : Read cookie
// =====================    
// ------------------------------------------------------------------------------------------------------
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
// ------------------------------------------------------------------------------------------------------

// =====================
// Helper functions : Fetch authenticated cookies data
// =====================
// ------------------------------------------------------------------------------------------------------
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
// ------------------------------------------------------------------------------------------------------

// =====================
// Helper functions : Json return from Fetch
// =====================
// ------------------------------------------------------------------------------------------------------
async function fetchToOrgDashboard(url: string, accessToken: string): Promise<OrgDashboard> {
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        cache: "no-store",
    });

    const raw = await res.text();
    let json: any = null;

    try {
        json = raw ? JSON.parse(raw) : null;
        // Map to OrgDashboard
        json = mapToOrgDashboard(json);
    } catch {
        json = raw;
    }

    if (!res.ok) {
        throw new Error(
            `${url} failed: ${res.status} ${typeof json === "string" ? json : JSON.stringify(json)
            }`
        );
    }

    return json;
}
// ------------------------------------------------------------------------------------------------------

// =========================
// Helper functions : Map to OrgDashboard
// =========================
// ------------------------------------------------------------------------------------------------------
function mapToOrgDashboard(json: any): OrgDashboard {
    return {
        org_id: json.org_id,
        org_name: json.org_name,
        logo: json.logo,
        website_url: json.website_url,
        about_org: json.about_org,
        contact: json.contact,
        size: json.size,
        building_id: json.building_id,
        building_model: json.building_model,
        position_x: json.position_x,
        position_y: json.position_y,
        employees_info: json.employees_info,
        activity_stats_info: json.activity_stats_info,
        skill_stats_info: json.skill_stats_info,
        university_stats_info: json.university_stats_info,
        activity_info: json.activity_info,
        complete_stats_info: json.complete_stats_info,
    };
}
// ------------------------------------------------------------------------------------------------------

// =====================
// Fetch to Back-End
// =====================
// ------------------------------------------------------------------------------------------------------
type OrgDashboard = {
    org_id: string;
    org_name: string;
    logo: string;
    website_url: string;
    about_org: string;
    contact: string;
    size: string;
    building_id: string;
    building_model: string;
    position_x: number;
    position_y: number;
    employees_info: EmployeeInfo[];
    activity_stats_info: ActivityStatsInfo;
    skill_stats_info: SkillStatsInfo[];
    university_stats_info: UniversityStatsInfo[];
    activity_info: ActivityInfo[];
    complete_stats_info: CompleteStatsInfo[];
}

type EmployeeInfo = {
    emp_id: string;
    first_name: string;
    avatar_choice: string;
    avatar_model: string;
    last_name: string;
    phone: string;
    position: string;
    is_reviewer: boolean;
}

type ActivityStatsInfo = {
    total_activity: number;
    total_participant: number;
    total_course: number;
    total_meeting: number;
    total_challenge: number;
}

type SkillStatsInfo = {
    skill_id: string;
    skill_name: string;
    number: number;
}

type UniversityStatsInfo = {
    university: string;
    number: number;
}

type ActivityInfo = {
    activity_id: string;
    activity_name: string;
    activity_type: string;
    activity_status: string;
    enroll_start_at: string;
    enroll_end_at: string;
    run_start_at: string;
    run_end_at: string;
    max_participants: number;
    is_open_ended: boolean;
    state: string;
    hours: number;
}

// Will Load only 20 first student
type CompleteStatsInfo = {
    std_id: string;
    submmission_id: string;
    first_name: string;
    last_name: string;
    xp: number;
}

export type { OrgDashboard, EmployeeInfo, ActivityStatsInfo, SkillStatsInfo, UniversityStatsInfo, ActivityInfo, CompleteStatsInfo };

async function getDashboard(emp_id: string, accessToken: string): Promise<{ orgDashboard: OrgDashboard, accessToken: string }> {
    // BackEnd Path
    //http://localhost:1323/org/dashboard/emp_id
    const orgDashboard = await fetchToOrgDashboard(`${BACKEND}/org/dashboard/${emp_id}`, accessToken);
    return { orgDashboard, accessToken };
}
// ------------------------------------------------------------------------------------------------------

// =====================
// Helper functions : Get emp_id
// =====================
// ------------------------------------------------------------------------------------------------------
async function getEmpId(accessToken: string, idToken: string) {

    // Auth Login for get userID
    const jwt = decodeJwt(idToken);
    // http://localhost:1323/auth/login
    // data = { "cognito_user_id": "1234567890" }
    const login = await fetch(`${BACKEND}/auth/login`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            cognito_user_id: jwt.sub,
        }),
    });

    const raw = await login.text();
    let json: any = null;

    try {
        json = raw ? JSON.parse(raw) : null;
    } catch {
        json = raw;
    }



    // If login.status === 200 and user_id is not null fetch emp_id from /org/employee/{user_id}
    if (login.status === 200 && json.user_id) {
        const empId = await fetch(`${BACKEND}/org/employee/${json.user_id}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        const rawEmpId = await empId.text();
        let jsonEmpId: any = null;

        try {
            jsonEmpId = rawEmpId ? JSON.parse(rawEmpId) : null;
        } catch (error) {
            throw new Error("User not found");
        }

        if (empId.status === 200 && jsonEmpId.emp_id) {
            return jsonEmpId.emp_id;
        }
    }
    throw new Error("User not found");
}
// ------------------------------------------------------------------------------------------------------

// =====================
// Main API : Get Dashboard Data
// =====================
// ------------------------------------------------------------------------------------------------------
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

        // Auth and Login for get emp_id
        const empId = await getEmpId(sess.accessToken, sess.idToken);
        if (!empId) {
            return NextResponse.json(
                { ok: false, message: "Employee not found" },
                { status: 404 }
            );
        }

        // Get Org Dashboard Data
        const orgDashboard = await getDashboard(empId, sess.accessToken);
        if (!orgDashboard) {
            return NextResponse.json(
                { ok: false, message: "Org Dashboard not found" },
                { status: 404 }
            );
        }

        // Return Org Dashboard Data
        return NextResponse.json({
            ok: true,
            data: orgDashboard,
        });

    } catch (e: any) {
        return NextResponse.json(
            { ok: false, message: e?.message || "Server Error" },
            { status: 500 }
        );
    }
}
// ------------------------------------------------------------------------------------------------------