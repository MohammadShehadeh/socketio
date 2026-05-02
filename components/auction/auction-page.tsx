"use client";

import Link from "next/link";
import { useSocketConnection } from "@/hooks";
import { AuctionRoom } from "@/components/auction/auction-room";
import { useAuth } from "@/lib/auth/auth-context";
import { logoutAction } from "@/lib/auth/actions";

function ConnectionBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    reconnecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-red-500",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-zinc-500">
      <span className={`size-2 rounded-full ${colors[state] ?? "bg-zinc-400"}`} />
      {state}
    </span>
  );
}

export function AuctionPage({ auctionId }: { auctionId: string }) {
  const { user } = useAuth();
  const { connectionState } = useSocketConnection(user!.id, user!.name);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            &larr; All Auctions
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Live Auction
          </h1>
          <ConnectionBadge state={connectionState} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white ${user?.avatar ?? "bg-zinc-500"}`}
            >
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{user?.name}</span>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {connectionState === "connected" ? (
        <AuctionRoom auctionId={auctionId} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 text-lg font-medium text-zinc-500">Connecting to auction...</div>
            <div className="text-sm text-zinc-400">Please wait while we establish a connection</div>
          </div>
        </div>
      )}
    </div>
  );
}
