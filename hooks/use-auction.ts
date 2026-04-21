"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  joinAuction,
  leaveAuction,
  placeBid,
  onAuctionUpdated,
  onBidHistory,
  onNewBid,
  onParticipants,
  onTimeLeft,
  onAuctionEnded,
  onBidAccepted,
  onBidRejected,
  onOutbid,
  onError,
} from "@/lib/socket/client";
import type { AuctionState } from "@/lib/socket/types";

const initialState: AuctionState = {
  auction: null,
  bids: [],
  participantCount: 0,
  timeLeft: 0,
  isConnected: "disconnected",
  lastError: null,
};

export function useAuction(auctionId: string | null) {
  const [state, setState] = useState<AuctionState>(initialState);
  const mountedRef = useRef(true);
  const previousAuctionRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    if (!auctionId) return;

    if (previousAuctionRef.current && previousAuctionRef.current !== auctionId) {
      leaveAuction(previousAuctionRef.current);
    }
    previousAuctionRef.current = auctionId;

    joinAuction(auctionId);

    const cleanups = [
      onAuctionUpdated((auction) => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, auction }));
        }
      }),
      onBidHistory((bids) => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, bids }));
        }
      }),
      onNewBid((bid) => {
        if (mountedRef.current) {
          setState((prev) => {
            if (prev.bids.some((b) => b.id === bid.id)) return prev;
            return { ...prev, bids: [...prev.bids, bid] };
          });
        }
      }),
      onParticipants(({ count }) => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, participantCount: count }));
        }
      }),
      onTimeLeft(({ timeLeft }) => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, timeLeft }));
        }
      }),
      onAuctionEnded((auction) => {
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            auction,
            timeLeft: 0,
          }));
        }
      }),
      onBidAccepted((bid) => {
        if (mountedRef.current) {
          setState((prev) => {
            if (prev.bids.some((b) => b.id === bid.id)) return prev;
            return { ...prev, lastError: null, bids: [...prev.bids, bid] };
          });
        }
      }),
      onBidRejected((reason) => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, lastError: reason }));
        }
      }),
      onOutbid(({ newHighestBid, bidderName }) => {
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            lastError: `You've been outbid by ${bidderName} at $${newHighestBid}`,
          }));
        }
      }),
      onError((message) => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, lastError: message }));
        }
      }),
    ];

    return () => {
      mountedRef.current = false;
      for (const cleanup of cleanups) cleanup();
      if (auctionId) {
        leaveAuction(auctionId);
      }
    };
  }, [auctionId]);

  const bid = useCallback(
    (amount: number) => {
      if (!auctionId) return;
      setState((prev) => ({ ...prev, lastError: null }));
      placeBid(auctionId, amount, (response) => {
        if (!response.success && mountedRef.current) {
          setState((prev) => ({ ...prev, lastError: response.error ?? "Bid failed" }));
        }
      });
    },
    [auctionId]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, lastError: null }));
  }, []);

  return {
    ...state,
    bid,
    clearError,
  };
}
