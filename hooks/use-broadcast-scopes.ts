'use client';

import { useCallback, useEffect, useState } from 'react';
import { on, playground } from '@/lib/playground/client';
import type { BroadcastScope, ScopePing } from '@/lib/playground/types';

const SCOPE_LIMIT = 30;

export function useBroadcastScopes(room: string) {
	const [received, setReceived] = useState<ScopePing[]>([]);

	useEffect(() => {
		playground.scope.join(room);
		const cleanup = on<ScopePing>('scope:received', (ping) => {
			setReceived((prev) => {
				const next = [ping, ...prev];
				return next.length > SCOPE_LIMIT ? next.slice(0, SCOPE_LIMIT) : next;
			});
		});
		return () => {
			cleanup();
			playground.scope.leave(room);
			setReceived([]);
		};
	}, [room]);

	const ping = useCallback(
		(scope: BroadcastScope) => playground.scope.ping(room, scope),
		[room],
	);

	return { received, ping };
}
