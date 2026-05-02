// Mirror of server/playground/types.ts. Kept separate so client code never
// transitively imports server modules.

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
	x: number;
	y: number;
}

export type BroadcastScope = 'self' | 'room' | 'broadcast-room' | 'all';

export interface ScopePing {
	id: string;
	scope: BroadcastScope;
	fromUserId: string;
	fromUserName: string;
	room: string;
	at: number;
}

export interface RateLimitStatus {
	allowed: number;
	dropped: number;
	windowMs: number;
	limit: number;
}

export interface AckRequest {
	id: string;
	delayMs: number;
	failRate: number;
}

export interface AckResponse {
	id: string;
	ok: boolean;
	error?: string;
	processedAt: number;
}

export type ConnectionState =
	| 'disconnected'
	| 'connecting'
	| 'connected'
	| 'reconnecting';

// One log entry for the event inspector. Direction tells us whether we emitted
// it or received it; latency is filled in when we get an ack back.
export interface InspectorEvent {
	id: string;
	direction: 'in' | 'out';
	event: string;
	payload: unknown;
	at: number;
	latencyMs?: number;
}
