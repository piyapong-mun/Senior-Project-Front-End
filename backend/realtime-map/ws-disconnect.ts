import { broadcastToRoom, deleteConnection, deletePlayer } from "./shared";

export const handler = async (event: any) => {
  const connectionId = String(event.requestContext.connectionId || "");
  const connection = await deleteConnection(connectionId);

  if (!connection) {
    return { statusCode: 200, body: "Already disconnected" };
  }

  await deletePlayer(connection.roomId, connection.userId);

  await broadcastToRoom(event, connection.roomId, {
    type: "presence.leave",
    userId: connection.userId,
  });

  return { statusCode: 200, body: "Disconnected" };
};
