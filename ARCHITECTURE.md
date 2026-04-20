# Auction House — Architecture & Flow

## Overview

A real-time auction platform built with **Next.js 16** (App Router), **Express + Socket.IO** for WebSocket communication, and **cookie-based sessions** for user identity.

```
Browser (Next.js) ←→ Socket.IO Server (Express:3001)
       ↕                        ↕
  Server Components       In-memory Store
  Server Actions          Event Handlers
  Middleware
```

---

## Project Structure

```
server/                         # Standalone Express + Socket.IO server
├── index.ts                    # HTTP + Socket.IO bootstrap
├── types.ts                    # Shared event & data types
└── auction/
    ├── store.ts                # In-memory data store + seed data
    └── handler.ts              # Socket event handlers + countdown timer

lib/
├── auth/
│   ├── session.ts              # Server-side cookie read/write
│   ├── session-provider.tsx    # Async server component → seeds AuthProvider
│   ├── auth-context.tsx        # Client-side auth context (user state)
│   └── actions.ts              # Server actions (login, logout)
├── socket/
│   ├── constants.ts            # Event names, server URL
│   ├── types.ts                # Frontend type definitions
│   ├── client.ts               # Singleton Socket.IO client
│   └── index.ts                # Barrel export
└── utils.ts                    # cn() utility

hooks/
├── use-socket-connection.ts    # Manages connect/disconnect lifecycle
├── use-auction.ts              # Full auction state in one hook
└── index.ts

components/auction/
├── auction-room.tsx            # Live bidding UI
└── auction-page.tsx            # Connection status + room wrapper

app/
├── layout.tsx                  # SessionProvider wraps everything
├── page.tsx                    # Home — auction cards with live countdown
├── login/page.tsx              # Mock login form
├── auction/[id]/page.tsx       # Dynamic auction detail route
└── middleware.ts               # Edge-level auth guard
```

---

## Authentication Flow

```
┌──────────┐    POST form     ┌──────────────┐    set cookie    ┌────────┐
│  /login  │ ───────────────→ │ loginAction  │ ───────────────→ │ Cookie │
│  (page)  │   (server action)│ (server-only)│  auction_session │        │
└──────────┘                  └──────────────┘                  └────────┘
     │                                                               │
     │ redirect("/")                                                 │
     ▼                                                               │
┌──────────┐   middleware    ┌───────────────────┐                   │
│    /     │ ←──────────────│ reads cookie       │ ←─────────────────┘
│  (page)  │  cookie exists  │ redirects if empty │
└──────────┘                  └───────────────────┘
```

### Step by step

1. User visits any page → `middleware.ts` checks for `auction_session` cookie
2. No cookie → redirect to `/login`
3. User fills name + email → form submits to `loginAction` (server action)
4. `loginAction` validates, creates user with id/name/email/avatar, calls `setSession()`
5. `setSession()` writes `httpOnly` cookie via `cookies().set()` (7-day expiry)
6. `redirect("/")` sends user to home
7. On every page load, `SessionProvider` (async server component) calls `getSession()` → reads cookie server-side → passes `initialUser` to `AuthProvider`
8. `AuthProvider` initializes React state with that user **before any client JS runs** — no hydration flash
9. Sign out → `logoutAction` clears cookie → redirect to `/login`

---

## Socket Connection Flow

```
┌─────────────────────┐         ┌──────────────────────┐
│  AuthProvider        │         │  Express Server       │
│  user.id, user.name  │         │  Socket.IO on :3001   │
└──────────┬──────────┘         └───────────┬──────────┘
           │                                │
           ▼                                │
  useSocketConnection(userId, userName)     │
           │                                │
           ├─ connect(userId, userName) ────→│  io.use() auth middleware
           │                                │  validates userId + userName
           │                                │  stores in socket.data
           │                                │
           │◄─── "connect" event ────────────┤
           │    connectionState = "connected"
```

### Client (`lib/socket/client.ts`)

- **Singleton pattern** — one `socket` instance shared across the app
- Connects to `NEXT_PUBLIC_SOCKET_SERVER_URL` (default `http://localhost:3001`)
- Sends `userId` and `userName` in `auth` handshake
- Transport: `websocket` first, falls back to `polling`
- Auto-reconnect with exponential backoff (1s → 5s max, infinite retries)

### Server (`server/index.ts`)

