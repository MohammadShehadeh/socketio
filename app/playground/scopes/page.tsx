'use client';

import { useState } from 'react';
import { useBroadcastScopes } from '@/hooks';
import { useAuth } from '@/lib/auth/auth-context';
import { DemoPage } from '@/components/playground/demo-page';
import { Button } from '@/components/ui/button';
import type { BroadcastScope, ScopePing } from '@/lib/playground/types';

const SCOPES: { id: BroadcastScope; label: string; explainer: string }[] = [
	{
		id: 'self',
		label: 'self',
		explainer: 'socket.emit(...) — only the sender receives.',
	},
	{
		id: 'room',
		label: 'room (incl. sender)',
		explainer: 'io.to(room).emit(...) — everyone in the room, sender included.',
	},
	{
		id: 'broadcast-room',
		label: 'broadcast.to(room)',
		explainer: 'socket.to(room).emit(...) — everyone in the room except the sender.',
	},
	{
		id: 'all',
		label: 'all (namespace-wide)',
		explainer: 'io.emit(...) — every connected socket on this namespace.',
	},
];

export default function ScopesDemoPage() {
	const { user } = useAuth();
	const [room, setRoom] = useState('alpha');
	const { received, ping } = useBroadcastScopes(room);

	return (
		<DemoPage
			title="Broadcast scopes"
			subtitle="Four ways to send the same event — to yourself, to a room, to everyone in the room except yourself, or to every connected client. Open this page in a second tab in the same room to see the difference."
			concepts={[
				{
					name: 'socket.emit',
					detail: 'Sends only to the calling socket. Use for confirmations and per-user state.',
				},
				{
					name: 'io.to(room)',
					detail: 'Server-side helper that targets a room and includes the sender.',
				},
				{
					name: 'socket.broadcast.to(room)',
					detail: 'Like io.to(room) but excludes the sender — common for "tell others".',
				},
				{
					name: 'io.emit',
					detail: 'Every socket on the namespace. Powerful — easy to abuse.',
				},
			]}
			source={{
				server: 'server/playground/handler.ts (registerScopes / dispatchByScope)',
				hook: 'hooks/use-broadcast-scopes.ts',
				component: 'app/playground/scopes/page.tsx',
			}}
		>
			<div className="space-y-4">
				<div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
					<label className="text-sm text-zinc-600 dark:text-zinc-400">
						Room
					</label>
					<input
						value={room}
						onChange={(e) => setRoom(e.target.value || 'alpha')}
						className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
					/>
					<span className="text-xs text-zinc-500">
						Open another tab and join the same room to compare.
					</span>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
						<h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
							Send a ping
						</h3>
						<div className="space-y-2">
							{SCOPES.map((s) => (
								<div
									key={s.id}
									className="flex items-center gap-3 rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
								>
									<Button size="sm" onClick={() => ping(s.id)}>
										{s.label}
									</Button>
									<p className="flex-1 text-xs text-zinc-500">{s.explainer}</p>
								</div>
							))}
						</div>
					</div>

					<div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
						<div className="mb-2 flex items-center justify-between">
							<h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
								Received pings
							</h3>
							<span className="text-xs text-zinc-500">{received.length}</span>
						</div>
						<div className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-xs">
							{received.length === 0 ? (
								<p className="py-6 text-center text-zinc-500">
									Click a button → it will arrive here based on which scope you
									chose.
								</p>
							) : (
								received.map((p) => (
									<PingRow
										key={p.id}
										ping={p}
										isSelf={p.fromUserId === user!.id}
									/>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</DemoPage>
	);
}

function PingRow({ ping, isSelf }: { ping: ScopePing; isSelf: boolean }) {
	return (
		<div className="flex items-center gap-2 rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900">
			<span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-700 dark:text-violet-300">
				{ping.scope}
			</span>
			<span className="text-zinc-700 dark:text-zinc-300">
				from <strong>{ping.fromUserName}</strong>
				{isSelf && <span className="ml-1 text-zinc-500">(you)</span>}
			</span>
			<span className="ml-auto font-mono text-[10px] text-zinc-500">
				{new Date(ping.at).toLocaleTimeString()}
			</span>
		</div>
	);
}
