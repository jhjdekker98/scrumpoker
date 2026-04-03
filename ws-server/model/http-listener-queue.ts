import { Listener } from "../interfaces";

export class HttpListenerQueue implements Listener {
    readonly _capnp_target = true; // Mark as RpcTarget
    private queue: Array<{ method: string; args: any[] }> = [];
    lastSeen = Date.now();

    // Implement the Listener interface by queuing calls
    async onUserJoined(username: string) { this.enqueue("onUserJoined", [username]); }
    async onUserLeft(username: string) { this.enqueue("onUserLeft", [username]); }
    async onIssueChanged(issue: string) { this.enqueue("onIssueChanged", [issue]); }
    async onUserChoseCard(username: string, card: string) { this.enqueue("onUserChoseCard", [username, card]); }

    private enqueue(method: string, args: any[]) {
        this.queue.push({ method, args });
        // Limit queue size to prevent memory leaks if a client abandons the session
        if (this.queue.length > 100) this.queue.shift();
    }

    flush() {
        const messages = [...this.queue];
        this.queue = [];
        this.lastSeen = Date.now();
        return messages;
    }

    get size() {
        return this.queue.length;
    }

    __RPC_TARGET_BRAND: never;
}