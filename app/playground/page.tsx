'use client';

import Link from 'next/link';
import { DEMOS } from '@/components/playground/playground-shell';

export default function PlaygroundHome() {
	const demos = DEMOS.filter((d) => d.href !== '/playground');

	return (
		<div className="mx-auto w-full max-w-5xl space-y-8 p-6">
			<header className="space-y-3">
				<h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
					Socket.IO Playground
				</h1>
				<p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
					Each demo isolates one Socket.IO concept end-to-end — the server
					handler, the client emitter, the React hook, and the UI. Open multiple
					tabs to feel the realtime behavior, then read the source.
				</p>
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
					<strong>Tip:</strong> open this page in two browser tabs (or two
					browsers) so you can watch events flow between clients.
				</div>
			</header>

			<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{demos.map((d) => (
					<Link
						key={d.href}
						href={d.href}
						className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
					>
						<div className="text-2xl">{d.icon}</div>
						<h2 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-50">
							{d.title}
						</h2>
						<p className="mt-1 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
							{d.blurb}
						</p>
						<span className="mt-4 text-xs text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
							Open demo →
						</span>
					</Link>
				))}
			</section>

			<section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
				<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
					How this is laid out
				</h2>
				<ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
					<li>
						<strong className="text-zinc-900 dark:text-zinc-100">Server</strong>{' '}
						— [server/playground/](server/playground/) (separate Socket.IO
						namespace from the auction app)
					</li>
					<li>
						<strong className="text-zinc-900 dark:text-zinc-100">Client</strong>{' '}
						— [lib/playground/client.ts](lib/playground/client.ts) (ref-counted
						singleton with built-in instrumentation)
					</li>
					<li>
						<strong className="text-zinc-900 dark:text-zinc-100">Hooks</strong>{' '}
						— [hooks/](hooks/) (one hook per demo)
					</li>
					<li>
						<strong className="text-zinc-900 dark:text-zinc-100">UI</strong> —
						[app/playground/](app/playground/)
					</li>
				</ul>
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					The auction app on the home page is the &ldquo;real world&rdquo;
					feature; the playground is the dissection table.
				</p>
			</section>
		</div>
	);
}
