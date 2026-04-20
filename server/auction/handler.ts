import { Server, Socket } from "socket.io";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "../types";
import * as store from "./store";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerAuctionHandlers(io: TypedServer, socket: TypedSocket) {
  const userId = socket.data.userId;
  const userName = socket.data.userName;

  socket.on("auction:join", (auctionId) => {
    const auction = store.getAuction(auctionId);
    if (!auction) {
      socket.emit("auction:error", `Auction ${auctionId} not found`);
      return;
    }

    socket.join(`auction:${auctionId}`);
    socket.data.currentAuction = auctionId;

    socket.emit("auction:updated", auction);
    socket.emit("auction:history", store.getBidsForAuction(auctionId));

    const room = io.sockets.adapter.rooms.get(`auction:${auctionId}`);
    const count = room?.size ?? 0;
    io.to(`auction:${auctionId}`).emit("auction:participants", { auctionId, count });
  });

  socket.on("auction:leave", (auctionId) => {
    socket.leave(`auction:${auctionId}`);
    socket.data.currentAuction = null;

    const room = io.sockets.adapter.rooms.get(`auction:${auctionId}`);
    const count = room?.size ?? 0;
    io.to(`auction:${auctionId}`).emit("auction:participants", { auctionId, count });
  });

  socket.on("auction:bid", ({ auctionId, amount }) => {
    const result = store.placeBid(auctionId, userId, userName, amount);

    if (!result.success) {
      socket.emit("auction:bid:rejected", result.error!);
      return;
    }

    const bid = result.bid!;

    socket.emit("auction:bid:accepted", bid);

    io.to(`auction:${auctionId}`).emit("auction:bid:new", bid);

    const auction = store.getAuction(auctionId)!;
    io.to(`auction:${auctionId}`).emit("auction:updated", auction);

    if (result.previousWinnerId && result.previousWinnerId !== userId) {
      const sockets = awaitSocketsInRoom(io, `auction:${auctionId}`);
      for (const s of sockets) {
        if (s.data.userId === result.previousWinnerId) {
          s.emit("auction:outbid", {
            auctionId,
            newHighestBid: amount,
            bidderName: userName,
          });
        }
      }
    }
  });

  socket.on("auction:get-history", (auctionId) => {
    socket.emit("auction:history", store.getBidsForAuction(auctionId));
  });
}

function awaitSocketsInRoom(
  io: TypedServer,
  room: string
): TypedSocket[] {
  const sockets: TypedSocket[] = [];
  const roomSockets = io.sockets.adapter.rooms.get(room);
  if (!roomSockets) return sockets;
  for (const id of roomSockets) {
    const s = io.sockets.sockets.get(id) as TypedSocket | undefined;
    if (s) sockets.push(s);
  }
  return sockets;
}

export function startAuctionTimers(io: TypedServer) {
  setInterval(() => {
    const auctions = store.getAllAuctions();
    const now = Date.now();

    for (const auction of auctions) {
      if (!auction.isActive) continue;

      const timeLeft = Math.max(0, auction.endTime - now);

      if (timeLeft > 0 && timeLeft <= 5 * 60 * 1000) {
        io.to(`auction:${auction.id}`).emit("auction:time-left", {
          auctionId: auction.id,
          timeLeft,
        });
      }

      if (timeLeft === 0) {
        const ended = store.endAuction(auction.id);
        if (ended) {
          io.to(`auction:${auction.id}`).emit("auction:ended", ended);
        }
      }
    }
  }, 1000);
}
