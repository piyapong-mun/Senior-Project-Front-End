import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "vcep_session";
const S3_REGION =
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "ap-southeast-2";

const s3 = new S3Client({
    region: S3_REGION,
});


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
// Helper functions : Upload to S3
// =====================
// ------------------------------------------------------------------------------------------------------
const uploadToS3 = async (file: File, idToken: string, bucketName: string, folderName: string) => {
    const jwt = decodeJwt(idToken);
    const cognitoUserId = String(jwt.sub || "").trim();

    if (!cognitoUserId) {
        throw new Error("Invalid token");
    }

    const safeFolderName = folderName.replace(/^\/+|\/+$/g, "");
    const safeFileName = file.name.replace(/[\\/]+/g, "_");
    const key = `${safeFolderName}/${cognitoUserId}/${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "no-cache, no-store, must-revalidate",
    });

    const result = await s3.send(command);

    const publicBaseUrl = (
        process.env.S3_PUBLIC_BASE_URL ||
        process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
        `https://${bucketName}.s3.${S3_REGION}.amazonaws.com`
    ).replace(/\/+$/, "");

    return {
        bucket: bucketName,
        key,
        url: `${publicBaseUrl}/${key}`,
        etag: result.ETag || null,
    };
};
// ------------------------------------------------------------------------------------------------------

// =====================
// PUT /api/s3/upload
// =====================
// ------------------------------------------------------------------------------------------------------
export async function PUT(req: Request) {
    try {
        const tokens = getSessionTokens(req);
        if (!tokens) {
            return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file");
        const bucketName = formData.get("bucketName")?.toString().trim() || "";
        const folderName = formData.get("folderName")?.toString().trim() || "";

        if (!(file instanceof File)) {
            return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
        }

        if (!bucketName) {
            return NextResponse.json({ ok: false, error: "MISSING_BUCKET_NAME" }, { status: 400 });
        }

        if (!folderName) {
            return NextResponse.json({ ok: false, error: "MISSING_FOLDER_NAME" }, { status: 400 });
        }

        const result = await uploadToS3(file, tokens.idToken, bucketName, folderName);
        return NextResponse.json({ ok: true, result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "UPLOAD_FAILED";
        return NextResponse.json(
            { ok: false, error: message },
            { status: 500 }
        );
    }
}
// ------------------------------------------------------------------------------------------------------

// Usage
// const formData = new FormData();
// formData.append("file", file);
// formData.append("bucketName", "vcep-assets-dev");
// formData.append("folderName", "org-logos");

// const res = await fetch(`/api/s3`, {
//     method: "PUT",
//     body: formData,
// });
