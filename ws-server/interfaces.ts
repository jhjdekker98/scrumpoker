import {RpcTarget} from "capnweb";
import {Room} from "./model/room";
import {ERR_ILLEGAL_USERNAME, ERR_INVALID_CARD, ERR_INVALID_TOKEN, ERR_ROOM_NOT_FOUND} from "./model/constants";
import {BiMap} from "./util/BiMap";

export interface Listener extends RpcTarget {
    onUserJoined(username: string): Promise<void>;
    onUserLeft(username: string): Promise<void>;
    onIssueChanged(issue: string): Promise<void>;
    onUserChoseCard(username: string, card: string): Promise<void>;
}

// Interface for the API below
export interface ScrumPokerApi {
    // Init requests
    createRoom(roomName: string, cards: string[], listener: Listener, sessionId: string, roomPass?: string): {roomId: number, token: string};
    joinRoom(roomId: number, username: string, listener: Listener, sessionId: string, roomPass?: string): string;

    // Authed requests
    leaveRoom(roomId: number, authToken: string): void;
    getRoomName(roomId: number, authToken: string): string;
    getRoomCards(roomId: number, authToken: string): string[];
    getRoomUsers(roomId: number, authToken: string): string[];
    setRoomIssue(roomId: number, issue: string, authToken: string): void;
    getRoomIssue(roomId: number, authToken: string): string | undefined;
    chooseCard(roomId: number, card: string, authToken: string): void;

    // Public requests
}

interface UserInfo {
    roomId: number,
    token: string
}

// The API exposed by the server
export class ScrumPokerApiImpl extends RpcTarget implements ScrumPokerApi {
    private static readonly ROOM_ID_MAX = 9999;
    private static readonly ADMIN_NAME = "Admin";
    private readonly rooms: Map<number, Room> = new Map<number, Room>();
    private readonly sessionToWs: Map<string, string> = new Map<string, string>(); // sessionId -> wsId
    private readonly wsUserBiMap: BiMap<string, UserInfo> = new BiMap<string, UserInfo>();

    public pushWs(sessionId: string, wsId: string): void {
        this.sessionToWs.set(sessionId, wsId);
    }

    private async broadcastMessage(room: Room, method: keyof Listener, ...args: any[]) {
        await Promise.all(
            [...room.listeners.values()].map(listener =>
                (listener[method] as Function)(...args).catch(err => console.error(err))
            )
        );
    }

    createRoom(roomName: string, cards: string[], listener: Listener, sessionId: string, roomPass?: string): {roomId: number, token: string} {
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
        if (!this.sessionToWs.has(sessionId)) throw new Error("Tried to initialize user before WebSocket was registered!");
        this.wsUserBiMap.set(this.sessionToWs.get(sessionId)!, {roomId, token});

        this.rooms.set(roomId, room);
        return { roomId, token };
    }

    joinRoom(roomId: number, username: string, listener: Listener, sessionId: string, roomPass?: string): string {
        const room = this.rooms.get(roomId);
        if (!room || (room.roomPass && room.roomPass !== roomPass)) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        if (username === ScrumPokerApiImpl.ADMIN_NAME) throw new Error(ERR_ILLEGAL_USERNAME(username));

        const token = this.generateToken();
        room.users.set(token, username);
        room.listeners.set(token, (listener as any).dup());
        if (!this.sessionToWs.has(sessionId)) throw new Error("Tried to initialize user before WebSocket was registered!");
        this.wsUserBiMap.set(this.sessionToWs.get(sessionId)!, {roomId, token});

        this.broadcastMessage(room, "onUserJoined", username);
        return token;
    }

    leaveRoom(roomId: number, authToken: string): void {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(ERR_ROOM_NOT_FOUND(roomId));

        const username = room.users.get(authToken);
        if (!username) throw new Error(ERR_INVALID_TOKEN());

        room.users.delete(authToken);
        room.listeners.delete(authToken);
        const userInfo = this.wsUserBiMap.findValue((userInfo: UserInfo) => userInfo.token === authToken);
        if (!userInfo) {
            throw new Error("Could not retrieve user info from token");
        }
        this.wsUserBiMap.deleteValue(userInfo);

        if (room.users.size === 0) {
            this.rooms.delete(roomId);
        }

        this.broadcastMessage(room, "onUserLeft", username);
    }

    getRoomName(roomId: number, authToken: string): string {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        if (!room.users.has(authToken)) throw new Error(ERR_INVALID_TOKEN());
        return room.roomName;
    }

    getRoomCards(roomId: number, authToken: string): string[] {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        if (!room.users.has(authToken)) throw new Error(ERR_INVALID_TOKEN());
        return room.cards;
    }

    getRoomUsers(roomId: number, authToken: string): string[] {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        if (!room.users.has(authToken)) throw new Error(ERR_INVALID_TOKEN());
        return Array.from(room.users.values()).filter(user => user !== ScrumPokerApiImpl.ADMIN_NAME);
    }

    setRoomIssue(roomId: number, issue: string, authToken: string): void {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        if (ScrumPokerApiImpl.ADMIN_NAME !== room.users.get(authToken)) throw new Error(ERR_INVALID_TOKEN());
        room.issue = issue;
        this.broadcastMessage(room, "onIssueChanged", issue);
    }

    getRoomIssue(roomId: number, authToken: string): string | undefined {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        if (!room.users.has(authToken)) throw new Error(ERR_INVALID_TOKEN());
        return room.issue;
    }

    chooseCard(roomId: number, card: string, authToken: string): void {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        const username = room.users.get(authToken);
        if (!username) throw new Error(ERR_INVALID_TOKEN());
        if (!room.cards.includes(card)) throw new Error(ERR_INVALID_CARD(card));
        this.broadcastMessage(room, "onUserChoseCard", username, card);
    }

    connClosed(wsId: string): void {
        if (!this.wsUserBiMap.has(wsId)) throw new Error("Could not retrieve user info from WebSocket ID");
        const userInfo = this.wsUserBiMap.get(wsId)!;
        this.leaveRoom(userInfo.roomId, userInfo.token);
    }

    private generateToken(): string {
        // TODO: More secure way of generating token
        return Math.random().toString(36).substring(2, 12);
    }
}
