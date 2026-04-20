"use client";

import { use } from "react";
import { AuctionPage } from "@/components/auction/auction-page";

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AuctionPage auctionId={id} />;
}
