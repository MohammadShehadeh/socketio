'use client';

import { usePresence } from '@/hooks';
import { useAuth } from '@/lib/auth/auth-context';
import { DemoPage } from '@/components/playground/demo-page';

export default function PresenceDemoPage() {
	const { user } = useAuth();
	const users = usePresence();

	return (
		<DemoPage
			title="Presence"
			subtitle="Who is online right now. The server tracks one entry per user — multiple tabs from the same person count once."
			concepts={[
				{
					name: 'Stable identity',
					detail:
						'Presence keys on userId, not socketId. A user with three tabs appears once.',
				},
				{
					name: 'Ref-counted lifecycle',
					detail:
						'Each new socket increments a ref-count; we only emit "left" when the last one disconnects.',
				},
				{
					name: 'Snapshot + delta',
					detail:
						'New joiners get the full list once (presence:list); everyone else gets join/leave deltas.',
				},
			]}
			source={{
				server: 'server/playground/handler.ts (registerPresence) + store.ts',
				hook: 'hooks/use-presence.ts',
				component: 'app/playground/presence/page.tsx',
			}}
		>
			<div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
						Online ({users.length})
					</h3>
					<p className="text-xs text-zinc-500">
						Open another browser to see them join.
					</p>
				</div>

				{users.length === 0 ? (
					<p className="py-10 text-center text-sm text-zinc-500">
						Hooking up… you should appear here in a moment.
					</p>
				) : (
					<ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{users.map((u) => {
							const isMe = u.userId === user!.id;
							return (
								<li
									key={u.userId}
									className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
								>
									<div
										className="flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white"
										style={{ backgroundColor: u.color }}
									>
										{u.userName.charAt(0).toUpperCase()}
									</div>
									<div className="flex-1">
										<div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
											{u.userName}
											{isMe && (
												<span className="ml-2 text-xs text-zinc-500">
													(you)
												</span>
											)}
										</div>
										<div className="font-mono text-[10px] text-zinc-500">
											joined {new Date(u.joinedAt).toLocaleTimeString()}
										</div>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</DemoPage>
	);
}
