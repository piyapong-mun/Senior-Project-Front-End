import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

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
// Helper functions : Upload to S3
// =====================
// ------------------------------------------------------------------------------------------------------
const uploadToS3 = async (file: File, idToken: string, bucketName: string, folderName: string) => {
    const region = process.env.AWS_REGION || "ap-southeast-2";
    const identityPoolId = process.env.COGNITO_IDENTITY_POOL_ID || "";
    const userPoolId = process.env.COGNITO_USER_POOL_ID || "";

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Setup the credential provider
    const credentialsProvider = fromCognitoIdentityPool({
        identityPoolId: identityPoolId,
        logins: {
            [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken
        },
        clientConfig: { region }
    });

    // 2. Initialize S3 with the provider
    const s3Client = new S3Client({
        region,
        credentials: credentialsProvider
    });

    // 3. Get your unique Identity ID (used for the folder name)
    const { identityId } = await credentialsProvider();

    // 4. Upload the file
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `${folderName}/${identityId}/${file.name}`, // Files go into: identityId/filename.png
        Body: buffer,
        ContentType: file.type,
    });

    const result = await s3Client.send(command);
    return result;
};
// ------------------------------------------------------------------------------------------------------

// =====================
// PUT /api/s3/upload
// =====================
// ------------------------------------------------------------------------------------------------------
export async function PUT(req: Request) {
    const tokens = getSessionTokens(req);
    console.log("tokens", tokens);
    if (!tokens) {
        return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucketName = formData.get("bucketName") as string | null;
    const folderName = formData.get("folderName") as string | null;

    if (!file) {
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

