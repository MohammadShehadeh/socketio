'use client';

import { useState } from 'react';
import { useEventInspector } from '@/hooks';
import type { InspectorEvent } from '@/lib/playground/types';

// Floating, toggleable wire-traffic log for the playground namespace. It taps
// the same client every demo uses, so what you see here is exactly what's
// going over the socket.
export function EventInspector() {
	const [open, setOpen] = useState(false);
	const { events, clear } = useEventInspector(open);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="fixed right-4 bottom-4 z-50 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 shadow-lg hover:bg-zinc-800"
			>
				{open ? '× Close inspector' : '⚡ Event inspector'}
			</button>

			{open && (
				<div className="fixed right-4 bottom-16 z-50 flex h-[60vh] w-[440px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
					<div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
						<div className="font-mono text-xs text-zinc-300">
							/playground · {events.length} events
						</div>
						<button
							type="button"
							onClick={clear}
							className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
						>
							Clear
						</button>
					</div>
					<div className="flex-1 overflow-y-auto font-mono text-[11px]">
						{events.length === 0 ? (
							<div className="p-3 text-zinc-500">
								Interact with a demo to see events appear here.
							</div>
						) : (
							events.map((e) => <EventRow key={e.id} event={e} />)
						)}
					</div>
				</div>
			)}
		</>
	);
}

function EventRow({ event }: { event: InspectorEvent }) {
	const isOut = event.direction === 'out';
	const isMeta = event.event.startsWith('@');
	return (
		<div className="border-b border-zinc-900 px-3 py-1.5">
			<div className="flex items-center gap-2">
				<span
					className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
						isMeta
							? 'bg-violet-900/60 text-violet-200'
							: isOut
								? 'bg-blue-900/60 text-blue-200'
								: 'bg-emerald-900/60 text-emerald-200'
					}`}
				>
					{isMeta ? 'META' : isOut ? 'OUT' : 'IN'}
				</span>
				<span className="truncate font-medium text-zinc-100">{event.event}</span>
				<span className="ml-auto shrink-0 text-zinc-500">
					{event.latencyMs != null ? `${event.latencyMs}ms · ` : ''}
					{new Date(event.at).toLocaleTimeString()}
				</span>
			</div>
			{event.payload !== undefined && (
				<pre className="mt-1 max-h-24 overflow-y-auto rounded bg-zinc-900 p-1.5 text-[10px] text-zinc-300">
					{JSON.stringify(event.payload, null, 2)}
				</pre>
			)}
		</div>
	);
}