- `io.use()` middleware extracts `userId`/`userName` from handshake
- Rejects connections missing auth fields
- Stores identity on `socket.data` for use in handlers

### Hook (`hooks/use-socket-connection.ts`)

```tsx
const { connectionState, reconnect } = useSocketConnection(userId, userName);
// connectionState: "disconnected" | "connecting" | "connected" | "reconnecting"
```

- Calls `connect()` on mount, `disconnect()` on unmount
- Subscribes to connection state changes via `onConnectionStateChange()`

---

## Auction Room & Bidding Flow

```
Client A                    Server                    Client B
  │                          │                          │
  │── "auction:join" ───────→│                          │
  │   socket.join(room)      │                          │
  │                          │                          │
  │←─ "auction:updated" ─────┤                          │
  │←─ "auction:history" ─────┤                          │
  │                          │                          │
  │                          │←── "auction:join" ───────│
  │←─ "auction:participants"─┤─── "auction:participants"─→│
  │   count: 2               │   count: 2               │
  │                          │                          │
  │── "auction:bid" ────────→│                          │
  │   { auctionId, amount }  │                          │
  │                          │  store.placeBid()        │
  │                          │  validate & save         │
  │                          │                          │
  │←─ "auction:bid:accepted"─┤                          │
  │                          │                          │
  │←─ "auction:bid:new" ─────┤── "auction:bid:new" ────→│
  │                          │                          │
  │←─ "auction:updated" ─────┤── "auction:updated" ────→│
  │   (new currentPrice)     │   (new currentPrice)     │
  │                          │                          │
  │                          │── "auction:outbid" ─────→│
  │                          │   (previous winner gets  │
  │                          │    outbid notification)   │
```

### Rooms

Each auction gets a Socket.IO room: `auction:<auctionId>`. Only users in the room receive events for that auction. This keeps broadcasts isolated.

### Bid Validation (server-side)

| Check | Error |
|-------|-------|
| Auction exists | "Auction not found" |
| Auction is active | "Auction is not active" |
| End time not passed | "Auction has ended" |
| Seller not bidding on own item | "Seller cannot bid..." |
| Amount ≥ currentPrice + minBidIncrement | "Bid must be at least $X" |

### Events Reference

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `auction:join` | `auctionId: string` | Join auction room, receive current state + bid history |
| `auction:leave` | `auctionId: string` | Leave auction room |
| `auction:bid` | `{ auctionId, amount }` | Place a bid |
| `auction:get-history` | `auctionId: string` | Request full bid history |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `auction:updated` | `AuctionItem` | Full auction state after any change |
| `auction:bid:new` | `Bid` | Broadcast to room on new bid |
| `auction:bid:accepted` | `Bid` | Sent only to the bidder |
| `auction:bid:rejected` | `reason: string` | Sent only to the bidder on failed bid |
| `auction:history` | `Bid[]` | Full bid history (sent on join or request) |
| `auction:participants` | `{ auctionId, count }` | Room participant count |
| `auction:time-left` | `{ auctionId, timeLeft }` | Countdown (every 1s, last 5 min) |
| `auction:outbid` | `{ auctionId, newHighestBid, bidderName }` | Previous highest bidder |
| `auction:ended` | `AuctionItem` | Auction finalized |
| `auction:error` | `message: string` | Generic error |

---

## Live Countdown Timer

### On auction cards (home page)

```
useCountdown(endTime, isActive)
  └── useState(max(0, endTime - Date.now()))
  └── useEffect → setInterval every 1000ms
        └── setState(max(0, endTime - Date.now()))
        └── stop when reaches 0
```

- Purely client-side, no socket needed
- Shows `HH:MM:SS` or `MM:SS` format
- Pulses red when under 5 minutes (`isUrgent`)
- Shows static `ENDED` badge when done

### In auction room (detail page)

Server-side timer in `server/auction/handler.ts`:

```
setInterval (every 1s)
  └── for each active auction:
        ├── timeLeft = endTime - Date.now()
        ├── if timeLeft > 0 && timeLeft ≤ 5min:
        │     emit "auction:time-left" to room
        └── if timeLeft === 0:
              endAuction() → emit "auction:ended" to room
```

The client hook (`useAuction`) listens for both `auction:time-left` and the client-side countdown, keeping the display accurate.

---

## Frontend Hooks Pattern

### `useAuction(auctionId)` — single hook for all auction state

