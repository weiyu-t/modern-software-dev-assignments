import test from "node:test";
import assert from "node:assert/strict";

import { McpServer } from "../server/mcpServer.js";

test("initialize returns server info and capabilities", async () => {
  const server = new McpServer({ client: {} });
  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05" },
  });

  assert.equal(response.result.serverInfo.name, "netease-music-mcp");
  assert.deepEqual(response.result.capabilities.tools, {});
});

test("tools/list returns registered tools", async () => {
  const server = new McpServer({ client: {} });
  const response = await server.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });

  assert.ok(response.result.tools.some((tool) => tool.name === "search_songs"));
  assert.ok(response.result.tools.some((tool) => tool.name === "resolve_netease_url"));
});

test("tool validation errors are returned as MCP tool errors", async () => {
  const server = new McpServer({ client: {} });
  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "search_songs", arguments: { keyword: "" } },
  });

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(response.result.isError, true);
  assert.equal(payload.code, "INVALID_INPUT");
  assert.equal(payload.error, "keyword is required");
});
