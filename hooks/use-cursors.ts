'use client';

import { useEffect, useRef, useState } from 'react';
import { on, playground } from '@/lib/playground/client';
import type { CursorUpdate } from '@/lib/playground/types';

const STALE_MS = 5000;
const SEND_THROTTLE_MS = 30; // ~33fps — plenty for cursors, easy on the wire

export function useCursors(currentUserId: string) {
	const [cursors, setCursors] = useState<Map<string, CursorUpdate>>(new Map());
	const lastSentRef = useRef(0);
	const staleTimers = useRef(
		new Map<string, ReturnType<typeof setTimeout>>(),
	);

	useEffect(() => {
		const cleanups: Array<() => void> = [];

		cleanups.push(
			on<CursorUpdate>('cursor:update', (update) => {
				if (update.userId === currentUserId) return;
				setCursors((prev) => {
					const next = new Map(prev);
					next.set(update.userId, update);
					return next;
				});
				const existing = staleTimers.current.get(update.userId);
				if (existing) clearTimeout(existing);
				const t = setTimeout(() => removeCursor(update.userId), STALE_MS);
				staleTimers.current.set(update.userId, t);
			}),
		);

		cleanups.push(
			on<string>('cursor:gone', (userId) => removeCursor(userId)),
		);

		function removeCursor(userId: string) {
			setCursors((prev) => {
				if (!prev.has(userId)) return prev;
				const next = new Map(prev);
				next.delete(userId);
				return next;
			});
			const t = staleTimers.current.get(userId);
			if (t) {
				clearTimeout(t);
				staleTimers.current.delete(userId);
			}
		}

		const timersAtMount = staleTimers.current;
		return () => {
			for (const c of cleanups) c();
			for (const t of timersAtMount.values()) clearTimeout(t);
			timersAtMount.clear();
		};
	}, [currentUserId]);

	function move(x: number, y: number) {
		const now = performance.now();
		if (now - lastSentRef.current < SEND_THROTTLE_MS) return;
		lastSentRef.current = now;
		playground.cursor.move(x, y);
	}

	return { cursors: Array.from(cursors.values()), move };
}
