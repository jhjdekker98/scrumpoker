import {RpcTarget} from "capnweb";
import {Listener} from "../../ws-server/interfaces";
import {ListenerHandlers} from "./ListenerHandlers";

export class ListenerImpl extends RpcTarget implements Listener {
    private readonly handlers: ListenerHandlers;

    constructor(handlers: ListenerHandlers) {
        super();
        this.handlers = handlers;
    }

    async onIssueChanged(issue: string): Promise<void> {
        this.handlers.onIssueChanged(issue);
    }

    async onUserJoined(username: string): Promise<void> {
        this.handlers.onUserJoined(username);
    }

    async onUserLeft(username: string): Promise<void> {
        this.handlers.onUserLeft(username);
    }

    async onUserChoseCard(username: string, card: string): Promise<void> {
        this.handlers.onUserChoseCard(username, card);
    }
}