```tsx
const { auction, bids, participantCount, timeLeft, lastError, bid, clearError } = useAuction(id);
```

Internally:

1. On mount → emits `auction:join` to socket
2. Registers listeners for all auction events (updated, bid:new, history, participants, time-left, ended, outbid, error)
3. Maintains single `AuctionState` via `useState`
4. Returns `bid(amount)` function that emits `auction:bid`
5. On unmount → cleans up all listeners, emits `auction:leave`

This means **any component** can just call `useAuction(id)` and get full reactive state without managing socket events manually.

---

## Running the App

```bash
# Terminal 1 — Socket server
pnpm server:dev

# Terminal 2 — Next.js
pnpm dev

# Or both
pnpm dev:all
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SOCKET_SERVER_URL` | `http://localhost:3001` | Socket server URL (client) |
| `SOCKET_PORT` | `3001` | Socket server port |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | CORS origin for socket server |

---

## Data Flow Summary

```
                   ┌─────────────────────────────────────────┐
                   │             Next.js Server               │
                   │                                         │
  Cookie ───────→ middleware.ts ──→ redirect if no session    │
                   │                                         │
                   SessionProvider ──→ getSession() ──→ cookie│
                        │                                    │
                        ▼                                    │
                   AuthProvider (initialUser from server)     │
                   └──────────────┬──────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │      Client React App       │
                    │                             │
                    │  useSocketConnection() ─────┼──→ Socket.IO connect
                    │         │                   │
                    │  useAuction(auctionId) ─────┼──→ join room
                    │    │  │  │  │               │     listen to events
                    │    │  │  │  └─ lastError    │     manage state
                    │    │  │  └──── timeLeft     │
                    │    │  └─────── bids[]       │
                    │    └────────── auction      │
                    │                             │
                    │  bid(amount) ───────────────┼──→ emit auction:bid
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │    Express Socket Server     │
                    │                             │
                    │  io.use() ── auth check      │
                    │  registerAuctionHandlers()   │
                    │    ├── join/leave rooms      │
                    │    ├── placeBid (validate)   │
                    │    └── broadcast to room     │
                    │                             │
                    │  startAuctionTimers()        │
                    │    └── 1s interval countdown │
                    │                             │
                     │  In-memory store             │
                     │    ├── auctions Map          │
                     │    └── bids Map              │
                     └─────────────────────────────┘
```

---

## Deep Dive: Socket.IO Internals

### Why Socket.IO over raw WebSocket

| Feature | Raw WebSocket | Socket.IO |
|---------|:---:|:---:|
| Auto-reconnect | Manual | Built-in with configurable backoff |
| Fallback transport | None | HTTP long-polling → WebSocket upgrade |
| Rooms / namespaces | Manual bookkeeping | First-class API (`socket.join`, `io.to`) |
| Event-based API | Raw strings/binary | Named events with typed payloads |
| Acknowledgements | Manual | Built-in callbacks |
| Heartbeat / ping | Manual | Configured via `pingInterval` / `pingTimeout` |
| Binary support | Yes | Yes (with transparent handling) |

Socket.IO is **not** the WebSocket protocol. It runs **on top of** WebSocket (or HTTP long-polling as fallback). The client and server negotiate an upgrade:

```
1. Client sends HTTP GET /socket.io/?EIO=4&transport=polling
2. Server responds with SID + config
3. Client sends HTTP POST with auth payload
4. If WebSocket available → upgrade GET /socket.io/?EIO=4&transport=websocket&sid=...
5. All subsequent communication goes over WebSocket
```

This means even if WebSocket is blocked (corporate proxies, etc.), the app keeps working via polling.

---

### Type-Safe Events End-to-End

Socket.IO supports TypeScript generics on the `Server` and `Socket` constructors. We define four interfaces in `server/types.ts`:

```ts
// server/types.ts

interface ServerToClientEvents {
  "auction:bid:new": (bid: Bid) => void;
  "auction:updated": (auction: AuctionItem) => void;
  // ...
}

interface ClientToServerEvents {
  "auction:join": (auctionId: string) => void;
  "auction:bid": (data: { auctionId: string; amount: number }) => void;
  // ...
}

interface InterServerEvents {}   // server-to-server (unused here)
interface SocketData {           // per-socket state
  userId: string;
  userName: string;
  currentAuction: string | null;
}
```

Then the server is typed:

```ts
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer);
```

