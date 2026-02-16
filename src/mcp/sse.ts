/**
 * Server-Sent Events (SSE) manager for MCP notifications
 * Ported from lib/fixed_mcp_http_server.js
 */

import { FastifyReply, FastifyRequest } from "fastify";

export class SSEManager {
  private clients: Set<FastifyReply> = new Set();
  private keepAliveIntervals: Map<FastifyReply, NodeJS.Timeout> = new Map();

  /**
   * Handle a new SSE connection
   */
  handleConnection(request: FastifyRequest, reply: FastifyReply): void {
    // Set SSE headers via raw response
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial connected event
    reply.raw.write("event: connected\ndata: {}\n\n");

    // Register client
    this.clients.add(reply);
    console.log(`[SSE] Client connected, active clients: ${this.clients.size}`);

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      reply.raw.write(": keep-alive\n\n");
    }, 30000);
    this.keepAliveIntervals.set(reply, keepAlive);

    // Clean up on disconnect
    request.raw.on("close", () => {
      this.removeClient(reply);
      console.log(
        `[SSE] Client disconnected, active clients: ${this.clients.size}`
      );
    });
  }

  /**
   * Send an event to all connected clients
   */
  broadcast(event: string, data: any): void {
    const eventString = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.raw.write(eventString);
      } catch {
        this.removeClient(client);
      }
    }
  }

  /**
   * Get the number of connected clients
   */
  get clientCount(): number {
    return this.clients.size;
  }

  private removeClient(reply: FastifyReply): void {
    this.clients.delete(reply);
    const interval = this.keepAliveIntervals.get(reply);
    if (interval) {
      clearInterval(interval);
      this.keepAliveIntervals.delete(reply);
    }
  }
}
