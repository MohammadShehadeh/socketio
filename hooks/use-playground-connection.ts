'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
	acquire,
	release,
	ensureConnected,
	getConnectionInfo,
	onConnectionStateChange,
	forceReconnect,
} from '@/lib/playground/client';

// Stable reference to the connection-info snapshot. useSyncExternalStore
// requires the snapshot to be referentially stable between calls when the
// underlying state hasn't changed; since getConnectionInfo() builds a fresh
// object every call, we cache it and refresh only when listeners notify.
let cachedSnapshot: ReturnType<typeof getConnectionInfo> | null = null;
function getSnapshot() {
	if (!cachedSnapshot) cachedSnapshot = getConnectionInfo();
	return cachedSnapshot;
}
function subscribe(notify: () => void) {
	return onConnectionStateChange(() => {
		cachedSnapshot = getConnectionInfo();
		notify();
	});
}
// Server-render snapshot — connection always starts disconnected pre-hydration.
const SERVER_SNAPSHOT: ReturnType<typeof getConnectionInfo> = {
	state: 'disconnected',
	transport: null,
	connectedAt: null,
	disconnectedAt: null,
	socketId: null,
	namespace: '/playground',
	userId: null,
	userName: null,
};
function getServerSnapshot() {
	return SERVER_SNAPSHOT;
}

// Ref-counted connection: every demo that needs the playground socket calls
// this hook. We dial *during render* via ensureConnected() so child effects
// (which fire before parent effects in React) can rely on the socket being
// in place. ensureConnected is idempotent — same credentials = no-op.
export function usePlaygroundConnection(userId: string, userName: string) {
	// Dial during render. Idempotent: returns the existing socket if creds match.
	ensureConnected(userId, userName);

	// Track ref-count via mount/unmount. Strict Mode in dev runs effects twice
	// (mount → cleanup → mount) — that pairs correctly through acquire/release,
	// so the count returns to its original value, the socket is rebuilt once,
	// and listeners (which are re-attached via the registry) all survive.
	useEffect(() => {
		acquire(userId, userName);
		return () => {
			release();
		};
	}, [userId, userName]);

	const info = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
	const reconnect = useCallback(() => forceReconnect(), []);

	return { ...info, reconnect };
}
