import Redis from "ioredis";

let redisClient: Redis | null = null;

export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export function getRedis() {
  if (redisClient) return redisClient;

  const redisUrl = getRequiredEnv("REDIS_URL");
  redisClient = new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });

  return redisClient;
}

export function ok(data: unknown) {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, ...((data || {}) as object) }),
  };
}

export function badRequest(message: string) {
  return {
    statusCode: 400,
    body: JSON.stringify({ ok: false, message }),
  };
}

export function unauthorized(message: string) {
  return {
    statusCode: 401,
    body: JSON.stringify({ ok: false, message }),
  };
}

export async function addConnection(
  redis: Redis,
  payload: { connectionId: string; userId: string; roomId: string }
) {
  const connectionKey = `rt:conn:${payload.connectionId}`;
  const roomMembersKey = `rt:room:${payload.roomId}:members`;
  const userConnectionsKey = `rt:user:${payload.userId}:connections`;

  await redis.multi()
    .hset(connectionKey, {
      connectionId: payload.connectionId,
      userId: payload.userId,
      roomId: payload.roomId,
      connectedAt: String(Date.now()),
    })
    .expire(connectionKey, 60 * 60 * 24)
    .sadd(roomMembersKey, payload.connectionId)
    .sadd(userConnectionsKey, payload.connectionId)
    .exec();
}