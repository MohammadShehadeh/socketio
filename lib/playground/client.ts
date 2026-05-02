// Singleton client for the /playground namespace.
//
// Why a separate client from lib/socket/client.ts:
//   - Different namespace (/playground vs /), so a separate Socket instance.
//   - Demos may be open simultaneously across tabs/components — we ref-count
//     mounts so the first hook connects, the last one disconnects.
//   - We pipe every emit and incoming event through the inspector, so the
//     event-log overlay shows real wire traffic, not just app-level state.

import { io, Socket } from 'socket.io-client';
import { SOCKET_SERVER_URL } from '@/lib/socket/constants';
import type {
	BroadcastScope,
	ConnectionState,
	InspectorEvent,
} from './types';

type AnySocket = Socket;

const NAMESPACE = '/playground';

let socket: AnySocket | null = null;
let mountCount = 0;
let connectionState: ConnectionState = 'disconnected';
let lastConnectedAt: number | null = null;
let lastDisconnectedAt: number | null = null;
let lastTransport: string | null = null;
let credentials: { userId: string; userName: string } | null = null;

const stateListeners = new Set<() => void>();
const inspectorListeners = new Set<(e: InspectorEvent) => void>();

// Listener registry: lets hooks call `on()` *before* the socket exists, and
// before connect completes. We re-attach all registered listeners every time
// we create or replace the socket. This eliminates the race where a hook
// mounts in the same tick as `acquire()` and registers its listener while
// `socket` is still null.
type EventListener = (...args: unknown[]) => void;
const eventListeners = new Map<string, Set<EventListener>>();

function attachEventListener(event: string, cb: EventListener) {
	socket?.on(event, cb);
}
function detachEventListener(event: string, cb: EventListener) {
	socket?.off(event, cb);
}
function reattachAllListeners() {
	if (!socket) return;
	for (const [event, cbs] of eventListeners) {
		for (const cb of cbs) socket.on(event, cb);
	}
}

function notifyStateListeners() {
	for (const cb of stateListeners) cb();
}

function pushInspector(e: InspectorEvent) {
	for (const cb of inspectorListeners) cb(e);
}

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- public API: connection ------------------------------------------------

export function getConnectionState(): ConnectionState {
	return connectionState;
}

export function getConnectionInfo() {
	return {
		state: connectionState,
		transport: lastTransport,
		connectedAt: lastConnectedAt,
		disconnectedAt: lastDisconnectedAt,
		socketId: socket?.id ?? null,
		namespace: NAMESPACE,
		userId: credentials?.userId ?? null,
		userName: credentials?.userName ?? null,
	};
}

export function onConnectionStateChange(cb: () => void): () => void {
	stateListeners.add(cb);
	return () => {
		stateListeners.delete(cb);
	};
}

export function onInspectorEvent(
	cb: (e: InspectorEvent) => void,
): () => void {
	inspectorListeners.add(cb);
	return () => {
		inspectorListeners.delete(cb);
	};
}

