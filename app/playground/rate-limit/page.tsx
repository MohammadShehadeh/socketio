'use client';

import { useRateLimit } from '@/hooks';
import { DemoPage } from '@/components/playground/demo-page';
import { Button } from '@/components/ui/button';

export default function RateLimitDemoPage() {
	const { status, clientFired, flood, stop, reset, isFlooding } = useRateLimit();

	const limit = status?.limit ?? 10;
	const allowed = status?.allowed ?? 0;
	const dropped = status?.dropped ?? 0;
	const fillPct = Math.min(100, (allowed / limit) * 100);

	return (
		<DemoPage
			title="Rate limiting"
			subtitle="The server allows 10 events per second per socket. Anything beyond that is silently dropped. Crank the slider and watch the drop counter climb."
			concepts={[
				{
					name: 'Per-socket budget',
					detail:
						'The server keeps a 1-second token bucket on socket.data. Cheap, no shared state.',
				},
				{
					name: 'Silent drop',
					detail:
						'The server does not bounce events back as errors — just doesn\'t process them. Real systems often do the same.',
				},
				{
					name: 'Server-pushed status',
					detail:
						'The server emits ratelimit:tick every 200ms with allowed/dropped counts. Pure server-push, no polling.',
				},
				{
					name: 'Volatile push',
					detail:
						'These ticks are volatile — if the buffer is full we skip a frame, the next one carries the latest counters.',
				},
			]}
			source={{
				server: 'server/playground/handler.ts (registerRateLimit)',
				hook: 'hooks/use-rate-limit.ts',
				component: 'app/playground/rate-limit/page.tsx',
			}}
		>
			<div className="space-y-4">
				<div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
					<h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
						Flood control
					</h3>
					<div className="flex flex-wrap gap-2">
						{[1, 5, 10, 20, 50, 100].map((rate) => (
							<Button
								key={rate}
								size="sm"
								variant={rate > limit ? 'destructive' : 'outline'}
								onClick={() => flood(rate)}
							>
								{rate}/sec
							</Button>
						))}
						<Button size="sm" variant="outline" onClick={stop} disabled={!isFlooding}>
							Stop
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								stop();
								reset();
							}}
						>
							Reset
						</Button>
					</div>
					<p className="mt-3 text-xs text-zinc-500">
						Server limit: <strong>{limit}/sec per socket</strong>. Anything over
						will appear in the &ldquo;dropped&rdquo; column.
					</p>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<Stat label="Client emitted" value={clientFired.toLocaleString()} />
					<Stat label="Server allowed (this window)" value={allowed.toLocaleString()} />
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<Stat label="Server dropped (this window)" value={dropped.toLocaleString()} accent={dropped > 0 ? 'rose' : undefined} />
					<Stat label="Drop rate" value={
						clientFired > 0
							? `${Math.round((dropped / Math.max(1, allowed + dropped)) * 100)}%`
							: '—'
					} />
				</div>

				<div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
					<div className="mb-2 flex items-center justify-between text-xs">
						<span className="text-zinc-500">
							Current second budget ({allowed}/{limit})
						</span>
						<span className="font-mono text-zinc-500">{Math.round(fillPct)}%</span>
					</div>
					<div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
						<div
							className={`h-full transition-all duration-150 ${
								fillPct >= 100
									? 'bg-rose-500'
									: fillPct > 80
										? 'bg-amber-500'
										: 'bg-emerald-500'
							}`}
							style={{ width: `${fillPct}%` }}
						/>
					</div>
				</div>
			</div>
		</DemoPage>
	);
}

function Stat({
	label,
	value,
	accent,
}: {
	label: string;
	value: string;
	accent?: 'rose';
}) {
	return (
		<div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
			<div className="text-xs text-zinc-500">{label}</div>
			<div
				className={`mt-1 font-mono text-2xl font-bold ${
					accent === 'rose'
						? 'text-rose-600 dark:text-rose-400'
						: 'text-zinc-900 dark:text-zinc-100'
				}`}
			>
				{value}
			</div>
		</div>
	);
}
