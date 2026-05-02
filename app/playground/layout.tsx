import { PlaygroundShell } from '@/components/playground/playground-shell';

export default function PlaygroundLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <PlaygroundShell>{children}</PlaygroundShell>;
}
