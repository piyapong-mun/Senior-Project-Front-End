import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const BACKEND = process.env.BACKEND_URL;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ap-southeast-2";

const S3_PUBLIC_BASE_URL =
  process.env.S3_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
  `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

const s3 = new S3Client({
  region: S3_REGION,
});

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

function getSessionTokens(req: Request) {
  const cookieHeader = req.headers.get("cookie");

  const raw = readCookie(cookieHeader, COOKIE_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        idToken?: string;
        accessToken?: string;
      };
      if (parsed?.idToken && parsed?.accessToken) return parsed;
    } catch { }
  }

  const idToken = readCookie(cookieHeader, "vcep_id");
  const accessToken = readCookie(cookieHeader, "vcep_access");

  if (!idToken || !accessToken) return null;
  return { idToken, accessToken };
}

async function getEmpId(accessToken: string, idToken: string) {
  const jwt = decodeJwt(idToken);
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

  if (login.status === 200 && json?.user_id) {
    const empIdReq = await fetch(`${BACKEND}/org/employee/${json.user_id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const rawEmpId = await empIdReq.text();
    let jsonEmpId: any = null;
    try {
      jsonEmpId = rawEmpId ? JSON.parse(rawEmpId) : null;
    } catch {
      throw new Error("User not found");
    }

    if (empIdReq.status === 200 && jsonEmpId?.emp_id) {
      return { empId: jsonEmpId.emp_id, orgId: jsonEmpId.org_id };
    }
  }
  throw new Error("User not found");
}

async function getDashboard(emp_id: string, accessToken: string) {
  const res = await fetch(`${BACKEND}/org/dashboard/${emp_id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const sess = getSessionTokens(req);
    const idToken = sess?.idToken;
    const accessToken = sess?.accessToken;

    if (!idToken || !accessToken) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 1. Get identity
    console.log("-> 1. Calling getEmpId");
    const { empId, orgId } = await getEmpId(accessToken, idToken) as any;
    console.log("-> 1. getEmpId Result:", empId, orgId);
    if (!empId) {
      return NextResponse.json(
        { ok: false, message: "Employee not found" },
        { status: 404 }
      );
    }

    // 2. Fetch existing org data
    console.log("-> 2. Calling getDashboard with empId:", empId);
    const dashboardData = await getDashboard(empId, accessToken);
    const currentOrg = dashboardData?.orgDashboard ?? dashboardData;
    console.log("-> 2. currentOrg found:", !!currentOrg);
    if (!currentOrg) {
      return NextResponse.json(
        { ok: false, message: "Org missing" },
        { status: 404 }
      );
    }

    console.log("-> 3. Parsing formData");
    const formData = await req.formData();
    console.log("-> 3. FormData parsed successfully.");

    // Parse form fields
    const orgName = formData.get("orgName")?.toString().trim() || currentOrg.org_name || "";
    const companySize = formData.get("companySize")?.toString().trim() || currentOrg.size || "";
    const aboutUs = formData.get("aboutUs")?.toString().trim() || currentOrg.about_org || "";
    const website = formData.get("website")?.toString().trim() || currentOrg.website_url || "";

    // Construct contact
    const email = formData.get("email")?.toString().trim() || "";
    const phone = formData.get("phone")?.toString().trim() || "";
    const facebook = formData.get("facebook")?.toString().trim() || "";
    const instagram = formData.get("instagram")?.toString().trim() || "";
    const youtube = formData.get("youtube")?.toString().trim() || "";
    const tiktok = formData.get("tiktok")?.toString().trim() || "";

    const contact = {
      email,
      phone,
      facebook,
      instagram,
      youtube,
      tiktok,
    };
    const contactStr = JSON.stringify(contact);

    // 3. Handle Logo S3 Upload properly
    let logoUrl = currentOrg.logo || "";
    const logoFile = formData.get("logoFile");

    if (logoFile instanceof File && logoFile.size > 0) {
      if (!logoFile.type.startsWith("image/")) {
        return NextResponse.json(
          { ok: false, message: "Only image files are allowed for logo" },
          { status: 400 }
        );
      }

      const jwt = decodeJwt(idToken);
      const cognitoUserId = jwt.sub;
      const key = `org-logos/${cognitoUserId}/${Date.now()}-logo.png`;
      const buffer = Buffer.from(await logoFile.arrayBuffer());

      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: logoFile.type,
          CacheControl: "no-cache, no-store, must-revalidate",
        })
      );

      const version = Date.now();
      logoUrl = `${S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}?v=${version}`;
    }

    // 4. PUT to backend
    const payload = {
      org_id: orgId,
      org_name: orgName,
      size: companySize,
      about_org: aboutUs,
      website_url: website,
      logo: logoUrl,
      contact: contactStr,
      building_id: currentOrg.building_id || "",
      position_x: currentOrg.position_x || 0,
      position_y: currentOrg.position_y || 0,
    };

    console.log("-> 4. PUT to backend payload:", JSON.stringify(payload));
    const putReq = await fetch(`${BACKEND}/org`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const putRaw = await putReq.text();
    console.log("-> 4. PUT response status:", putReq.status, "raw:", putRaw);
    let putResp: any;
    try {
      putResp = JSON.parse(putRaw);
    } catch {
      putResp = putRaw;
    }

    if (!putReq.ok) {
      return NextResponse.json(
        { ok: false, message: putResp?.message || putRaw || "Failed to update org" },
        { status: putReq.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Organization updated successfully",
      data: putResp,
    });
  } catch (e: any) {
    console.error(">>> UPDATE ROUTE ERROR CATCH: ", e?.message);
    if (e?.stack) console.error(e.stack);
    
    return NextResponse.json(
      { ok: false, message: e?.message || "Server Error", stack: e?.stack },
      { status: 500 }
    );
  }
}
