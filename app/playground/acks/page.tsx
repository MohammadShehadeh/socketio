'use client';

import { useState } from 'react';
import { useAcks } from '@/hooks';
import { DemoPage } from '@/components/playground/demo-page';
import { Button } from '@/components/ui/button';

export default function AcksDemoPage() {
	const { results, send } = useAcks();
	const [delay, setDelay] = useState(300);
	const [failRate, setFailRate] = useState(0);
	const [timeout, setTimeoutMs] = useState(2000);

	return (
		<DemoPage
			title="Acknowledgements & timeouts"
			subtitle="Socket.IO can do request/response — the client passes a callback as the last arg, and the server calls it. Add .timeout() and you get a Promise that rejects when the wire goes quiet."
			concepts={[
				{
					name: 'Ack callback',
					detail:
						'Last argument to emit can be a function. Server invokes it with the response.',
				},
				{
					name: '.timeout(ms)',
					detail:
						'Wraps the emit so the ack callback is invoked with an error if no response comes back in time.',
				},
				{
					name: 'Latency',
					detail:
						'We measure the wall-clock from emit to ack — the client wraps the whole thing in a Promise.',
				},
				{
					name: 'Failure modes',
					detail:
						'Server may reject (response.ok=false) OR never respond (timeout). Show both.',
				},
			]}
			source={{
				server: 'server/playground/handler.ts (registerAcks)',
				client: 'lib/playground/client.ts (emitWithAck)',
				hook: 'hooks/use-acks.ts',
				component: 'app/playground/acks/page.tsx',
			}}
		>
			<div className="grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
					<h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
						Send echo request
					</h3>
					<div className="space-y-3 text-sm">
						<NumberRow
							label="Server delay (ms)"
							value={delay}
							min={0}
							max={5000}
							step={100}
							onChange={setDelay}
						/>
						<NumberRow
							label="Fail rate (0–1)"
							value={failRate}
							min={0}
							max={1}
							step={0.1}
							onChange={setFailRate}
						/>
						<NumberRow
							label="Client timeout (ms)"
							value={timeout}
							min={100}
							max={10000}
							step={100}
							onChange={setTimeoutMs}
						/>
					</div>
					<Button
						className="mt-4"
						onClick={() => send(delay, failRate, timeout)}
					>
						Emit ack:echo
					</Button>
					<p className="mt-3 text-xs text-zinc-500">
						Try delay = 3000 with timeout = 1000. The promise resolves with a
						timeout error before the server ever responds.
					</p>
				</div>

				<div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
							Recent calls
						</h3>
						<span className="text-xs text-zinc-500">{results.length}</span>
					</div>
					<div className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-xs">
						{results.length === 0 ? (
							<p className="py-6 text-center text-zinc-500">No requests yet.</p>
						) : (
							results.map((r) => (
								<div
									key={r.id}
									className="flex items-center gap-2 rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900"
								>
									<StatusBadge status={r.status} />
									<span className="text-zinc-600 dark:text-zinc-300">
										delay {r.delayMs}ms · fail {Math.round(r.failRate * 100)}% ·
										timeout {r.timeoutMs}ms
									</span>
									<span className="ml-auto font-mono text-zinc-500">
										{r.latencyMs != null ? `${r.latencyMs}ms` : '…'}
									</span>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</DemoPage>
	);
}

function NumberRow({
	label,
	value,
	onChange,
	min,
	max,
	step,
}: {
	label: string;
	value: number;
	onChange: (n: number) => void;
	min: number;
	max: number;
	step: number;
}) {
	return (
		<label className="flex items-center justify-between gap-3">
			<span className="text-zinc-600 dark:text-zinc-400">{label}</span>
			<input
				type="number"
				value={value}
				min={min}
				max={max}
				step={step}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right font-mono dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
			/>
		</label>
	);
}

function StatusBadge({ status }: { status: 'pending' | 'ok' | 'error' | 'timeout' }) {
	const styles: Record<string, string> = {
		pending: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
		ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
		error: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
		timeout: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
	};
	return (
		<span
			className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${styles[status]}`}
		>
			{status}
		</span>
	);
}
