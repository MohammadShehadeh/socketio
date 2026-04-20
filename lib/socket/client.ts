import { io, Socket } from "socket.io-client";
import { SOCKET_SERVER_URL } from "./constants";
import type { AuctionItem, Bid, ConnectionState } from "./types";

type AuctionSocket = Socket;

let socket: AuctionSocket | null = null;
let connectionState: ConnectionState = "disconnected";
const listeners = new Set<() => void>();
let pendingRejoin: string | null = null;

function notifyListeners() {
  for (const cb of listeners) cb();
}

function ensureSocket(): AuctionSocket {
  if (socket) return socket;
  throw new Error("Socket not connected. Call connect() first.");
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
  if (socket) {
    if (socket.connected) return socket;
    socket.disconnect();
    socket = null;
  }

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

    if (pendingRejoin) {
      socket!.emit("auction:join", pendingRejoin);
    }
  });

  socket.on("disconnect", (reason) => {
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
  pendingRejoin = null;
  const s = socket;
  socket = null;
  s.offAny();
  s.disconnect();
  connectionState = "disconnected";
  notifyListeners();
}

export function joinAuction(auctionId: string) {
  pendingRejoin = auctionId;
  ensureSocket().emit("auction:join", auctionId);
}

export function leaveAuction(auctionId: string) {
  pendingRejoin = null;
  if (socket) socket.emit("auction:leave", auctionId);
}

export function placeBid(
  auctionId: string,
  amount: number,
  ack?: (response: { success: boolean; error?: string }) => void
) {
  ensureSocket().emit("auction:bid", { auctionId, amount }, ack);
}

export function requestBidHistory(auctionId: string) {
  ensureSocket().emit("auction:get-history", auctionId);
}

function registerListener<T>(event: string, cb: (data: T) => void) {
  const s = ensureSocket();
  s.on(event, cb);
  return () => {
    s.off(event, cb);
  };
}

export function onNewBid(cb: (bid: Bid) => void) {
  return registerListener("auction:bid:new", cb);
}

export function onBidAccepted(cb: (bid: Bid) => void) {
  return registerListener("auction:bid:accepted", cb);
}

export function onBidRejected(cb: (reason: string) => void) {
  return registerListener("auction:bid:rejected", cb);
}

export function onAuctionUpdated(cb: (auction: AuctionItem) => void) {
  return registerListener("auction:updated", cb);
}

export function onAuctionEnded(cb: (auction: AuctionItem) => void) {
  return registerListener("auction:ended", cb);
}

export function onTimeLeft(cb: (data: { auctionId: string; timeLeft: number }) => void) {
  return registerListener("auction:time-left", cb);
}

export function onParticipants(cb: (data: { auctionId: string; count: number }) => void) {
  return registerListener("auction:participants", cb);
}

export function onOutbid(cb: (data: { auctionId: string; newHighestBid: number; bidderName: string }) => void) {
  return registerListener("auction:outbid", cb);
}

export function onError(cb: (message: string) => void) {
  return registerListener("auction:error", cb);
}

export function onBidHistory(cb: (bids: Bid[]) => void) {
  return registerListener("auction:history", cb);
}
