'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { on, playground } from '@/lib/playground/client';
import type { ChatMessage } from '@/lib/playground/types';

// One-room chat with typing indicators. Joins on mount, leaves on unmount.
// Typing state is ephemeral and capped to 3s of silence so a stuck "typing"
// indicator never lingers if the typer disconnects mid-keystroke.
const TYPING_TIMEOUT_MS = 3000;

export function useChat(room: string, currentUserId: string) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [typing, setTyping] = useState<Map<string, string>>(new Map());
	const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

	useEffect(() => {
		playground.chat.join(room);

		const cleanups: Array<() => void> = [];

		cleanups.push(
			on<{ room: string; messages: ChatMessage[] }>('chat:history', (data) => {
				if (data.room !== room) return;
				setMessages(data.messages);
			}),
		);

		cleanups.push(
			on<ChatMessage>('chat:message', (msg) => {
				if (msg.room !== room) return;
				setMessages((prev) =>
					prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
				);
				// Sender's own message means they stopped typing.
				clearTypingFor(msg.userId);
			}),
		);

		cleanups.push(
			on<{
				room: string;
				userId: string;
				userName: string;
				isTyping: boolean;
			}>('chat:typing', ({ room: r, userId, userName, isTyping }) => {
				if (r !== room || userId === currentUserId) return;
				if (!isTyping) {
					clearTypingFor(userId);
					return;
				}
				setTyping((prev) => {
					const next = new Map(prev);
					next.set(userId, userName);
					return next;
				});
				const timer = setTimeout(
					() => clearTypingFor(userId),
					TYPING_TIMEOUT_MS,
				);
				const existing = typingTimers.current.get(userId);
				if (existing) clearTimeout(existing);
				typingTimers.current.set(userId, timer);
			}),
		);

		function clearTypingFor(userId: string) {
			setTyping((prev) => {
				if (!prev.has(userId)) return prev;
				const next = new Map(prev);
				next.delete(userId);
				return next;
			});
			const timer = typingTimers.current.get(userId);
			if (timer) {
				clearTimeout(timer);
				typingTimers.current.delete(userId);
			}
		}

		// Snapshot the ref's current Map so the cleanup uses the same instance
		// the effect populated, not whatever ref is pointing at later.
		const timersAtMount = typingTimers.current;
		return () => {
			for (const c of cleanups) c();
			playground.chat.leave(room);
			for (const t of timersAtMount.values()) clearTimeout(t);
			timersAtMount.clear();
			setMessages([]);
			setTyping(new Map());
		};
	}, [room, currentUserId]);

	const send = useCallback(
		(text: string) => playground.chat.send(room, text),
		[room],
	);

	const setIsTyping = useCallback(
		(isTyping: boolean) => playground.chat.typing(room, isTyping),
		[room],
	);

	return { messages, typing: Array.from(typing.values()), send, setIsTyping };
}
