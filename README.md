# Socket.IO Playground

A learning-first realtime app: a working **auction house** showing Socket.IO in
production patterns, plus a `/playground` of focused, side-by-side demos that
isolate each Socket.IO concept end-to-end (server handler → client emitter →
React hook → UI).

```text
Browser (Next.js 16) ←→ Express + Socket.IO :3001
       │                          │
       │   /  (auction)            │   real-time bidding
       │   /playground             │   chat · presence · cursors · acks · rate limit · scopes · lifecycle
       └──────────────────────────┘
```

## Quick start

```bash
pnpm install

# Terminal 1 — Socket.IO server (Express, port 3001)
pnpm server:dev

# Terminal 2 — Next.js (port 3000)
pnpm dev

# Or both at once
pnpm dev:all
```

Open [http://localhost:3000](http://localhost:3000), sign in (any name + email),
and you'll land on the auction home page. Click the **Socket.IO Playground**
banner — or go straight to `/playground` — to explore the concept demos.

## Two namespaces, one server

| Namespace | Purpose | Code |
| --- | --- | --- |
| `/` | Auction app — bidding, rooms-per-auction, server timers | `server/auction/` |
| `/playground` | Teaching demos — chat, presence, cursors, acks, rate limit | `server/playground/` |

Same TCP/WebSocket connection — Socket.IO multiplexes namespaces over one
underlying transport. Open both at once and the inspector overlay shows every
event flowing on the playground namespace.

## Playground demos

Each one is a single page in [app/playground/](app/playground/) backed by a
single hook in [hooks/](hooks/) and a single handler in
[server/playground/handler.ts](server/playground/handler.ts).

| Demo | What it teaches |
| --- | --- |
| [Connection lifecycle](app/playground/connection/page.tsx) | Handshake auth, transport upgrade (poll → ws), reconnect state machine, server-pushed heartbeat |
| [Broadcast scopes](app/playground/scopes/page.tsx) | `socket.emit` vs `io.to(room)` vs `socket.broadcast.to(room)` vs `io.emit` — visually side-by-side |
| [Rooms & chat](app/playground/chat/page.tsx) | Multi-room chat with throttled typing indicators |
| [Presence](app/playground/presence/page.tsx) | Online users, ref-counted across tabs, snapshot + delta protocol |
| [Cursor sync](app/playground/cursors/page.tsx) | Volatile high-frequency emits, client throttling, normalized coords, stale eviction |
| [Acks & timeouts](app/playground/acks/page.tsx) | Ack callbacks wrapped as Promises, `.timeout()`, simulated slow/failing server |
| [Rate limiting](app/playground/rate-limit/page.tsx) | Per-socket token bucket, silent drops, server-pushed counters |

A floating **Event Inspector** (bottom-right) taps the playground client and
shows every wire event — emits, receives, ack timings, transport upgrades.

## The auction app

Built on the same primitives. See [ARCHITECTURE.md](ARCHITECTURE.md) for the
full deep-dive on the bid pipeline, room broadcasts, server-side timers, and
the singleton client pattern.

## Layout

```text
server/
├── index.ts                    HTTP + Socket.IO bootstrap, namespace wiring
├── types.ts                    Auction event types
├── auction/                    Auction app handlers + in-memory store
└── playground/                 Playground namespace handlers + store

lib/
├── auth/                       Cookie sessions + server actions
├── socket/                     Auction-namespace client (singleton)
└── playground/                 Playground-namespace client (ref-counted, instrumented)

hooks/
├── use-socket-connection.ts    Auction connection lifecycle
├── use-auction.ts              Full auction state in one hook
├── use-playground-connection.ts
├── use-chat.ts
├── use-presence.ts
├── use-cursors.ts
├── use-broadcast-scopes.ts
├── use-acks.ts
├── use-rate-limit.ts
├── use-server-tick.ts
└── use-event-inspector.ts

components/
├── auction/                    Auction room + page wrapper
└── playground/                 Shell, demo-page chrome, event inspector

app/
├── page.tsx                    Auction home with live countdowns
├── login/                      Mock login
├── auction/[id]/               Auction detail
└── playground/                 Hub + per-demo pages
```

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_SERVER_URL` | `http://localhost:3001` | Socket server URL (client) |
| `SOCKET_PORT` | `3001` | Socket server port |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | CORS origin for socket server |

## Stack

- **Next.js 16** App Router, React 19, server actions, `proxy.ts` (formerly `middleware.ts`)
- **Socket.IO 4.8** server + client, two namespaces over one connection
- **Express 5** for the standalone socket server
- **Tailwind v4** + shadcn/ui primitives
