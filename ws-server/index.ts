import http, {IncomingMessage, ServerResponse} from "node:http";
import { WebSocketServer } from "ws";
import { newWebSocketRpcSession, nodeHttpBatchRpcResponse } from "capnweb";
import { ScrumPokerApiImpl } from "./interfaces";
import {PORT_NUMBER} from "./model/constants";

/**
 * Hugely inspired by (taken from) c43721's cap'n web example client/server:
 * https://github.com/c43721/test-cap-n-web/
 */

const api = new ScrumPokerApiImpl();

// Run standard HTTP server on a port.
const httpServer = http.createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.headers.upgrade?.toLowerCase() === "websocket") {
        // Ignore, should be handled by WebSocketServer instead.
        return;
    }

    // Accept Cap'n Web requests at `/api`.
    if (request.url === "/api") {
        try {
            await nodeHttpBatchRpcResponse(request, response, api, {
                // Since we're accepting WebSockets, we might as well accept cross-origin HTTP, since WebSockets always
                // permit cross-origin request anyway.
                headers: { "Access-Control-Allow-Origin": "*" },
            });
        } catch (err) {
            response.writeHead(500, { "content-type": "text/plain" });
            response.end(String(err));
        }
        return;
    }

    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not Found");
});

// Arrange to handle WebSockets as well, using the `ws` package.
const wsServer = new WebSocketServer({ server: httpServer });
wsServer.on("connection", (ws) => {
    // The `as Websocket` here is because the `ws` module seems to have its own `WebSocket` type declaration that is
    // incompatible with the standard one. In practice, though, they are compatible enough for Cap'n Web.
    console.log("New connection incoming!");
    (ws as WebSocket).onclose = () => {
        console.log("Connection closed!");
        api.connClosed(ws);
    }
    newWebSocketRpcSession(ws as any, api);
});

httpServer.once("listening", () => {
    console.log(`WebSocket RPC server listening on http://localhost:${PORT_NUMBER}`);
});

httpServer.listen(PORT_NUMBER);
