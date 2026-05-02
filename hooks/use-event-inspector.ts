'use client';

import { useEffect, useState } from 'react';
import { onInspectorEvent } from '@/lib/playground/client';
import type { InspectorEvent } from '@/lib/playground/types';

const MAX_EVENTS = 200;

// Subscribes to the wire-level event stream from the playground client. Useful
// for the floating event-log overlay so users can see exactly what's going
// over the socket as they interact with each demo.
export function useEventInspector(enabled: boolean) {
	const [events, setEvents] = useState<InspectorEvent[]>([]);

	useEffect(() => {
		if (!enabled) return;
		return onInspectorEvent((e) => {
			setEvents((prev) => {
				const next = [e, ...prev];
				return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
			});
		});
	}, [enabled]);

	function clear() {
		setEvents([]);
	}

	return { events, clear };
}
