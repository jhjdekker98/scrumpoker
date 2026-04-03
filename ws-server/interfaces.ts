import {RpcTarget} from "capnweb";
import {Room} from "./model/room";
import {ERR_ILLEGAL_USERNAME, ERR_INVALID_CARD, ERR_INVALID_TOKEN, ERR_ROOM_NOT_FOUND} from "./model/constants";
import {HttpListenerQueue} from "./model/http-listener-queue";

export interface Listener extends RpcTarget {
    onUserJoined(username: string): Promise<void>;
    onUserLeft(username: string): Promise<void>;
    onIssueChanged(issue: string): Promise<void>;
    onUserChoseCard(username: string, card: string): Promise<void>;
}

// Interface for the API below
export interface ScrumPokerApi {
    // Init requests
    ping(): void;
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
    pollEvents(sessionId: string): Promise<Array<{method: string, args: any[]}>>;
}

interface UserInfo {
    token: string,
    roomId: number,
    transport: 'ws' | 'http',
    wsId?: string,
    lastSeen: number
}

// The API exposed by the server
export class ScrumPokerApiImpl extends RpcTarget implements ScrumPokerApi {
    private static readonly ROOM_ID_MAX = 9999;
    public static readonly ADMIN_NAME = "Admin";
    private static readonly HTTP_TIMEOUT = 30000;
    private static readonly HTTP_REAP_INTERVAL = 10000;
    private readonly rooms: Map<number, Room> = new Map<number, Room>();
    private readonly sessionRegistry = new Map<string, UserInfo>();
    private readonly httpListeners: Map<string, HttpListenerQueue> = new Map<string, HttpListenerQueue>();

    constructor() {
        super();
        setInterval(() => this.reapStaleHttpSessions(), ScrumPokerApiImpl.HTTP_REAP_INTERVAL);
    }

    public pushWs(sessionId: string, wsId: string): void {
        const existing = this.sessionRegistry.get(sessionId);
        this.sessionRegistry.set(sessionId, {
            token: existing?.token || "",
            roomId: existing?.roomId || -1,
            transport: 'ws',
            wsId,
            lastSeen: Date.now()
        });
    }

    public pushHttp(sessionId: string, _httpId: string): void {
        const existing = this.sessionRegistry.get(sessionId);

        // This must be authoritative to resolve race conditions where a
        //  failed/parallel WS connection attempt sets the state to 'ws'
        //  right before an HTTP RPC call arrives.
        this.sessionRegistry.set(sessionId, {
            token: existing?.token || "",
            roomId: existing?.roomId || -1,
            transport: 'http',
            lastSeen: Date.now()
        });

        if (!this.httpListeners.has(sessionId)) {
            this.httpListeners.set(sessionId, new HttpListenerQueue());
        }
    }

    private async broadcastMessage(room: Room, method: keyof Listener, ...args: any[]) {
        const listenerEntries = Array.from(room.listeners.entries());
        console.log(`[BROADCAST] Room: ${room.roomId} | Method: ${method} | Listeners: ${listenerEntries.length}`);

        for (const [token, listener] of listenerEntries) {
            try {
                const l = listener as any;
                // Detect if listener is a local HTTP queue or a Cap'n Proto WS proxy
                const isHttp = l._capnp_target === true && typeof l.flush === 'function';

                if (typeof l[method] === 'function') {
                    const result = l[method](...args);
                    if (isHttp) {
                        console.log(`[HTTP_PUSH] Room: ${room.roomId} | Token: ${token.substring(0,4)} | Queue: ${l.size}`);
                    }
                    if (result instanceof Promise) {
                        await result.catch(e => console.error(`[ERR_WS_EXEC] ${e}`));
                    }
                }
            } catch (err) {
                console.error(`[ERR_BROADCAST] Token: ${token} |`, err);
            }
        }
    }

    ping(): void {
        console.log("[DEBUG] Pong");
    }

    createRoom(roomName: string, cards: string[], listener: Listener, sessionId: string, roomPass?: string) {
        const roomId = this.generateUniqueRoomId();
        const token = this.generateToken();

        const room: Room = {
            roomId, roomName, cards, roomPass,
            listeners: new Map(),
            users: new Map()
        };
        room.users.set(token, ScrumPokerApiImpl.ADMIN_NAME);

        this.registerUserTransport(sessionId, roomId, token, listener, room);
        this.rooms.set(roomId, room);

        console.log(`[ROOM_CREATE] ID: ${room.roomId} | SID: ${sessionId} | Token: ${token}`);
        return { roomId, token };
    }

    joinRoom(roomId: number, username: string, listener: Listener, sessionId: string, roomPass?: string): string {
        const room = this.rooms.get(roomId);
        if (!room || (room.roomPass && room.roomPass !== roomPass)) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        if (username === ScrumPokerApiImpl.ADMIN_NAME) throw new Error(ERR_ILLEGAL_USERNAME(username));

        const token = this.generateToken();
        room.users.set(token, username);

        this.registerUserTransport(sessionId, roomId, token, listener, room);
        this.broadcastMessage(room, "onUserJoined", username);

        console.log(`[ROOM_JOIN] ID: ${room.roomId} | User: ${username} | Token: ${token}`);
        return token;
    }

