'use client';

import { useEffect, useRef, useState } from 'react';
import { on, playground } from '@/lib/playground/client';
import type { RateLimitStatus } from '@/lib/playground/types';

export function useRateLimit() {
	const [status, setStatus] = useState<RateLimitStatus | null>(null);
	const [clientFired, setClientFired] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		const cleanup = on<RateLimitStatus>('ratelimit:tick', (s) => setStatus(s));
		return () => {
			cleanup();
			stop();
		};
	}, []);

	function stop() {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}

	function flood(perSecond: number) {
		stop();
		const intervalMs = Math.max(1, Math.floor(1000 / perSecond));
		intervalRef.current = setInterval(() => {
			playground.rateLimit.fire();
			setClientFired((n) => n + 1);
		}, intervalMs);
	}

	function reset() {
		setClientFired(0);
	}

	return { status, clientFired, flood, stop, reset, isFlooding: !!intervalRef.current };
}
