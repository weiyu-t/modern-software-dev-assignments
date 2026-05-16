#!/usr/bin/env node

// This file is only the stdio transport: read JSON-RPC lines from stdin,
// pass them to McpServer, and write JSON-RPC responses to stdout.
import { log } from "./lib/logger.js";
import { McpServer } from "./mcpServer.js";

const server = new McpServer();

function send(message) {
  if (!message) return;
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  // Stdio data may arrive in partial chunks, so keep a small line buffer.
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      send(await server.handleRequest(message));
    } catch (error) {
      log("invalid request", { error: error.message });
      send({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
        },
      });
    }
  }
});

process.stdin.on("end", () => {
  log("stdio closed");
});

log("server started");
