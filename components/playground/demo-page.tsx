'use client';

import { type ReactNode } from 'react';

export function DemoPage({
	title,
	subtitle,
	concepts,
	source,
	children,
}: {
	title: string;
	subtitle: string;
	concepts: { name: string; detail: string }[];
	source: { server?: string; client?: string; hook?: string; component?: string };
	children: ReactNode;
}) {
	const sourceFiles = Object.entries(source).filter(([, v]) => v) as Array<
		[string, string]
	>;

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 p-6">
			<header className="space-y-2">
				<h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
					{title}
				</h1>
				<p className="text-zinc-600 dark:text-zinc-400">{subtitle}</p>
			</header>

			<section className="grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
					<h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
						Concepts
					</h2>
					<ul className="space-y-2 text-sm">
						{concepts.map((c) => (
							<li key={c.name}>
								<span className="font-medium text-zinc-900 dark:text-zinc-100">
									{c.name}
								</span>
								<span className="text-zinc-600 dark:text-zinc-400"> — {c.detail}</span>
							</li>
						))}
					</ul>
				</div>
				<div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
					<h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
						Source files
					</h2>
					<ul className="space-y-1 font-mono text-xs">
						{sourceFiles.map(([role, path]) => (
							<li key={role} className="flex items-baseline gap-2">
								<span className="w-16 text-zinc-500">{role}</span>
								<span className="text-zinc-900 dark:text-zinc-100">{path}</span>
							</li>
						))}
					</ul>
					<p className="mt-3 text-[11px] text-zinc-500">
						Open the inspector (bottom-right) to see live wire traffic.
					</p>
				</div>
			</section>

			<section>{children}</section>
		</div>
	);
}