This gives you:
- `io.emit("auction:bid:new", bid)` — compile error if `bid` doesn't match `Bid`
- `socket.on("auction:join", (auctionId) => { ... })` — `auctionId` is typed as `string`
- `socket.data.userId` — typed as `string` from `SocketData`

On the frontend, we mirror the types in `lib/socket/types.ts` (same shapes) so the client knows what to expect.

---

### Connection Lifecycle in Detail

#### Step 1: Client initiates

```ts
// lib/socket/client.ts

socket = io(SOCKET_SERVER_URL, {
  auth: { userId, userName },          // sent in handshake
  transports: ["websocket", "polling"], // try WS first, fallback to polling
  reconnection: true,
  reconnectionAttempts: Infinity,       // never stop trying
  reconnectionDelay: 1000,              // start at 1s
  reconnectionDelayMax: 5000,           // cap at 5s
  timeout: 10000,                       // give up after 10s per attempt
  autoConnect: true,
});
```

The `auth` object is sent during the handshake — before any event handler runs. The server reads it in `io.use()`.

#### Step 2: Server authenticates

```ts
// server/index.ts

io.use((socket, next) => {
  const userId = socket.handshake.auth.userId;
  const userName = socket.handshake.auth.userName;

  if (!userId || !userName) {
    return next(new Error("Authentication required"));
    // Client receives "connect_error" event
  }

  // Store on socket instance — available in all handlers
  socket.data.userId = userId;
  socket.data.userName = userName;
  socket.data.currentAuction = null;

  next(); // allow connection
});
```

This middleware runs **once** per connection (and again on each reconnection). If `next(new Error(...))` is called, the client gets a `connect_error` event and Socket.IO automatically retries.

#### Step 3: Connection established

```ts
io.on("connection", (socket) => {
  console.log(`Connected: ${socket.data.userName}`);
  registerAuctionHandlers(io, socket);
  // handlers now have access to socket.data.userId, socket.data.userName
});
```

#### Step 4: Reconnection

When the connection drops, Socket.IO automatically retries. The reconnection behavior:

```
Attempt 1: wait 1000ms
Attempt 2: wait ~1500ms (randomized jitter)
Attempt 3: wait ~2250ms
   ...
Attempt N: wait 5000ms (capped at reconnectionDelayMax)
```

Each reconnection goes through `io.use()` again, so auth is re-validated. The client-side state machine tracks this:

```
disconnected → connecting → connected
                  ↑              │
                  └──────────────┘  (on disconnect / error)
```

The singleton client (`lib/socket/client.ts`) notifies React hooks through a listener set:

```ts
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const cb of listeners) cb();
}

// Hooks register a callback:
export function onConnectionStateChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb); // cleanup on unmount
}
```

This avoids coupling the socket to React — the client module is pure JS, and hooks opt-in via `onConnectionStateChange`.

---

### Singleton Client Pattern — Why and How

The client (`lib/socket/client.ts`) uses a **module-level singleton**:

```ts
let socket: AuctionSocket | null = null;

export function connect(userId: string, userName: string): AuctionSocket {
  if (socket?.connected) return socket;  // reuse existing

  socket = io(SOCKET_SERVER_URL, { auth: { userId, userName }, ... });
  return socket;
}
```

**Why singleton?**
- Multiple components/hooks share the same WebSocket connection
- Socket.IO already multiplexes events over one connection — no need for multiple
- Prevents duplicate connections when navigating between pages
- The socket is lazily created on first `connect()` call

**Why not a React context for the socket?**
- The socket is a mutable imperative object — it doesn't belong in React state
- Putting it in context would cause unnecessary re-renders
- The `onX()` functions return cleanup callbacks — perfectly matches `useEffect` cleanup

---

### Room Architecture

Socket.IO rooms are lightweight groups. A socket can be in many rooms. We use the naming convention `auction:<auctionId>`:

#### Joining

```ts
// server/auction/handler.ts

socket.on("auction:join", (auctionId) => {
  socket.join(`auction:${auctionId}`);
  socket.data.currentAuction = auctionId;

  // Immediately send current state to THIS socket only
  socket.emit("auction:updated", auction);
  socket.emit("auction:history", bids);

  // Broadcast participant count to ENTIRE room
  io.to(`auction:${auctionId}`).emit("auction:participants", { auctionId, count });
});
```

The `socket.emit()` vs `io.to(room).emit()` distinction:

