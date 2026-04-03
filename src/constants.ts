import {newHttpBatchRpcSession, newWebSocketRpcSession, RpcStub} from "capnweb";
import {ScrumPokerApi} from "../ws-server/interfaces";
import {config} from "../envloader";

export const THEME_KEY = "selected-theme";
export type Theme = "light" | "dark";
const themes = import.meta.glob("/themes/*.scss");
const POLLING_INTERVAL = 500;

export function applyTheme(theme: Theme): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const themePath = `/themes/theme-${theme}.scss`;
        const loader = themes[themePath];
        if (loader) {
            await loader();
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem(THEME_KEY, theme);
            resolve();
        } else {
            reject(`Theme ${theme} not found`);
        }
    });
}

export async function createApiConn(sessionId: string): Promise<RpcStub<ScrumPokerApi>> {
    const url = `${config.apiUrl()}/api?s=${sessionId}`;
    const wsApi = newWebSocketRpcSession<ScrumPokerApi>(url);

    try {
        await wsApi.ping();
        return wsApi;
    } catch (e) {
        console.warn("[CONN] WebSocket failed, initializing HTTP fallback");
        return new PersistentHttpStub<ScrumPokerApi>(url, sessionId) as any;
    }
}

class PersistentHttpStub<T> {
    private isPolling = false;
    private isStopped = false;
    private activeListener: any = null;

    constructor(private url: string, private sessionId: string) {
        /* Return a Proxy so this class instance can be treated as
           a standard Cap'n Proto RPC stub by the rest of the app. */
        return new Proxy(this, {
            get: (target, prop) => {
                if (prop in target) return (target as any)[prop];
                if (typeof prop === 'symbol' || prop === 'toJSON' || prop === 'then') return undefined;

                return (...args: any[]) => target.invoke(prop as string, args);
            }
        }) as any;
    }

    public disconnect() {
        this.isStopped = true;
        this.isPolling = false;
        console.log("[HTTP_STUB] Disconnected and polling stopped");
    }

    private async invoke(method: string, args: any[]) {
        const session = newHttpBatchRpcSession<T>(this.url);

        try {
            const result = await (session as any)[method](...args);

            /* If the call included a listener (like joinRoom), we capture it
               and begin the background polling loop for events. */
            const listener = args.find(a => a && typeof a === 'object' && (a._capnp_target || a.onUserJoined));
            if (listener) {
                this.activeListener = listener;
                // noinspection ES6MissingAwait -- We don't want an await here, we want to start the async call and continue
                this.startPollingLoop();
            }

            return result;
        } catch (err) {
            throw err;
        }
    }

    private async startPollingLoop() {
        if (this.isPolling || this.isStopped) return;
        this.isPolling = true;

        console.log("[HTTP_STUB] Starting event polling loop");

        while (!this.isStopped) {
            try {
                await this.executePoll();
            } catch (e) {
                console.error("[HTTP_POLL] Request failed:", e);
            }

            /* Wait for the interval before the next poll. Using await here
               guarantees we never have two poll requests in flight at once. */
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        }

        this.isPolling = false;
    }

    private async executePoll() {
        const session = newHttpBatchRpcSession<ScrumPokerApi>(this.url);
        const events = await session.pollEvents(this.sessionId);

        for (const {method, args} of events) {
            if (this.activeListener?.[method]) {
                this.activeListener[method](...args);
            }
        }
    }
}