// Set credentials BEFORE rendering children that may register listeners or
// emit. Calling this from a parent component during render (not in an effect)
// guarantees the singleton is dialed before any child effects run. The call
// is idempotent and only rebuilds the socket when credentials change.
export function ensureConnected(userId: string, userName: string): AnySocket {
	if (socket) {
		if (
			credentials &&
			(credentials.userId !== userId || credentials.userName !== userName)
		) {
			tearDown();
		} else {
			return socket;
		}
	}

	credentials = { userId, userName };

	socket = io(`${SOCKET_SERVER_URL}${NAMESPACE}`, {
		auth: { userId, userName },
		transports: ['websocket', 'polling'],
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
		timeout: 10000,
		autoConnect: true,
	});

	connectionState = 'connecting';
	notifyStateListeners();

	socket.on('connect', () => {
		connectionState = 'connected';
		lastConnectedAt = Date.now();
		// engine.io exposes the underlying transport so we can show poll→ws.
		// The Manager type does expose `engine`, but its `Engine` interface
		// isn't re-exported from socket.io-client; we narrow with a small
		// structural type instead of `any`.
		const engine = socket?.io.engine as
			| {
					transport?: { name?: string };
					on?: (event: string, cb: (transport: { name: string }) => void) => void;
			  }
			| undefined;
		lastTransport = engine?.transport?.name ?? null;
		engine?.on?.('upgrade', (transport) => {
			lastTransport = transport.name;
			notifyStateListeners();
		});
		notifyStateListeners();
		pushInspector({
			id: generateId(),
			direction: 'in',
			event: '@connect',
			payload: { socketId: socket?.id, transport: lastTransport },
			at: Date.now(),
		});
	});

	socket.on('disconnect', (reason) => {
		connectionState = 'disconnected';
		lastDisconnectedAt = Date.now();
		notifyStateListeners();
		pushInspector({
			id: generateId(),
			direction: 'in',
			event: '@disconnect',
			payload: { reason },
			at: Date.now(),
		});
	});

	socket.on('connect_error', (err) => {
		connectionState = 'reconnecting';
		notifyStateListeners();
		pushInspector({
			id: generateId(),
			direction: 'in',
			event: '@connect_error',
			payload: { message: err.message },
			at: Date.now(),
		});
	});

	socket.io.on('reconnect_attempt', (attempt) => {
		connectionState = 'reconnecting';
		notifyStateListeners();
		pushInspector({
			id: generateId(),
			direction: 'in',
			event: '@reconnect_attempt',
			payload: { attempt },
			at: Date.now(),
		});
	});

	// Tap into every incoming event for the inspector. onAny doesn't fire for
	// connect/disconnect (those go through socket lifecycle), so we cover both.
	socket.onAny((event, ...args) => {
		pushInspector({
			id: generateId(),
			direction: 'in',
			event,
			payload: args.length === 1 ? args[0] : args,
			at: Date.now(),
		});
	});

	// Re-attach any listeners that were registered before the socket existed
	// (or before this reconnection produced a fresh underlying socket).
	reattachAllListeners();
	// Flush any emits that arrived before this socket existed. After this point
	// socket.io's own send buffer handles pre-connect emits transparently.
	flushPreConnectQueue();

	return socket;
}

// Ref-counted hook lifecycle. The first acquire() dials, subsequent acquires
// reuse, and release() returns to disconnected only when the last consumer
// unmounts. Use ensureConnected() at the layout-render level to avoid
// effect-ordering races.
export function acquire(userId: string, userName: string): AnySocket {
	mountCount += 1;
	return ensureConnected(userId, userName);
}

export function release(): void {
	mountCount = Math.max(0, mountCount - 1);
	if (mountCount === 0) tearDown();
}

function tearDown() {
	if (!socket) return;
	const s = socket;
	socket = null;
	connectionState = 'disconnected';
	lastTransport = null;
	credentials = null;
	s.offAny();
	s.disconnect();
	notifyStateListeners();
}

export function forceReconnect() {
	if (!socket) return;
	socket.disconnect().connect();
}

export function getSocket(): AnySocket | null {
	return socket;
}

// ---- emit helper -----------------------------------------------------------
// Wrapping emit gives us free instrumentation: every outgoing event shows up
// in the inspector, and acks get latency measurement.
//
// If the socket exists but isn't connected yet, socket.io's own send buffer
// queues the emit until handshake completes — we don't need to do anything.
// If the socket doesn't exist at all yet, we queue locally and flush once it
// does. The queue is bounded so a misbehaving caller can't OOM the tab.

const PRE_CONNECT_QUEUE_LIMIT = 64;
const preConnectQueue: { event: string; payload: unknown }[] = [];

