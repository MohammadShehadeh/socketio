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

export interface AuctionRoom {
  auctionId: string;
  participants: Set<string>;
}

export interface BidAck {
  success: boolean;
  error?: string;
}

export interface ServerToClientEvents {
  "auction:bid:new": (bid: Bid) => void;
  "auction:bid:accepted": (bid: Bid) => void;
  "auction:bid:rejected": (reason: string) => void;
  "auction:updated": (auction: AuctionItem) => void;
  "auction:ended": (auction: AuctionItem) => void;
  "auction:started": (auction: AuctionItem) => void;
  "auction:time-left": (data: { auctionId: string; timeLeft: number }) => void;
  "auction:participants": (data: { auctionId: string; count: number }) => void;
  "auction:outbid": (data: { auctionId: string; newHighestBid: number; bidderName: string }) => void;
  "auction:error": (message: string) => void;
  "auction:history": (bids: Bid[]) => void;
}

export interface ClientToServerEvents {
  "auction:join": (auctionId: string) => void;
  "auction:leave": (auctionId: string) => void;
  "auction:bid": (data: { auctionId: string; amount: number }, ack?: (response: BidAck) => void) => void;
  "auction:get-history": (auctionId: string) => void;
}

export type InterServerEvents = Record<string, never>;
export interface SocketData {
  userId: string;
  userName: string;
  currentAuction: string | null;
}
