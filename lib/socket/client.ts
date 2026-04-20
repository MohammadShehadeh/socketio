import { io, Socket } from "socket.io-client";
import { SOCKET_SERVER_URL } from "./constants";
import type { AuctionItem, Bid, ConnectionState } from "./types";

type AuctionSocket = Socket;

let socket: AuctionSocket | null = null;
let connectionState: ConnectionState = "disconnected";
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const cb of listeners) cb();
}

export function onConnectionStateChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getConnectionState(): ConnectionState {
  return connectionState;
}

export function getSocket(): AuctionSocket | null {
  return socket;
}

export function connect(userId: string, userName: string): AuctionSocket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_SERVER_URL, {
    auth: { userId, userName },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    autoConnect: true,
  });

  connectionState = "connecting";
  notifyListeners();

  socket.on("connect", () => {
    connectionState = "connected";
    notifyListeners();
  });

  socket.on("disconnect", () => {
    connectionState = "disconnected";
    notifyListeners();
  });

  socket.on("connect_error", () => {
    connectionState = "reconnecting";
    notifyListeners();
  });

  socket.io.on("reconnect_attempt", () => {
    connectionState = "reconnecting";
    notifyListeners();
  });

  return socket;
}

export function disconnect() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  connectionState = "disconnected";
  notifyListeners();
}

export function joinAuction(auctionId: string) {
  socket?.emit("auction:join", auctionId);
}

export function leaveAuction(auctionId: string) {
  socket?.emit("auction:leave", auctionId);
}

export function placeBid(auctionId: string, amount: number) {
  socket?.emit("auction:bid", { auctionId, amount });
}

export function requestBidHistory(auctionId: string) {
  socket?.emit("auction:get-history", auctionId);
}

export function onNewBid(cb: (bid: Bid) => void) {
  socket?.on("auction:bid:new", cb);
  return () => {
    socket?.off("auction:bid:new", cb);
  };
}

export function onBidAccepted(cb: (bid: Bid) => void) {
  socket?.on("auction:bid:accepted", cb);
  return () => {
    socket?.off("auction:bid:accepted", cb);
  };
}

export function onBidRejected(cb: (reason: string) => void) {
  socket?.on("auction:bid:rejected", cb);
  return () => {
    socket?.off("auction:bid:rejected", cb);
  };
}

export function onAuctionUpdated(cb: (auction: AuctionItem) => void) {
  socket?.on("auction:updated", cb);
  return () => {
    socket?.off("auction:updated", cb);
  };
}

export function onAuctionEnded(cb: (auction: AuctionItem) => void) {
  socket?.on("auction:ended", cb);
  return () => {
    socket?.off("auction:ended", cb);
  };
}

export function onTimeLeft(cb: (data: { auctionId: string; timeLeft: number }) => void) {
  socket?.on("auction:time-left", cb);
  return () => {
    socket?.off("auction:time-left", cb);
  };
}

export function onParticipants(cb: (data: { auctionId: string; count: number }) => void) {
  socket?.on("auction:participants", cb);
  return () => {
    socket?.off("auction:participants", cb);
  };
}

export function onOutbid(cb: (data: { auctionId: string; newHighestBid: number; bidderName: string }) => void) {
  socket?.on("auction:outbid", cb);
  return () => {
    socket?.off("auction:outbid", cb);
  };
}

export function onError(cb: (message: string) => void) {
  socket?.on("auction:error", cb);
  return () => {
    socket?.off("auction:error", cb);
  };
}

export function onBidHistory(cb: (bids: Bid[]) => void) {
  socket?.on("auction:history", cb);
  return () => {
    socket?.off("auction:history", cb);
  };
}
