'use client';

import { useRef } from 'react';
import { useCursors } from '@/hooks';
import { useAuth } from '@/lib/auth/auth-context';
import { DemoPage } from '@/components/playground/demo-page';

export default function CursorsDemoPage() {
	const { user } = useAuth();
	const { cursors, move } = useCursors(user!.id);
	const padRef = useRef<HTMLDivElement>(null);

	function handleMove(e: React.PointerEvent<HTMLDivElement>) {
		const el = padRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		// Normalize to 0..1 so different viewports line up regardless of size.
		const x = (e.clientX - rect.left) / rect.width;
		const y = (e.clientY - rect.top) / rect.height;
		move(x, y);
	}

	return (
		<DemoPage
			title="Cursor sync"
			subtitle="High-frequency, lossy, normalized coordinates. The kind of traffic where dropping the occasional packet is feature, not bug."
			concepts={[
				{
					name: 'Volatile emit',
					detail:
						'socket.volatile.emit drops the event if the underlying buffer is full. For cursors, a stale position is worse than a missing one.',
				},
				{
					name: 'Client throttle',
					detail:
						'The hook caps outgoing updates at ~33fps. Adequate for cursors, gentle on the wire.',
				},
				{
					name: 'Normalized coords',
					detail:
						'Coordinates are 0..1 so two viewers with different window sizes see the same relative position.',
				},
				{
					name: 'Stale eviction',
					detail:
						'If a remote cursor goes silent for 5s, we drop it locally — protects against stuck cursors when someone closes the tab.',
				},
			]}
			source={{
				server: 'server/playground/handler.ts (registerCursors)',
				hook: 'hooks/use-cursors.ts',
				component: 'app/playground/cursors/page.tsx',
			}}
		>
			<div
				ref={padRef}
				onPointerMove={handleMove}
				className="relative h-[60vh] cursor-crosshair overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
			>
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.04)_1px,_transparent_1px)] [background-size:24px_24px] dark:bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_1px,_transparent_1px)]" />

				<div className="absolute top-3 left-3 rounded-md bg-white/80 px-2 py-1 text-xs text-zinc-600 backdrop-blur dark:bg-zinc-900/70 dark:text-zinc-300">
					{cursors.length} other {cursors.length === 1 ? 'cursor' : 'cursors'}
				</div>

				{cursors.map((c) => (
					<div
						key={c.userId}
						className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-transform"
						style={{
							left: `${c.x * 100}%`,
							top: `${c.y * 100}%`,
						}}
					>
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							style={{ color: c.color }}
						>
							<path
								d="M5 3l5 17 3-7 7-3-15-7z"
								fill="currentColor"
								stroke="white"
								strokeWidth="1.5"
								strokeLinejoin="round"
							/>
						</svg>
						<span
							className="ml-3 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
							style={{ backgroundColor: c.color }}
						>
							{c.userName}
						</span>
					</div>
				))}

				{cursors.length === 0 && (
					<div className="absolute inset-0 flex items-center justify-center text-center text-sm text-zinc-500">
						<div>
							<div className="mb-1 font-medium">Open this page in another tab.</div>
							<div className="text-xs">Move your mouse — the other tab will see it.</div>
						</div>
					</div>
				)}
			</div>
		</DemoPage>
	);
}
