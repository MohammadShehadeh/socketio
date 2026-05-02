import type { ChatMessage, PresenceUser } from './types';

// Rolling chat history per room. We cap per-room so the demo stays snappy
// and a late joiner gets a useful slice without a full replay. We also cap
// the *number of rooms* tracked: every unique room name from a client would
// otherwise leak memory forever (any string is a valid room key).
const CHAT_HISTORY_LIMIT = 50;
const CHAT_ROOM_LIMIT = 200;
const chatHistory = new Map<string, ChatMessage[]>();
// LRU eviction order — most-recently used rooms last.
const chatRoomLru: string[] = [];

function touchRoom(room: string) {
	const idx = chatRoomLru.indexOf(room);
	if (idx >= 0) chatRoomLru.splice(idx, 1);
	chatRoomLru.push(room);
	while (chatRoomLru.length > CHAT_ROOM_LIMIT) {
		const evict = chatRoomLru.shift();
		if (evict) chatHistory.delete(evict);
	}
}

// Presence is a single global "lobby" — userId is the stable key, not socketId,
// so two tabs from the same user don't double-count.
const presence = new Map<string, PresenceUser>();
const presenceSocketRefs = new Map<string, Set<string>>(); // userId -> socketIds

const COLORS = [
	'#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
	'#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e',
];

export function colorFor(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}
	return COLORS[Math.abs(hash) % COLORS.length];
}

export function appendChat(msg: ChatMessage): ChatMessage[] {
	const history = chatHistory.get(msg.room) ?? [];
	history.push(msg);
	if (history.length > CHAT_HISTORY_LIMIT) {
		history.splice(0, history.length - CHAT_HISTORY_LIMIT);
	}
	chatHistory.set(msg.room, history);
	touchRoom(msg.room);
	return history;
}

export function getChatHistory(room: string): ChatMessage[] {
	return chatHistory.get(room) ?? [];
}

// ---- presence ---------------------------------------------------------------

export function trackPresence(
	socketId: string,
	user: Omit<PresenceUser, 'joinedAt'>,
): { user: PresenceUser; isNew: boolean } {
	const refs = presenceSocketRefs.get(user.userId) ?? new Set();
	refs.add(socketId);
	presenceSocketRefs.set(user.userId, refs);

	const existing = presence.get(user.userId);
	if (existing) return { user: existing, isNew: false };

	const created: PresenceUser = { ...user, joinedAt: Date.now() };
	presence.set(user.userId, created);
	return { user: created, isNew: true };
}

export function untrackPresence(
	socketId: string,
	userId: string,
): { removed: boolean } {
	const refs = presenceSocketRefs.get(userId);
	if (!refs) return { removed: false };
	refs.delete(socketId);
	if (refs.size === 0) {
		presenceSocketRefs.delete(userId);
		presence.delete(userId);
		return { removed: true };
	}
	return { removed: false };
}

export function listPresence(): PresenceUser[] {
	return Array.from(presence.values()).sort((a, b) => a.joinedAt - b.joinedAt);
}

export function generateId(prefix = ''): string {
	return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
