import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { IncomingMessage } from "http";
import { db } from "@workspace/db";
import { adminSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { parse as parseCookies } from "cookie";
import { hashToken } from "./crypto.js";

const adminClients = new Set<WebSocket>();

async function isValidAdminSession(req: IncomingMessage): Promise<boolean> {
  try {
    const cookieHeader = req.headers.cookie || "";
    const cookies = parseCookies(cookieHeader);
    const rawToken = cookies["admin_session"];
    if (!rawToken) return false;

    const storedToken = hashToken(rawToken);
    const sessions = await db
      .select()
      .from(adminSessionsTable)
      .where(eq(adminSessionsTable.sessionToken, storedToken));

    const session = sessions[0];
    if (!session) return false;
    if (session.expiresAt < new Date()) return false;
    return true;
  } catch (err) {
    console.error("[WS] Session validation error:", err);
    return false;
  }
}

export function setupWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const valid = await isValidAdminSession(req);
    if (!valid) {
      ws.close(4401, "Unauthorized");
      return;
    }

    adminClients.add(ws);
    ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));

    ws.on("close", () => adminClients.delete(ws));
    ws.on("error", (err) => {
      console.error("[WS] Client error:", err.message);
      adminClients.delete(ws);
    });
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch {}
    });
  });

  console.log("[WS] WebSocket server attached at /ws");
}

export function broadcastToAdmin(event: object): void {
  const json = JSON.stringify(event);
  for (const client of adminClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}
