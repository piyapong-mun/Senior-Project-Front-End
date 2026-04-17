import { jwtVerify } from "jose";
import { saveConnection } from "./shared";

export const handler = async (event: any) => {
  try {
    const token = event.queryStringParameters?.token;
    if (!token) {
      return { statusCode: 401, body: "Missing token" };
    }

    const secret = process.env.MAP_WS_JWT_SECRET;
    if (!secret) {
      return { statusCode: 500, body: "Missing MAP_WS_JWT_SECRET" };
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const userId = String(payload.userId || "");
    const roomId = String(payload.roomId || "student-explore");
    const connectionId = String(event.requestContext.connectionId || "");

    if (!userId || !connectionId) {
      return { statusCode: 401, body: "Invalid token payload" };
    }

    await saveConnection({
      connectionId,
      userId,
      roomId,
    });

    return { statusCode: 200, body: "Connected" };
  } catch {
    return { statusCode: 401, body: "Unauthorized" };
  }
};
