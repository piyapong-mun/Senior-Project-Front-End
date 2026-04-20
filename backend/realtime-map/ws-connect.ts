import { jwtVerify } from "jose";
import {
  addConnection,
  badRequest,
  getRedis,
  getRequiredEnv,
  ok,
  unauthorized,
} from "./shared";

type ConnectClaims = {
  userId?: string;
  roomId?: string;
  scope?: string;
};

export const handler = async (event: any) => {
  try {
    const connectionId = event?.requestContext?.connectionId;
    const token = event?.queryStringParameters?.token || "";
    const secret = getRequiredEnv("MAP_WS_JWT_SECRET");

    console.log("[ws-connect] connectionId =", connectionId);
    console.log("[ws-connect] hasToken =", !!token);
    console.log("[ws-connect] queryStringParameters =", event?.queryStringParameters || null);

    if (!connectionId) {
      return badRequest("Missing connectionId");
    }

    if (!token) {
      return unauthorized("Missing token");
    }

    const verified = await jwtVerify<ConnectClaims>(
      token,
      new TextEncoder().encode(secret)
    );

    const claims = verified.payload || {};
    const userId = String(claims.userId || "");
    const roomId = String(claims.roomId || "");
    const scope = String(claims.scope || "");

    console.log("[ws-connect] claims =", { userId, roomId, scope });

    if (!userId || !roomId) {
      return unauthorized("Invalid token payload");
    }

    if (scope !== "map:presence") {
      return unauthorized("Invalid token scope");
    }

    const redis = getRedis();

    await addConnection(redis, {
      connectionId,
      userId,
      roomId,
    });

    return ok({ connected: true });
  } catch (error: any) {
    console.error("[ws-connect] error =", error);

    const message =
      typeof error?.message === "string" ? error.message : "Connect failed";

    if (
      message.includes("JWT") ||
      message.includes("signature") ||
      message.includes("token") ||
      message.includes("scope")
    ) {
      return unauthorized(message);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message,
      }),
    };
  }
};