    leaveRoom(roomId: number, authToken: string): void {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const username = room.users.get(authToken);
        if (!username) return;

        const isAdminLeaving = (username === ScrumPokerApiImpl.ADMIN_NAME);

        room.users.delete(authToken);
        room.listeners.delete(authToken);
        this.cleanupSessionByToken(authToken);
        this.broadcastMessage(room, "onUserLeft", username);

        if (isAdminLeaving || room.users.size === 0) {
            console.log(`[ROOM_CLEANUP] ID: ${roomId} | Reason: ${isAdminLeaving ? 'Admin Left' : 'Empty'}`);
            if (isAdminLeaving) {
                for (const [sid, state] of this.sessionRegistry.entries()) {
                    if (state.roomId === roomId) {
                        this.httpListeners.delete(sid);
                        this.sessionRegistry.delete(sid);
                    }
                }
            }
            this.rooms.delete(roomId);
        }
    }

    // Standard getters (Cleaned up redundant logic)
    private getValidatedRoom(roomId: number, authToken: string): Room {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error(ERR_ROOM_NOT_FOUND(roomId));
        if (!room.users.has(authToken)) throw new Error(ERR_INVALID_TOKEN());
        return room;
    }

    getRoomName(roomId: number, authToken: string): string {
        return this.getValidatedRoom(roomId, authToken).roomName;
    }

    getRoomCards(roomId: number, authToken: string): string[] {
        return this.getValidatedRoom(roomId, authToken).cards;
    }

    getRoomUsers(roomId: number, authToken: string): string[] {
        const room = this.getValidatedRoom(roomId, authToken);
        return Array.from(room.users.values()).filter(u => u !== ScrumPokerApiImpl.ADMIN_NAME);
    }

    setRoomIssue(roomId: number, issue: string, authToken: string): void {
        const room = this.getValidatedRoom(roomId, authToken);
        if (ScrumPokerApiImpl.ADMIN_NAME !== room.users.get(authToken)) throw new Error(ERR_INVALID_TOKEN());
        room.issue = issue;
        this.broadcastMessage(room, "onIssueChanged", issue);
        console.log(`[ISSUE_CHANGE] Room: ${roomId} | Issue: ${issue}`);
    }

    getRoomIssue(roomId: number, authToken: string): string | undefined {
        return this.getValidatedRoom(roomId, authToken).issue;
    }

    chooseCard(roomId: number, card: string, authToken: string): void {
        const room = this.getValidatedRoom(roomId, authToken);
        const username = room.users.get(authToken)!;
        if (!room.cards.includes(card)) throw new Error(ERR_INVALID_CARD(card));
        this.broadcastMessage(room, "onUserChoseCard", username, card);
    }

    connClosed(wsId: string): void {
        const sessionEntry = [...this.sessionRegistry.entries()]
            .find(([_, state]) => state.wsId === wsId);

        if (sessionEntry) {
            this.leaveRoom(sessionEntry[1].roomId, sessionEntry[1].token);
        }
    }

    async pollEvents(sessionId: string): Promise<Array<{method: string, args: any[]}>> {
        const state = this.sessionRegistry.get(sessionId);
        if (!state) return [];

        state.lastSeen = Date.now();
        let queue = this.httpListeners.get(sessionId);

        if (!queue) {
            queue = new HttpListenerQueue();
            this.httpListeners.set(sessionId, queue);
        }

        const messages = queue.flush();
        if (messages.length > 0) {
            console.log(`[POLL_SEND] SID: ${sessionId} | Count: ${messages.length}`);
        }
        return messages;
    }

    private generateToken(): string {
        // TODO: More secure way of generating token
        return Math.random().toString(36).substring(2, 12);
    }

    private reapStaleHttpSessions() {
        const now = Date.now();
        for (const [sessionId, state] of this.sessionRegistry.entries()) {
            if (state.transport === 'http' && (now - state.lastSeen) > ScrumPokerApiImpl.HTTP_TIMEOUT) {
                console.log(`[REAPER] Reaping SID: ${sessionId}`);
                this.leaveRoom(state.roomId, state.token);
                this.httpListeners.delete(sessionId);
                this.sessionRegistry.delete(sessionId);
            }
        }
    }

    private registerUserTransport(sessionId: string, roomId: number, token: string, listener: Listener, room: Room) {
        const state = this.sessionRegistry.get(sessionId);

        if (!state) throw new Error("[FATAL] Register called before session setup for " + sessionId);

        if (state.transport === 'http') {
            const queue = this.httpListeners.get(sessionId) || new HttpListenerQueue();
            this.httpListeners.set(sessionId, queue);
            room.listeners.set(token, queue);

            this.sessionRegistry.set(sessionId, {
                ...state, token, roomId,
                lastSeen: Date.now()
            });
            console.log(`[REG_HTTP] Room: ${roomId} | SID: ${sessionId}`);
        } else {
            room.listeners.set(token, (listener as any).dup());
            this.sessionRegistry.set(sessionId, {
                ...state, token, roomId,
                lastSeen: Date.now()
            });
            console.log(`[REG_WS] Room: ${roomId} | SID: ${sessionId}`);
        }
    }

    private generateUniqueRoomId(): number {
        let id;
        do { id = Math.floor(Math.random() * (ScrumPokerApiImpl.ROOM_ID_MAX + 1)); }
        while (this.rooms.has(id));
        return id;
    }

    private cleanupSessionByToken(authToken: string) {
        for (const [sid, state] of this.sessionRegistry.entries()) {
            if (state.token === authToken) {
                this.httpListeners.delete(sid);
                this.sessionRegistry.delete(sid);
                return;
            }
        }
    }
}
