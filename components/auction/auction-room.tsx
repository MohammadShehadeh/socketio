"use client";

import { useAuction } from "@/hooks";
import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

function formatTime(ms: number): string {
  if (ms <= 0) return "Ended";
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

const BidItem = memo(function BidItem({
  bid,
  isHighest,
  currency,
}: {
  bid: { id: string; userName: string; amount: number; timestamp: number };
  isHighest: boolean;
  currency: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
        isHighest
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {bid.userName}
        </span>
        {isHighest && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
            Highest
          </span>
        )}
      </div>
      <div className="text-right">
        <span className="font-bold text-zinc-900 dark:text-zinc-100">
          {currency}{bid.amount.toLocaleString()}
        </span>
        <span className="ml-2 text-xs text-zinc-500">
          {new Date(bid.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
});

export function AuctionRoom({ auctionId }: { auctionId: string }) {
  const { auction, bids, participantCount, timeLeft, lastError, bid, clearError } =
    useAuction(auctionId);
  const [bidAmount, setBidAmount] = useState("");

  const handleBid = useCallback(() => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) return;
    bid(amount);
    setBidAmount("");
  }, [bid, bidAmount]);

  const minBid = auction ? auction.currentPrice + auction.minBidIncrement : 0;

  const reversedBids = useMemo(() => [...bids].reverse(), [bids]);

  if (!auction) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-zinc-500">Loading auction...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {auction.title}
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {auction.description}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {auction.currency}{auction.currentPrice.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            {auction.isActive ? (
              <span className="font-medium text-orange-500">
                {timeLeft > 0 ? formatTime(timeLeft) : "Ending soon..."}
              </span>
            ) : (
              <span className="font-medium text-red-500">Ended</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-zinc-500">
        <span>Starting: {auction.currency}{auction.startingPrice.toLocaleString()}</span>
        <span>Min increment: {auction.currency}{auction.minBidIncrement}</span>
        <span>{participantCount} watching</span>
      </div>

      {lastError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          <span>{lastError}</span>
          <button onClick={clearError} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {auction.isActive && (
        <div className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <input
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`Min: ${auction.currency}${minBid.toLocaleString()}`}
            min={minBid}
            step={auction.minBidIncrement}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBid();
            }}
          />
          <Button onClick={handleBid} disabled={!bidAmount}>
            Place Bid
          </Button>
          <Button
            variant="outline"
            onClick={() => setBidAmount(String(minBid))}
          >
            {auction.currency}{minBid.toLocaleString()}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Bid History ({bids.length})
        </h2>
        {bids.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No bids yet. Be the first!</p>
        ) : (
          <div className="space-y-2">
            {reversedBids.map((b, i) => (
              <BidItem key={b.id} bid={b} isHighest={i === 0} currency={auction.currency} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
