'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@/hooks';
import { useAuth } from '@/lib/auth/auth-context';
import { DemoPage } from '@/components/playground/demo-page';
import { Button } from '@/components/ui/button';

const ROOMS = ['general', 'random', 'tech'];
const TYPING_THROTTLE_MS = 800;

export default function ChatDemoPage() {
	const { user } = useAuth();
	const [room, setRoom] = useState(ROOMS[0]);
	const { messages, typing, send, setIsTyping } = useChat(room, user!.id);
	const [draft, setDraft] = useState('');
	const lastTypingSentAt = useRef(0);
	const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
	}, [messages.length]);

	function handleChange(text: string) {
		setDraft(text);
		if (!text) {
			setIsTyping(false);
			lastTypingSentAt.current = 0;
			return;
		}
		const now = Date.now();
		if (now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
			lastTypingSentAt.current = now;
			setIsTyping(true);
		}
		if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
		stopTypingTimer.current = setTimeout(() => {
			setIsTyping(false);
			lastTypingSentAt.current = 0;
		}, 1500);
	}

	function handleSend() {
		const text = draft.trim();
		if (!text) return;
		send(text);
		setDraft('');
		setIsTyping(false);
		if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
	}

	return (
		<DemoPage
			title="Rooms & chat"
			subtitle="Pick a room to join. Each room is its own broadcast group on the server. Switch rooms — your client leaves the old one and only receives messages for the new one."
			concepts={[
				{
					name: 'socket.join(room)',
					detail: 'Adds this socket to a named room. Cheap — just a Set entry on the server.',
				},
				{
					name: 'io.to(room).emit',
					detail: 'Broadcast to everyone in the room (including the sender).',
				},
				{
					name: 'socket.to(room).emit',
					detail:
						'Broadcast to everyone in the room except the sender — used here for typing.',
				},
				{
					name: 'Typing indicator',
					detail:
						'Throttled emit on keystroke; auto-clears after silence. Server forwards only to others.',
				},
			]}
			source={{
				server: 'server/playground/handler.ts (registerChat)',
				hook: 'hooks/use-chat.ts',
				component: 'app/playground/chat/page.tsx',
			}}
		>
			<div className="space-y-4">
				<div className="flex flex-wrap gap-2">
					{ROOMS.map((r) => (
						<button
							key={r}
							onClick={() => setRoom(r)}
							className={`rounded-full border px-3 py-1 text-sm transition-colors ${
								r === room
									? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
									: 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
							}`}
						>
							#{r}
						</button>
					))}
				</div>

				<div className="flex h-[60vh] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
					<div
						ref={scrollRef}
						className="flex-1 space-y-2 overflow-y-auto p-4"
					>
						{messages.length === 0 ? (
							<p className="py-10 text-center text-sm text-zinc-500">
								No messages yet in #{room}. Say hi.
							</p>
						) : (
							messages.map((m) => {
								const isMine = m.userId === user!.id;
								return (
									<div
										key={m.id}
										className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
									>
										<div
											className={`max-w-[70%] rounded-2xl px-3 py-1.5 text-sm ${
												isMine
													? 'bg-blue-600 text-white'
													: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
											}`}
										>
											{!isMine && (
												<div className="text-[11px] font-semibold opacity-70">
													{m.userName}
												</div>
											)}
											<div>{m.text}</div>
											<div className="mt-0.5 text-[10px] opacity-60">
												{new Date(m.timestamp).toLocaleTimeString()}
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>
					<div className="h-5 px-4 text-xs italic text-zinc-500">
						{typing.length > 0
							? `${typing.join(', ')} ${typing.length === 1 ? 'is' : 'are'} typing…`
							: ''}
					</div>
					<div className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
						<input
							value={draft}
							onChange={(e) => handleChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleSend();
								}
							}}
							placeholder={`Message #${room}`}
							maxLength={500}
							className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
						<Button onClick={handleSend} disabled={!draft.trim()}>
							Send
						</Button>
					</div>
				</div>
			</div>
		</DemoPage>
	);
}