| Method | Who receives |
|--------|-------------|
| `socket.emit(event, data)` | Only this socket |
| `io.emit(event, data)` | All connected sockets |
| `io.to(room).emit(event, data)` | All sockets in the room |
| `socket.broadcast.to(room).emit(event, data)` | All sockets in room **except** sender |

#### Leaving

```ts
socket.on("auction:leave", (auctionId) => {
  socket.leave(`auction:${auctionId}`);
  socket.data.currentAuction = null;
  // Broadcast updated count
  io.to(`auction:${auctionId}`).emit("auction:participants", { auctionId, count });
});
```

Leaving happens automatically when a socket disconnects — Socket.IO cleans up room membership. But we also do it explicitly when the user navigates away from the auction page.

#### Auto-cleanup on disconnect

```ts
// server/index.ts
socket.on("disconnect", () => {
  console.log(`Disconnected: ${socket.data.userName}`);
  // Socket.IO automatically removes socket from all rooms
  // No manual cleanup needed
});
```

---

### The Bid Pipeline — Complete Walkthrough

Here's every function call from button click to UI update:

```
User clicks "Place Bid" button
         │
         ▼
┌─── bid(amount) ──────────────────────────────────────────────────┐
│  // hooks/use-auction.ts                                         │
│  1. setState(prev => ({ ...prev, lastError: null }))             │
│     // optimistically clear error                                │
│  2. placeBid(auctionId, amount)                                  │
│     // dynamic import to avoid SSR issues                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─── placeBid() ───────────────────────────────────────────────────┐
│  // lib/socket/client.ts                                         │
│  socket.emit("auction:bid", { auctionId, amount })               │
│  // fire-and-forget, no ack callback                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                     network
                      │
                      ▼
┌─── socket.on("auction:bid") ─────────────────────────────────────┐
│  // server/auction/handler.ts                                    │
│  const result = store.placeBid(auctionId, userId, userName, amt) │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─── store.placeBid() ─────────────────────────────────────────────┐
│  // server/auction/store.ts                                      │
│  1. Check auction exists                                        │
│  2. Check auction.isActive                                      │
│  3. Check endTime > Date.now()                                  │
│  4. Check userId !== sellerId                                   │
│  5. Check amount >= currentPrice + minBidIncrement               │
│  6. Create Bid object { id, auctionId, userId, userName, amount }│
│  7. Save to bids Map                                            │
│  8. Update auction.currentPrice = amount                        │
│  9. Update auction.winnerId = userId                            │
│  10. Return { success: true, bid, previousWinnerId }            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │  success = true           │  success = false
        ▼                           ▼
┌── Server emits: ──────┐   socket.emit("auction:bid:rejected", error)
│                        │         │
│  1. socket.emit        │         ▼
│     "auction:bid:      │   Client receives error
│      accepted", bid    │   onBidRejected handler fires
│     (bidder only)      │   setState({ lastError: error })
│                        │
│  2. io.to(room).emit   │
│     "auction:bid:new", │
│      bid               │
│     (everyone in room) │
│                        │
│  3. io.to(room).emit   │
│     "auction:updated", │
│      auction           │
│     (everyone in room) │
│                        │
│  4. Find previous      │
│     winner socket      │
│     s.emit(            │
│       "auction:outbid",│
│       { ... })         │
│     (outbid user only) │
└────────────────────────┘
         │
         ▼
┌── Client receives events ────────────────────────────────────────┐
│  // hooks/use-auction.ts listeners                               │
│                                                                  │
│  onBidAccepted(bid):                                             │
│    setState({ lastError: null })                                 │
│                                                                  │
│  onNewBid(bid):                                                  │
│    setState({ bids: [...prev.bids, bid] })                       │
│    // append to existing bids, trigger re-render                 │
│                                                                  │
│  onAuctionUpdated(auction):                                      │
│    setState({ auction })                                         │
│    // new currentPrice, winnerId reflected in UI                 │
│                                                                  │
│  onOutbid({ newHighestBid, bidderName }):                        │
│    setState({ lastError: "You've been outbid by..." })           │
│    // show warning to previous highest bidder                   │
└──────────────────────────────────────────────────────────────────┘
```

---

### Listener Cleanup — Preventing Memory Leaks

Every `onX()` function in the client returns a cleanup function:

