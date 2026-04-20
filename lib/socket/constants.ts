export const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_SERVER_URL ?? "http://localhost:3001";

export const AuctionEvents = {
  SERVER: {
    BID_NEW: "auction:bid:new",
    BID_ACCEPTED: "auction:bid:accepted",
    BID_REJECTED: "auction:bid:rejected",
    UPDATED: "auction:updated",
    ENDED: "auction:ended",
    STARTED: "auction:started",
    TIME_LEFT: "auction:time-left",
    PARTICIPANTS: "auction:participants",
    OUTBID: "auction:outbid",
    ERROR: "auction:error",
    HISTORY: "auction:history",
  },
  CLIENT: {
    JOIN: "auction:join",
    LEAVE: "auction:leave",
    BID: "auction:bid",
    GET_HISTORY: "auction:get-history",
  },
} as const;
