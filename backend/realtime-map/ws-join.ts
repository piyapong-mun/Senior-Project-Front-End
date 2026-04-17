import {
  broadcastToRoom,
  buildManagementApi,
  getConnection,
  listPlayers,
  parseBody,
  postJson,
  savePlayer,
  type PlayerPresence,
} from "./shared";

export const handler = async (event: any) => {
  const connectionId = String(event.requestContext.connectionId || "");
  const connection = await getConnection(connectionId);

  if (!connection) {
    return { statusCode: 401, body: "Missing connection" };
  }

  const body = parseBody(event);
  const now = Date.now();

  const player: PlayerPresence = {
    userId: connection.userId,
    position: {
      x: Number(body?.position?.x || 0),
      y: Number(body?.position?.y || 0),
      z: Number(body?.position?.z || 0),
    },
    rotationY: typeof body?.rotationY === "number" ? body.rotationY : 0,
    avatarModelUrl: typeof body?.avatarModelUrl === "string" ? body.avatarModelUrl : null,
    updatedAt: now,
  };

  await savePlayer(connection.roomId, player);

  const client = buildManagementApi(event);
  const snapshot = await listPlayers(connection.roomId);

  await postJson(client, connectionId, {
    type: "presence.snapshot",
    players: snapshot,
  });

  await broadcastToRoom(
    event,
    connection.roomId,
    {
      type: "presence.update",
      player,
    },
    { excludeConnectionId: connectionId }
  );

  return { statusCode: 200, body: "Joined" };
};
