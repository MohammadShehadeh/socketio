import { Server, Socket } from 'socket.io';
import {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from '../types';
import * as store from './store';

type TypedServer = Server<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>;
type TypedSocket = Socket<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>;

const timers = new Map<string, NodeJS.Timeout>();

export function registerAuctionHandlers(io: TypedServer, socket: TypedSocket) {
	const userId = socket.data.userId;
	const userName = socket.data.userName;

	socket.on('auction:join', (auctionId) => {
		const auction = store.getAuction(auctionId);
		if (!auction) {
			socket.emit('auction:error', `Auction ${auctionId} not found`);
			return;
		}

		socket.join(`auction:${auctionId}`);
		socket.data.currentAuction = auctionId;

		socket.emit('auction:updated', auction);
		socket.emit('auction:history', store.getBidsForAuction(auctionId));

		const room = io.sockets.adapter.rooms.get(`auction:${auctionId}`);
		const count = room?.size ?? 0;
		io.to(`auction:${auctionId}`).emit('auction:participants', {
			auctionId,
			count,
		});
	});

	socket.on('auction:leave', (auctionId) => {
		socket.leave(`auction:${auctionId}`);
		socket.data.currentAuction = null;

		const room = io.sockets.adapter.rooms.get(`auction:${auctionId}`);
		const count = room?.size ?? 0;
		io.to(`auction:${auctionId}`).emit('auction:participants', {
			auctionId,
			count,
		});
	});

	socket.on('auction:bid', ({ auctionId, amount }, ack) => {
		const result = store.placeBid(auctionId, userId, userName, amount);

		if (!result.success) {
			socket.emit('auction:bid:rejected', result.error!);
			ack?.({ success: false, error: result.error });
			return;
		}

		const bid = result.bid!;

		ack?.({ success: true });

		socket.emit('auction:bid:accepted', bid);

		socket.to(`auction:${auctionId}`).emit('auction:bid:new', bid);

		const auction = store.getAuction(auctionId)!;
		io.to(`auction:${auctionId}`).emit('auction:updated', auction);

		if (result.previousWinnerId && result.previousWinnerId !== userId) {
			const sockets = getSocketsInRoom(io, `auction:${auctionId}`);
			for (const s of sockets) {
				if (s.data.userId === result.previousWinnerId) {
					s.emit('auction:outbid', {
						auctionId,
						newHighestBid: amount,
						bidderName: userName,
					});
				}
			}
		}
	});

	socket.on('auction:get-history', (auctionId) => {
		socket.emit('auction:history', store.getBidsForAuction(auctionId));
	});
}

function getSocketsInRoom(io: TypedServer, room: string): TypedSocket[] {
	const sockets: TypedSocket[] = [];
	const roomSockets = io.sockets.adapter.rooms.get(room);
	if (!roomSockets) return sockets;
	for (const id of roomSockets) {
		const s = io.sockets.sockets.get(id) as TypedSocket | undefined;
		if (s) sockets.push(s);
	}
	return sockets;
}

export function scheduleAuctionTimers(io: TypedServer) {
	const auctions = store.getAllAuctions();

	for (const auction of auctions) {
		if (!auction.isActive) continue;
		scheduleOne(io, auction.id, auction.endTime);
	}
}

function scheduleOne(io: TypedServer, auctionId: string, endTime: number) {
	if (timers.has(auctionId)) return;

	const now = Date.now();
	const timeLeft = endTime - now;

	if (timeLeft <= 0) {
		endAuction(io, auctionId);
		return;
	}

	const countdownTimer = setInterval(() => {
		const remaining = Math.max(0, endTime - Date.now());
		if (remaining <= 0) {
			clearInterval(countdownTimer);
			timers.delete(auctionId);
			endAuction(io, auctionId);
			return;
		}
		io.to(`auction:${auctionId}`).emit('auction:time-left', {
			auctionId,
			timeLeft: remaining,
		});
	}, 1000);

	timers.set(auctionId, countdownTimer);
}

function endAuction(io: TypedServer, auctionId: string) {
	const ended = store.endAuction(auctionId);
	if (ended) {
		io.to(`auction:${auctionId}`).emit('auction:ended', ended);
	}
}
