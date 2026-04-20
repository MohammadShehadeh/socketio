export interface AuctionItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  startingPrice: number;
  currentPrice: number;
  currency: string;
  endTime: number;
  isActive: boolean;
  sellerId: string;
  winnerId: string | null;
  minBidIncrement: number;
}

export interface Bid {
  id: string;
  auctionId: string;
  userId: string;
  userName: string;
  amount: number;
  timestamp: number;
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface AuctionState {
  auction: AuctionItem | null;
  bids: Bid[];
  participantCount: number;
  timeLeft: number;
  isConnected: ConnectionState;
  lastError: string | null;
}
