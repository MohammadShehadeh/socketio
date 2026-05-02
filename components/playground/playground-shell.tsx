'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { logoutAction } from '@/lib/auth/actions';
import { usePlaygroundConnection } from '@/hooks';
import { EventInspector } from './event-inspector';

export interface DemoLink {
	href: string;
	title: string;
	blurb: string;
	icon: string;
}

export const DEMOS: DemoLink[] = [
	{
		href: '/playground',
		title: 'Overview',
		blurb: 'Pick a concept to explore.',
		icon: '🏠',
	},
	{
		href: '/playground/connection',
		title: 'Connection lifecycle',
		blurb: 'Handshake, transport, reconnect, ticks.',
		icon: '🔌',
	},
	{
		href: '/playground/scopes',
		title: 'Broadcast scopes',
		blurb: 'self vs room vs broadcast vs all.',
		icon: '📡',
	},
	{
		href: '/playground/chat',
		title: 'Rooms & chat',
		blurb: 'Multi-room chat with typing indicators.',
		icon: '💬',
	},
	{
		href: '/playground/presence',
		title: 'Presence',
		blurb: 'Who is online, ref-counted across tabs.',
		icon: '👥',
	},
	{
		href: '/playground/cursors',
		title: 'Cursor sync',
		blurb: 'Volatile high-frequency updates.',
		icon: '🖱️',
	},
	{
		href: '/playground/acks',
		title: 'Acks & timeouts',
		blurb: 'Request/response with .timeout().',
		icon: '↔️',
	},
	{
		href: '/playground/rate-limit',
		title: 'Rate limiting',
		blurb: 'Server drops events past a budget.',
		icon: '🚦',
	},
];

export function PlaygroundShell({ children }: { children: React.ReactNode }) {
	const { user } = useAuth();
	const conn = usePlaygroundConnection(user!.id, user!.name);
	const pathname = usePathname();

	return (
		<div className="flex flex-1 bg-zinc-50 dark:bg-black">
			<aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:flex">
				<div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
					<Link href="/" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
						← Auction House
					</Link>
					<h1 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
						Socket.IO Playground
					</h1>
					<p className="mt-1 text-xs text-zinc-500">
						Read each demo&rsquo;s source — every concept is one focused file.
					</p>
				</div>
				<nav className="flex-1 overflow-y-auto p-2">
					{DEMOS.map((d) => {
						const active = pathname === d.href;
						return (
							<Link
								key={d.href}
								href={d.href}
								className={`mb-0.5 flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
									active
										? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
										: 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
								}`}
							>
								<span>{d.icon}</span>
								<div className="flex-1">
									<div className="font-medium">{d.title}</div>
									<div className="text-[11px] text-zinc-500">{d.blurb}</div>
								</div>
							</Link>
						);
					})}
				</nav>
				<div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
					<ConnectionStatus state={conn.state} transport={conn.transport} onReconnect={conn.reconnect} />
				</div>
			</aside>

			<main className="flex flex-1 flex-col overflow-hidden">
				<header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
					<div className="md:hidden">
						<Link href="/playground" className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
							Playground
						</Link>
					</div>
					<div className="ml-auto flex items-center gap-3">
						<div className="hidden items-center gap-2 text-sm text-zinc-500 md:flex">
							<span
								className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white ${user?.avatar ?? 'bg-zinc-500'}`}
							>
								{user?.name?.charAt(0).toUpperCase() ?? '?'}
							</span>
							<span className="font-medium text-zinc-700 dark:text-zinc-300">
								{user?.name}
							</span>
						</div>
						<form action={logoutAction}>
							<button
								type="submit"
								className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
							>
								Sign out
							</button>
						</form>
					</div>
				</header>
				<div className="flex-1 overflow-y-auto">{children}</div>
			</main>

			<EventInspector />
		</div>
	);
}

function ConnectionStatus({
	state,
	transport,
	onReconnect,
}: {
	state: string;
	transport: string | null;
	onReconnect: () => void;
}) {
	const colors: Record<string, string> = {
		connected: 'bg-emerald-500',
		connecting: 'bg-amber-500',
		reconnecting: 'bg-amber-500 animate-pulse',
		disconnected: 'bg-rose-500',
	};
	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 text-xs">
				<span className={`size-2 rounded-full ${colors[state] ?? 'bg-zinc-400'}`} />
				<span className="font-medium text-zinc-700 dark:text-zinc-300">{state}</span>
				{transport && (
					<span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
						{transport}
					</span>
				)}
			</div>
			<button
				type="button"
				onClick={onReconnect}
				className="w-full rounded-md border border-zinc-200 bg-white py-1 text-[11px] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
			>
				Force reconnect
			</button>
		</div>
	);
}