export function emit<T = unknown>(event: string, payload?: T): void {
	pushInspector({
		id: generateId(),
		direction: 'out',
		event,
		payload,
		at: Date.now(),
	});
	if (!socket) {
		if (preConnectQueue.length >= PRE_CONNECT_QUEUE_LIMIT) {
			preConnectQueue.shift();
		}
		preConnectQueue.push({ event, payload });
		return;
	}
	if (payload === undefined) socket.emit(event);
	else socket.emit(event, payload);
}

function flushPreConnectQueue() {
	if (!socket || preConnectQueue.length === 0) return;
	const drained = preConnectQueue.splice(0);
	for (const { event, payload } of drained) {
		if (payload === undefined) socket.emit(event);
		else socket.emit(event, payload);
	}
}

export function emitWithAck<TReq, TRes>(
	event: string,
	payload: TReq,
	timeoutMs: number,
): Promise<{ ok: true; response: TRes } | { ok: false; error: string }> {
	return new Promise((resolve) => {
		const s = socket;
		if (!s) {
			// Acks need a live socket — the request/response pattern can't queue
			// because the caller is awaiting the result. Fail fast.
			resolve({ ok: false, error: 'socket not connected' });
			return;
		}
		const startedAt = performance.now();
		const id = generateId();
		pushInspector({
			id,
			direction: 'out',
			event,
			payload,
			at: Date.now(),
		});
		// .timeout() returns a wrapped emitter — the ack callback receives
		// (err, response). When err is set, the timeout fired.
		s.timeout(timeoutMs).emit(event, payload, (err: Error | null, response: TRes) => {
			const latencyMs = Math.round(performance.now() - startedAt);
			if (err) {
				pushInspector({
					id: generateId(),
					direction: 'in',
					event: `${event}#ack-timeout`,
					payload: { message: err.message },
					at: Date.now(),
					latencyMs,
				});
				resolve({ ok: false, error: err.message });
				return;
			}
			pushInspector({
				id: generateId(),
				direction: 'in',
				event: `${event}#ack`,
				payload: response,
				at: Date.now(),
				latencyMs,
			});
			resolve({ ok: true, response });
		});
	});
}

// ---- typed helpers for common scenarios ------------------------------------

export const playground = {
	chat: {
		join: (room: string) => emit('chat:join', room),
		leave: (room: string) => emit('chat:leave', room),
		send: (room: string, text: string) => emit('chat:send', { room, text }),
		typing: (room: string, isTyping: boolean) =>
			emit('chat:typing', { room, isTyping }),
	},
	presence: {
		hello: () => emit('presence:hello'),
	},
	cursor: {
		move: (x: number, y: number) => {
			// Skip the inspector here — cursor traffic would drown the log out.
			socket?.volatile.emit('cursor:move', { x, y });
		},
	},
	scope: {
		join: (room: string) => emit('scope:join', room),
		leave: (room: string) => emit('scope:leave', room),
		ping: (room: string, scope: BroadcastScope) =>
			emit('scope:ping', { room, scope }),
	},
	ack: {
		echo: (delayMs: number, failRate: number, timeoutMs = 5000) =>
			emitWithAck<
				{ id: string; delayMs: number; failRate: number },
				{ id: string; ok: boolean; error?: string; processedAt: number }
			>(
				'ack:echo',
				{ id: generateId(), delayMs, failRate },
				timeoutMs,
			),
	},
	rateLimit: {
		fire: () => {
			// Skip inspector — flood traffic.
			socket?.emit('ratelimit:event');
		},
	},
};

// Generic listener helper that returns a cleanup. Safe to call before the
// socket is ready — the registry holds the listener and we attach as soon as
// a socket exists. Re-attached automatically on reconnect/credentials change.
export function on<T = unknown>(event: string, cb: (data: T) => void): () => void {
	const handler = ((data: unknown) => cb(data as T)) as EventListener;
	const set = eventListeners.get(event) ?? new Set<EventListener>();
	set.add(handler);
	eventListeners.set(event, set);
	attachEventListener(event, handler);
	return () => {
		set.delete(handler);
		if (set.size === 0) eventListeners.delete(event);
		detachEventListener(event, handler);
	};
}
