"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AuctionItem } from "@/lib/socket/types";
import { useAuth } from "@/lib/auth/auth-context";
import { logoutAction } from "@/lib/auth/actions";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL ?? "http://localhost:3001";

function formatTime(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function useCountdown(endTime: number, isActive: boolean) {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, endTime - Date.now())
  );

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(0);
      return;
    }

    setTimeLeft(Math.max(0, endTime - Date.now()));

    const interval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, isActive]);

  return timeLeft;
}

function AuctionCard({ auction }: { auction: AuctionItem }) {
  const timeLeft = useCountdown(auction.endTime, auction.isActive);
  const isEnded = timeLeft <= 0;
  const isUrgent = !isEnded && timeLeft <= 5 * 60 * 1000;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative flex h-40 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
        <span className="text-4xl text-zinc-300">🖼</span>
        <div
          className={`absolute top-3 right-3 rounded-md px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ${
            isEnded
              ? "bg-zinc-900/80 text-zinc-300"
              : isUrgent
                ? "animate-pulse bg-red-600 text-white"
                : "bg-black/60 text-white"
          }`}
        >
          {isEnded ? "ENDED" : formatTime(timeLeft)}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {auction.title}
        </h3>
        <p className="mt-1 flex-1 text-sm text-zinc-500 line-clamp-2">
          {auction.description}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-xs text-zinc-500">Current Bid</div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {auction.currency}{auction.currentPrice.toLocaleString()}
            </div>
          </div>
          <Button asChild size="sm">
            <a href={`/auction/${auction.id}`}>
              {auction.isActive && !isEnded ? "Bid Now" : "View"}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    fetch(`${API_URL}/api/auctions`)
      .then((r) => r.json())
      .then(setAuctions)
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Auction House
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Browse live auctions and place your bids in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold text-white ${user?.avatar ?? "bg-zinc-500"}`}
            >
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {user?.name}
            </span>
          </div>
          <form action={logoutAction}>
            <Button variant="outline" size="xs" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>

        {auctions.length === 0 && (
          <div className="py-20 text-center text-zinc-500">
            No auctions available. Start the socket server with{" "}
            <code className="rounded bg-zinc-100 px-2 py-1 text-sm dark:bg-zinc-800">
              pnpm server:dev
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
