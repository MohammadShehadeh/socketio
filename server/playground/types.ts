// Types for the /playground namespace.
//
// The playground namespace is intentionally separate from the auction one so
// you can read each domain's contract without cross-talk. Every event below
// powers exactly one demo on the frontend — keep that 1:1 mapping in mind.

export interface ChatMessage {
	id: string;
	room: string;
	userId: string;
	userName: string;
	text: string;
	timestamp: number;
}

export interface PresenceUser {
	userId: string;
	userName: string;
	color: string;
	joinedAt: number;
}

export interface CursorUpdate {
	userId: string;
	userName: string;
	color: string;
	x: number; // 0..1 (normalized so any viewport works)
	y: number;
}

export type BroadcastScope =
	| 'self' // socket.emit
	| 'room' // io.to(room).emit — includes sender
	| 'broadcast-room' // socket.broadcast.to(room).emit — excludes sender
	| 'all'; // io.emit — every connected client in the namespace

export interface ScopePing {
	id: string;
	scope: BroadcastScope;
	fromUserId: string;
	fromUserName: string;
	room: string;
	at: number;
}

export interface AckRequest {
	id: string;
	delayMs: number;
	failRate: number; // 0..1 — server will reject this fraction
}

export interface AckResponse {
	id: string;
	ok: boolean;
	error?: string;
	processedAt: number;
}

export interface RateLimitStatus {
	allowed: number;
	dropped: number;
	windowMs: number;
	limit: number;
}

export interface PlaygroundClientToServer {
	// chat
	'chat:join': (room: string) => void;
	'chat:leave': (room: string) => void;
	'chat:send': (data: { room: string; text: string }) => void;
	'chat:typing': (data: { room: string; isTyping: boolean }) => void;

	// presence (single global "lobby")
	'presence:hello': () => void;

	// cursors (joins the same lobby, separate event names)
	'cursor:move': (data: { x: number; y: number }) => void;

	// broadcast scopes — sender picks which scope they want
	'scope:join': (room: string) => void;
	'scope:leave': (room: string) => void;
	'scope:ping': (data: { room: string; scope: BroadcastScope }) => void;

	// acks — show request/response with timeout + simulated failure
	'ack:echo': (
		req: AckRequest,
		ack: (response: AckResponse) => void,
	) => void;

	// rate limit — flood the server, see what it drops
	'ratelimit:event': () => void;
	'ratelimit:status?': (ack: (status: RateLimitStatus) => void) => void;
}

export interface PlaygroundServerToClient {
	// chat
	'chat:message': (msg: ChatMessage) => void;
	'chat:history': (data: { room: string; messages: ChatMessage[] }) => void;
	'chat:typing': (data: {
		room: string;
		userId: string;
		userName: string;
		isTyping: boolean;
	}) => void;

	// presence
	'presence:list': (users: PresenceUser[]) => void;
	'presence:joined': (user: PresenceUser) => void;
	'presence:left': (userId: string) => void;

	// cursors
	'cursor:list': (cursors: CursorUpdate[]) => void;
	'cursor:update': (cursor: CursorUpdate) => void;
	'cursor:gone': (userId: string) => void;

	// scopes — every client annotates the receive with how it arrived
	'scope:received': (data: ScopePing) => void;

	// rate-limit — server pushes counters every second
	'ratelimit:tick': (status: RateLimitStatus) => void;

	// generic broadcast tick (used by the connection-lifecycle demo)
	'server:tick': (data: { now: number; uptimeSec: number }) => void;
}

export interface PlaygroundSocketData {
	userId: string;
	userName: string;
	color: string;
	joinedAt: number;
	chatRooms: Set<string>;
	scopeRoom: string | null;
	rateBucket: { count: number; windowStart: number; dropped: number };
	// Per-event-class limiters to protect demo handlers from abuse.
	throttle?: Partial<
		Record<'scopePing' | 'ackEcho', { count: number; windowStart: number }>
	>;
}
