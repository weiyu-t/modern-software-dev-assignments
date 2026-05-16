#!/usr/bin/env node

// Remote transport entrypoint: expose the same McpServer over HTTP instead
// of stdio. Tool behavior stays shared with the local server.
import http from "node:http";

import { HTTP_HOST, HTTP_PORT, MCP_AUTH_TOKEN } from "./lib/config.js";
import { log } from "./lib/logger.js";
import { McpServer } from "./mcpServer.js";

const server = new McpServer();

function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function isAuthorized(request) {
  if (!MCP_AUTH_TOKEN) return true;
  return request.headers.authorization === `Bearer ${MCP_AUTH_TOKEN}`;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

const httpServer = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${HTTP_HOST}:${HTTP_PORT}`}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, transport: "http" }, corsHeaders());
    return;
  }

  if (request.method !== "POST" || url.pathname !== "/mcp") {
    sendJson(response, 404, { error: "Not found" }, corsHeaders());
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: "Unauthorized" }, {
      ...corsHeaders(),
      "WWW-Authenticate": "Bearer",
    });
    return;
  }

  try {
    const rawBody = await readBody(request);
    const message = JSON.parse(rawBody);
    const result = await server.handleRequest(message);
    sendJson(response, 200, result ?? {}, corsHeaders());
  } catch (error) {
    log("http request failed", { error: error.message });
    sendJson(response, 400, {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: error.message || "Bad request",
      },
    }, corsHeaders());
  }
});

httpServer.on("error", (error) => {
  log("http server failed", { error: error.message });
  process.exitCode = 1;
});

httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
  log("http server started", {
    url: `http://${HTTP_HOST}:${HTTP_PORT}/mcp`,
    auth: MCP_AUTH_TOKEN ? "enabled" : "disabled",
  });
});
