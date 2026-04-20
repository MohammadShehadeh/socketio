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
