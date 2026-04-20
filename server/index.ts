
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types";
import { registerAuctionHandlers, startAuctionTimers } from "./auction/handler";
import * as store from "./auction/store";

const PORT = parseInt(process.env.SOCKET_PORT ?? "3001", 10);
const CLIENT_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/auctions", (_req, res) => {
  res.json(store.getAllAuctions());
});

app.get("/api/auctions/:id", (req, res) => {
  const auction = store.getAuction(req.params.id);
  if (!auction) {
    res.status(404).json({ error: "Auction not found" });
    return;
  }
  res.json(auction);
});

app.get("/api/auctions/:id/bids", (req, res) => {
  const auction = store.getAuction(req.params.id);
  if (!auction) {
    res.status(404).json({ error: "Auction not found" });
    return;
  }
  res.json(store.getBidsForAuction(req.params.id));
});

io.use((socket, next) => {
  const userId = socket.handshake.auth.userId as string | undefined;
  const userName = socket.handshake.auth.userName as string | undefined;

  if (!userId || !userName) {
    return next(new Error("Authentication required: userId and userName"));
  }

  socket.data.userId = userId;
  socket.data.userName = userName;
  socket.data.currentAuction = null;
  next();
});

io.on("connection", (socket) => {
  console.log(`[socket] Connected: ${socket.data.userName} (${socket.data.userId})`);

  registerAuctionHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`[socket] Disconnected: ${socket.data.userName} (${socket.data.userId})`);
  });
});

store.seedAuctions();
startAuctionTimers(io);

httpServer.listen(PORT, () => {
  console.log(`[server] Auction socket server running on http://localhost:${PORT}`);
  console.log(`[server] CORS origin: ${CLIENT_URL}`);
});