```ts
// lib/socket/client.ts
export function onNewBid(cb: (bid: Bid) => void) {
  socket?.on("auction:bid:new", cb);
  return () => socket?.off("auction:bid:new", cb);  // ← cleanup
}
```

The hook stores all cleanups in an array and calls them on unmount:

```ts
// hooks/use-auction.ts

useEffect(() => {
  const cleanups = [
    onAuctionUpdated((auction) => { ... }),
    onBidHistory((bids) => { ... }),
    onNewBid((bid) => { ... }),
    onParticipants(({ count }) => { ... }),
    onTimeLeft(({ timeLeft }) => { ... }),
    onAuctionEnded((auction) => { ... }),
    onBidAccepted(() => { ... }),
    onBidRejected((reason) => { ... }),
    onOutbid(({ ... }) => { ... }),
    onError((message) => { ... }),
  ];

  return () => {
    for (const cleanup of cleanups) cleanup();
    leaveAuction(auctionId);
  };
}, [auctionId]);
```

**Why `socket.off(event, callback)` instead of `socket.removeAllListeners()`?**

If we used `removeAllListeners`, we'd break other components that registered their own listeners on the same socket. Passing the exact callback reference ensures only our listener is removed.

**Why `mountedRef`?**

```ts
const mountedRef = useRef(true);

// In listener:
if (mountedRef.current) {
  setState(...);
}

// In cleanup:
mountedRef.current = false;
```

React warns about state updates on unmounted components. The ref is set to `false` in cleanup before the listener can fire. This is the standard pattern for async/subscriptions in effects.

---

### Handling Auction Switching

When navigating from one auction to another, the hook needs to leave the old room and join the new one:

```ts
// hooks/use-auction.ts

const previousAuctionRef = useRef<string | null>(null);

useEffect(() => {
  // Leave previous auction if different
  if (previousAuctionRef.current && previousAuctionRef.current !== auctionId) {
    leaveAuction(previousAuctionRef.current);
  }
  previousAuctionRef.current = auctionId;

  // Join new auction
  joinAuction(auctionId);

  // Register listeners...

  return () => {
    leaveAuction(auctionId); // cleanup on unmount
  };
}, [auctionId]);
```

This ensures:
- Navigating `/auction/abc` → `/auction/xyz` leaves room `abc`, joins room `xyz`
- Navigating away from any auction page leaves the room
- No stale listeners from the previous auction leak

---

### Server-Side Timer — How Countdown Works

The server runs a single `setInterval` that checks all active auctions every second:

```ts
// server/auction/handler.ts

export function startAuctionTimers(io: TypedServer) {
  setInterval(() => {
    const auctions = store.getAllAuctions();
    const now = Date.now();

    for (const auction of auctions) {
      if (!auction.isActive) continue;

      const timeLeft = Math.max(0, auction.endTime - now);

      // Broadcast time to room in last 5 minutes
      if (timeLeft > 0 && timeLeft <= 5 * 60 * 1000) {
        io.to(`auction:${auction.id}`).emit("auction:time-left", {
          auctionId: auction.id,
          timeLeft,
        });
      }

      // End auction when time runs out
      if (timeLeft === 0) {
        const ended = store.endAuction(auction.id);
        if (ended) {
          io.to(`auction:${auction.id}`).emit("auction:ended", ended);
        }
      }
    }
  }, 1000);
}
```

**Why server-side timer instead of client-side only?**

1. **Trust** — Client clocks can be wrong or manipulated. Server time is authoritative.
2. **Auction ending** — The server decides when an auction is over, not the client.
3. **Consistency** — All bidders see the same countdown (no clock drift between users).

The `auction:time-left` event is only emitted in the last 5 minutes to avoid unnecessary network traffic. Before that, the client calculates the countdown locally using `auction.endTime` (sent once on join/update).

**Why `timeLeft === 0` and not `timeLeft <= 0`?**

Because the interval runs every second, `timeLeft` will be exactly `0` only once. Using `<= 0` would re-emit `auction:ended` every second after the auction ends. The `Math.max(0, ...)` ensures `timeLeft` is never negative, and `store.endAuction()` sets `isActive = false` so the `continue` guard prevents re-processing.

---

### Client-Side Countdown (`useCountdown`)

For the home page cards, we don't need a socket connection. Each card runs its own local timer:

```ts
function useCountdown(endTime: number, isActive: boolean) {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, endTime - Date.now())
  );

  useEffect(() => {
    if (!isActive) { setTimeLeft(0); return; }

    setTimeLeft(Math.max(0, endTime - Date.now()));

    const interval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, isActive]);

  return timeLeft;
}
```

