import { WebSocketServer, WebSocket } from "ws";
import type {
  WSMessage,
  ElementSelectedPayload,
  ChangesUpdatedPayload,
} from "../shared/types.js";
import { WS_PORT } from "../shared/types.js";
import { ChangeStore } from "./ChangeStore.js";

/**
 * WebSocket bridge that connects the browser component to the MCP server.
 * Runs a WS server on localhost:7890 and relays element selections + changes.
 */
export class WSBridge {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor(private store: ChangeStore) {}

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });

      this.wss.on("listening", () => {
        console.error(`[viztweak] WebSocket bridge listening on ws://127.0.0.1:${WS_PORT}`);
        resolve();
      });

      this.wss.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
          console.error(`[viztweak] Port ${WS_PORT} in use — another viztweak instance may be running`);
        }
        reject(err);
      });

      this.wss.on("connection", (ws) => {
        this.clients.add(ws);
        console.error(`[viztweak] Browser connected (${this.clients.size} client(s))`);

        ws.on("message", (raw) => {
          try {
            const msg: WSMessage = JSON.parse(raw.toString());
            this.handleMessage(msg, ws);
          } catch {
            console.error("[viztweak] Invalid message from browser");
          }
        });

        ws.on("close", () => {
          this.clients.delete(ws);
          console.error(`[viztweak] Browser disconnected (${this.clients.size} client(s))`);
        });
      });
    });
  }

  private handleMessage(msg: WSMessage, _ws: WebSocket) {
    switch (msg.type) {
      case "element_selected": {
        const payload = msg.payload as ElementSelectedPayload;
        this.store.setSelection(payload.element, payload.computedStyles);
        break;
      }
      case "changes_updated": {
        const payload = msg.payload as ChangesUpdatedPayload;
        for (const diff of payload.diffs) {
          this.store.addDiff(diff);
        }
        break;
      }
      case "changes_cleared": {
        this.store.clearDiffs();
        break;
      }
      case "ping": {
        this.broadcast({ type: "pong" });
        break;
      }
    }
  }

  broadcast(msg: WSMessage) {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  stop() {
    for (const client of this.clients) {
      client.close();
    }
    this.wss?.close();
  }
}
