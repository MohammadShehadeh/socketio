import { AuctionItem, Bid } from "../types";

const auctions = new Map<string, AuctionItem>();
const bids = new Map<string, Bid[]>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createAuction(
  data: Pick<
    AuctionItem,
    "title" | "description" | "imageUrl" | "startingPrice" | "endTime" | "sellerId" | "currency" | "minBidIncrement"
  >
): AuctionItem {
  const auction: AuctionItem = {
    id: generateId(),
    currentPrice: data.startingPrice,
    winnerId: null,
    isActive: true,
    ...data,
  };
  auctions.set(auction.id, auction);
  bids.set(auction.id, []);
  return auction;
}

export function getAuction(id: string): AuctionItem | undefined {
  return auctions.get(id);
}

export function getAllAuctions(): AuctionItem[] {
  return Array.from(auctions.values());
}

export function getBidsForAuction(auctionId: string): Bid[] {
  return bids.get(auctionId) ?? [];
}

export function placeBid(
  auctionId: string,
  userId: string,
  userName: string,
  amount: number
): { success: boolean; bid?: Bid; error?: string; previousWinnerId?: string | null } {
  const auction = auctions.get(auctionId);

  if (!auction) {
    return { success: false, error: "Auction not found" };
  }

  if (!auction.isActive) {
    return { success: false, error: "Auction is not active" };
  }

  if (auction.endTime <= Date.now()) {
    auction.isActive = false;
    return { success: false, error: "Auction has ended" };
  }

  if (userId === auction.sellerId) {
    return { success: false, error: "Seller cannot bid on their own auction" };
  }

  const minRequired = auction.currentPrice + auction.minBidIncrement;
  if (amount < minRequired) {
    return {
      success: false,
      error: `Bid must be at least ${auction.currency}${minRequired}`,
    };
  }

  const bid: Bid = {
    id: generateId(),
    auctionId,
    userId,
    userName,
    amount,
    timestamp: Date.now(),
  };

  const auctionBids = bids.get(auctionId) ?? [];
  const previousWinnerId = auction.winnerId;

  auctionBids.push(bid);
  bids.set(auctionId, auctionBids);
  auction.currentPrice = amount;
  auction.winnerId = userId;

  return { success: true, bid, previousWinnerId };
}

export function endAuction(auctionId: string): AuctionItem | null {
  const auction = auctions.get(auctionId);
  if (!auction) return null;
  auction.isActive = false;
  return auction;
}

export function seedAuctions(): void {
  const now = Date.now();
  createAuction({
    title: "Vintage Rolex Submariner 1969",
    description: "A rare vintage Rolex Submariner from 1969 in excellent condition with original box and papers.",
    imageUrl: "/watches/rolex-1969.jpg",
    startingPrice: 5000,
    currency: "$",
    endTime: now + 30 * 60 * 1000,
    sellerId: "seller-1",
    minBidIncrement: 100,
  });
  createAuction({
    title: "Original Banksy 'Girl with Balloon' Print",
    description: "Authenticated Banksy screen print, numbered and signed. Certificate of authenticity included.",
    imageUrl: "/art/banksy-balloon.jpg",
    startingPrice: 25000,
    currency: "$",
    endTime: now + 60 * 60 * 1000,
    sellerId: "seller-2",
    minBidIncrement: 500,
  });
  createAuction({
    title: "1967 Ford Mustang Shelby GT500",
    description: "Fully restored 1967 Shelby GT500 in Nightmist Blue. Matching numbers, concours quality.",
    imageUrl: "/cars/mustang-shelby.jpg",
    startingPrice: 120000,
    currency: "$",
    endTime: now + 2 * 60 * 60 * 1000,
    sellerId: "seller-3",
    minBidIncrement: 1000,
  });
}