**Key details:**
- `useState(() => ...)` — initializer function avoids computing on every render
- Cleanup returns `clearInterval` — prevents stacking intervals on re-renders
- Self-terminating — clears itself when it hits 0

This runs independently per card. With 3 auctions, there are 3 intervals. Each is lightweight (one `Date.now()` comparison per second).

---

### Outbid Detection — Targeted Notification

When someone outbids the previous highest bidder, only that person should be notified. We don't broadcast `auction:outbid` to everyone — that would be noise.

```ts
// server/auction/handler.ts

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
```

**Why iterate sockets instead of storing a socketId?**

A user might have multiple tabs open (multiple sockets). We need to notify all of them. Also, sockets can change on reconnect — the userId from `socket.data` is the stable identifier, not the socket ID.

**Why check `previousWinnerId !== userId`?**

The first bid has `previousWinnerId = null`. And if someone bids against themselves (unlikely but possible if they refresh quickly), we skip the notification.

---

### REST API + Socket Hybrid

The server exposes both REST endpoints and Socket.IO events:

| Need | Method | Why |
|------|--------|-----|
| List all auctions | `GET /api/auctions` | HTTP — fetch once on page load, cacheable |
| Get single auction | `GET /api/auctions/:id` | HTTP — initial page data |
| Get bid history | `GET /api/auctions/:id/bids` | HTTP — fallback if socket not connected |
| Join/leave room | `auction:join` / `auction:leave` | Socket — needs room membership |
| Real-time bids | `auction:bid` | Socket — needs broadcast to room |
| Live updates | `auction:updated`, `auction:bid:new`, etc. | Socket — push-based, no polling |
| Health check | `GET /health` | HTTP — monitoring / load balancer |

**Pattern**: Use REST for one-time data fetches. Use Socket.IO for everything that needs to be real-time or room-scoped.

---

### CORS Configuration

Both the Express HTTP server and the Socket.IO server need CORS:

```ts
// server/index.ts

app.use(cors({ origin: CLIENT_URL }));

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
});
```

During development:
- Next.js runs on `http://localhost:3000`
- Socket server runs on `http://localhost:3001`
- These are **different origins**, so CORS is required

The Socket.IO handshake starts as an HTTP request (even for WebSocket upgrade), so both HTTP and WS layers need the CORS header.

---

### Event Naming Convention

All events use the `auction:<action>` pattern:

```
auction:join
auction:leave
auction:bid
auction:bid:new        ← emitted after a bid is placed
auction:bid:accepted   ← sent to the bidder
auction:bid:rejected   ← sent to the bidder
auction:updated
auction:ended
auction:started
auction:time-left
auction:participants
auction:outbid
auction:error
auction:history
```

This namespace prefix (`auction:`) serves two purposes:
1. **Readability** — immediately clear which domain the event belongs to
2. **Scalability** — if we add chat (`chat:message`) or notifications (`notify:new`), they won't collide

---

### What Happens on Server Restart

Since the store is in-memory (Maps), a server restart clears all data:

```
Server restarts
  → All sockets disconnect
  → In-memory Maps (auctions, bids) are lost
  → seedAuctions() creates 3 fresh auctions with new endTime
  → Clients auto-reconnect (Socket.IO handles this)
  → But room membership is lost — clients need to rejoin
```

**Production note**: For persistence, replace the in-memory store with a database (Redis, PostgreSQL). The handler code stays the same — only `store.ts` changes.

---

### Scaling Considerations

The current setup is single-process. To scale:

#### Option 1: Redis Adapter

```ts
import { createAdapter } from "@socket.io/redis-adapter";

io.adapter(createAdapter(redisClient, subClient));
```

This syncs room membership and broadcasts across multiple Node.js processes. Socket.IO handles the complexity — your handler code doesn't change.

#### Option 2: Sticky Sessions

If using a load balancer (nginx, AWS ALB), configure sticky sessions so the same client always hits the same server. Required when NOT using the Redis adapter.

#### Option 3: Stateless with Message Queue

Move bid processing to a queue (RabbitMQ, Kafka). The socket server becomes a thin broadcast layer:

```
Client → Socket Server → Queue → Worker → DB
                                    ↓
                              Socket Server → broadcast to room
```
