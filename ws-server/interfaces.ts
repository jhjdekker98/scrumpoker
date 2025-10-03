import {RpcTarget} from "capnweb";
import {Room} from "./model/room";

export interface Listener extends RpcTarget {
    onMessage(msg: string): Promise<void>;
}

// Interface for the API below
export interface ScrumPokerApi {
    createRoom(roomName: string, cards: string[], listener: Listener, roomPass?: string): number;
    joinRoom(roomId: number, username: string, listener: Listener, roomPass?: string): string;
    leaveRoom(roomId: number, authToken: string): void;
}

// The API exposed by the server
export class ScrumPokerApiImpl extends RpcTarget implements ScrumPokerApi {
    private static readonly ROOM_ID_MAX = 9999;
    private static readonly ADMIN_NAME = "Admin";
    private readonly rooms: Map<number, Room> = new Map<number, Room>();

    private async broadcastMessage(room: Room, msg: string) {
        await Promise.all(
            [...room.listeners.values()].map(listener =>
                listener.onMessage(msg).catch(err => console.error(err))
            )
        );
    }

    createRoom(roomName: string, cards: string[], listener: Listener, roomPass?: string): number {
        let roomId;
        do {
            roomId = Math.floor(Math.random() * (ScrumPokerApiImpl.ROOM_ID_MAX + 1));
        } while (this.rooms.has(roomId));
        const room: Room = {
            roomId,
            roomName,
            cards,
            roomPass,
            listeners: new Map<string, Listener>(),
            users: new Map()
        };

        const token = this.generateToken();
        room.users.set(token, ScrumPokerApiImpl.ADMIN_NAME);
        room.listeners.set(token, (listener as any).dup());

        this.rooms.set(roomId, room);
        return roomId;
    }

    joinRoom(roomId: number, username: string, listener: Listener, roomPass?: string): string {
        const room = this.rooms.get(roomId);
        if (!room || (room.roomPass && room.roomPass !== roomPass)) throw new Error("Room not found");

        const token = this.generateToken();
        room.users.set(token, username);
        room.listeners.set(token, (listener as any).dup());

        this.broadcastMessage(room, "user '" + username + "' joined the Room.");
        return token;
    }

    leaveRoom(roomId: number, authToken: string): void {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error("Room not found");

        const username = room.users.get(authToken);
        if (!username) throw new Error("Invalid token");

        room.users.delete(authToken);
        room.listeners.delete(authToken);

        this.broadcastMessage(room, "user '" + username + "' left the Room.");
    }

    connClosed(ws: WebSocket): void {
        // TODO: Find user associated with this WebSocket
        //  then get that user's room and authToken
        //  then call leaveRoom with that user's room and authToken
    }

    private generateToken(): string {
        // TODO: More secure way of generating token
        return Math.random().toString(36).substring(2, 12);
    }
}
