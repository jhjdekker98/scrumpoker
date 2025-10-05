import {Listener} from "../interfaces";

export interface Room {
    roomId: number;
    roomName: string;
    cards: string[];
    roomPass?: string;
    issue?: string;
    listeners: Map<string, Listener>; // authToken -> Listener
    users: Map<string, string>; // authToken -> username
}
