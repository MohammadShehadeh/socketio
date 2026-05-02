'use client';

import { useEffect, useState } from 'react';
import { on, playground } from '@/lib/playground/client';
import type { PresenceUser } from '@/lib/playground/types';

export function usePresence() {
	const [users, setUsers] = useState<PresenceUser[]>([]);

	useEffect(() => {
		playground.presence.hello();

		const cleanups: Array<() => void> = [];

		cleanups.push(
			on<PresenceUser[]>('presence:list', (list) => setUsers(list)),
		);

		cleanups.push(
			on<PresenceUser>('presence:joined', (user) =>
				setUsers((prev) =>
					prev.some((u) => u.userId === user.userId) ? prev : [...prev, user],
				),
			),
		);

		cleanups.push(
			on<string>('presence:left', (userId) =>
				setUsers((prev) => prev.filter((u) => u.userId !== userId)),
			),
		);

		return () => {
			for (const c of cleanups) c();
		};
	}, []);

	return users;
}
