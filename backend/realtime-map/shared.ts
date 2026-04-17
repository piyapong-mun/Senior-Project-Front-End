import Redis from "ioredis";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

export type ConnectionMeta = {
  connectionId: string;
  userId: string;
  roomId: string;
};

export type PlayerPresence = {
  userId: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotationY?: number;
  avatarModelUrl?: string | null;
  updatedAt: number;
};

const redis = new Redis(process.env.REDIS_URL || "", {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: false,
});

const PRESENCE_TTL_SEC = 20;

const connectionKey = (connectionId: string) => `map:conn:${connectionId}`;
const roomConnectionsKey = (roomId: string) => `map:room:${roomId}:connections`;
const roomUsersKey = (roomId: string) => `map:room:${roomId}:users`;
const playerKey = (roomId: string, userId: string) => `map:room:${roomId}:player:${userId}`;

export function buildManagementApi(event: any) {
  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  return new ApiGatewayManagementApiClient({ endpoint });
}

export async function postJson(
  client: ApiGatewayManagementApiClient,
  connectionId: string,
  payload: Record<string, unknown>
) {
  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(payload)),
    })
  );
}

export async function saveConnection(meta: ConnectionMeta) {
  await redis.multi()
    .set(connectionKey(meta.connectionId), JSON.stringify(meta), "EX", 60 * 60)
    .sadd(roomConnectionsKey(meta.roomId), meta.connectionId)
    .exec();
}

export async function deleteConnection(connectionId: string) {
  const current = await getConnection(connectionId);
  if (!current) return null;

  await redis.multi()
    .del(connectionKey(connectionId))
    .srem(roomConnectionsKey(current.roomId), connectionId)
    .exec();

  return current;
}

export async function getConnection(connectionId: string): Promise<ConnectionMeta | null> {
  const raw = await redis.get(connectionKey(connectionId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ConnectionMeta;
  } catch {
    return null;
  }
}

export async function savePlayer(roomId: string, player: PlayerPresence) {
  await redis.multi()
    .set(playerKey(roomId, player.userId), JSON.stringify(player), "EX", PRESENCE_TTL_SEC)
    .sadd(roomUsersKey(roomId), player.userId)
    .exec();
}

export async function deletePlayer(roomId: string, userId: string) {
  await redis.multi()
    .del(playerKey(roomId, userId))
    .srem(roomUsersKey(roomId), userId)
    .exec();
}

export async function listPlayers(roomId: string): Promise<PlayerPresence[]> {
  const userIds = await redis.smembers(roomUsersKey(roomId));
  if (!userIds.length) return [];

  const keys = userIds.map((userId) => playerKey(roomId, userId));
  const values = await redis.mget(keys);

  const activePlayers: PlayerPresence[] = [];
  const staleUsers: string[] = [];

  values.forEach((value, index) => {
    if (!value) {
      staleUsers.push(userIds[index]);
      return;
    }

    try {
      activePlayers.push(JSON.parse(value) as PlayerPresence);
    } catch {
      staleUsers.push(userIds[index]);
    }
  });

  if (staleUsers.length) {
    await redis.srem(roomUsersKey(roomId), ...staleUsers);
  }

  return activePlayers.sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function broadcastToRoom(
  event: any,
  roomId: string,
  payload: Record<string, unknown>,
  options?: {
    excludeConnectionId?: string;
  }
) {
  const client = buildManagementApi(event);
  const connectionIds = await redis.smembers(roomConnectionsKey(roomId));

  await Promise.all(
    connectionIds
      .filter((connectionId) => connectionId !== options?.excludeConnectionId)
      .map(async (connectionId) => {
        try {
          await postJson(client, connectionId, payload);
        } catch (error: any) {
          const statusCode = error?.$metadata?.httpStatusCode;
          if (statusCode === 410) {
            await deleteConnection(connectionId);
          }
        }
      })
  );
}

export function parseBody(event: any) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return {};
  }
}
