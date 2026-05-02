'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { usePlaygroundConnection, useServerTick } from '@/hooks';
import { DemoPage } from '@/components/playground/demo-page';

export default function ConnectionDemoPage() {
	const { user } = useAuth();
	const conn = usePlaygroundConnection(user!.id, user!.name);
	const tick = useServerTick();

	return (
		<DemoPage
			title="Connection lifecycle"
			subtitle="The Socket.IO handshake, transport upgrade, reconnection state machine, and a server-pushed heartbeat."
			concepts={[
				{
					name: 'Handshake auth',
					detail:
						'Client sends { userId, userName } in io({ auth }); server validates in nsp.use().',
				},
				{
					name: 'Transport',
					detail:
						'Connection starts on HTTP polling, upgrades to WebSocket when available.',
				},
				{
					name: 'Reconnection',
					detail:
						'The client retries forever with exponential backoff. State transitions: disconnected → connecting → connected → reconnecting.',
				},
				{
					name: 'Server-push heartbeat',
					detail:
						'The server emits a "server:tick" every second. You receive it without asking — that is the whole point of websockets.',
				},
			]}
			source={{
				server: 'server/playground/handler.ts (startPlaygroundTick)',
				client: 'lib/playground/client.ts',
				hook: 'hooks/use-playground-connection.ts',
				component: 'app/playground/connection/page.tsx',
			}}
		>
			<div className="grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
					<h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
						Connection
					</h3>
					<dl className="space-y-2 text-sm">
						<Row label="State" value={<StateBadge state={conn.state} />} />
						<Row label="Transport" value={<Mono>{conn.transport ?? '—'}</Mono>} />
						<Row label="Socket id" value={<Mono>{conn.socketId ?? '—'}</Mono>} />
						<Row label="Namespace" value={<Mono>{conn.namespace}</Mono>} />
						<Row
							label="Auth.userId"
							value={<Mono>{conn.userId ?? '—'}</Mono>}
						/>
						<Row
							label="Auth.userName"
							value={<Mono>{conn.userName ?? '—'}</Mono>}
						/>
						<Row
							label="Connected at"
							value={
								<Mono>
									{conn.connectedAt
										? new Date(conn.connectedAt).toLocaleTimeString()
										: '—'}
								</Mono>
							}
						/>
						<Row
							label="Last disconnect"
							value={
								<Mono>
									{conn.disconnectedAt
										? new Date(conn.disconnectedAt).toLocaleTimeString()
										: '—'}
								</Mono>
							}
						/>
					</dl>
					<button
						type="button"
						onClick={conn.reconnect}
						className="mt-4 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					>
						Force reconnect (kills socket and dials again)
					</button>
				</div>

				<div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
					<h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
						Server heartbeat
					</h3>
					{tick ? (
						<div className="space-y-2 text-sm">
							<Row
								label="Server time"
								value={
									<Mono>
										{new Date(tick.serverNow).toLocaleTimeString()}
									</Mono>
								}
							/>
							<Row
								label="Server uptime"
								value={<Mono>{tick.uptimeSec}s</Mono>}
							/>
							<Row
								label="Clock skew (last tick)"
								value={
									<Mono>
										{tick.skewMs >= 0 ? '+' : ''}
										{tick.skewMs}ms
									</Mono>
								}
							/>
						</div>
					) : (
						<p className="text-sm text-zinc-500">Waiting for first tick…</p>
					)}
					<p className="mt-4 text-xs text-zinc-500">
						Try toggling network in DevTools → the state badge will jump to
						<Mono> reconnecting</Mono>, the heartbeat will pause, then it will
						all resume when the network returns.
					</p>
				</div>
			</div>
		</DemoPage>
	);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<dt className="text-zinc-500">{label}</dt>
			<dd className="text-right">{value}</dd>
		</div>
	);
}

function Mono({ children }: { children: React.ReactNode }) {
	return (
		<span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
			{children}
		</span>
	);
}

function StateBadge({ state }: { state: string }) {
	const colors: Record<string, string> = {
		connected: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
		connecting: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
		reconnecting: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
		disconnected: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
	};
	return (
		<span
			className={`rounded px-2 py-0.5 text-xs font-semibold ${colors[state] ?? 'bg-zinc-200 text-zinc-700'}`}
		>
			{state}
		</span>
	);
}
