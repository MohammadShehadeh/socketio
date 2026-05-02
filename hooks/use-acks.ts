'use client';

import { useCallback, useState } from 'react';
import { playground } from '@/lib/playground/client';

export interface AckResult {
	id: string;
	startedAt: number;
	delayMs: number;
	failRate: number;
	timeoutMs: number;
	status: 'pending' | 'ok' | 'error' | 'timeout';
	latencyMs?: number;
	error?: string;
}

export function useAcks() {
	const [results, setResults] = useState<AckResult[]>([]);

	const send = useCallback(
		async (delayMs: number, failRate: number, timeoutMs: number) => {
			const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
			const startedAt = performance.now();
			setResults((prev) => {
				const entry: AckResult = {
					id,
					startedAt: Date.now(),
					delayMs,
					failRate,
					timeoutMs,
					status: 'pending',
				};
				return [entry, ...prev].slice(0, 25);
			});

			const result = await playground.ack.echo(delayMs, failRate, timeoutMs);
			const latencyMs = Math.round(performance.now() - startedAt);

			setResults((prev) =>
				prev.map((r) => {
					if (r.id !== id) return r;
					if (!result.ok) {
						const isTimeout = result.error.toLowerCase().includes('timeout');
						return {
							...r,
							status: isTimeout ? 'timeout' : 'error',
							latencyMs,
							error: result.error,
						};
					}
					if (!result.response.ok) {
						return {
							...r,
							status: 'error',
							latencyMs,
							error: result.response.error ?? 'unknown',
						};
					}
					return { ...r, status: 'ok', latencyMs };
				}),
			);
		},
		[],
	);

	return { results, send };
}
