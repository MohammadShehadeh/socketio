'use client';

import { useEffect, useState } from 'react';
import { on } from '@/lib/playground/client';

export interface ServerTick {
	serverNow: number;
	uptimeSec: number;
	receivedAt: number;
	skewMs: number;
}

// Subscription to the heartbeat the server emits every second. Used by the
// connection-lifecycle demo to demonstrate data flowing in without a request.
//
// We stamp clock-skew at receive time so the consumer can render it as a
// pure value — calling Date.now() during render would be impure and would
// produce flicker as React re-renders independently of the tick.
export function useServerTick() {
	const [tick, setTick] = useState<ServerTick | null>(null);

	useEffect(() => {
		return on<{ now: number; uptimeSec: number }>('server:tick', (t) => {
			const receivedAt = Date.now();
			setTick({
				serverNow: t.now,
				uptimeSec: t.uptimeSec,
				receivedAt,
				skewMs: receivedAt - t.now,
			});
		});
	}, []);

	return tick;
}
