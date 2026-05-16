import { SERVER_NAME, SERVER_VERSION } from "./lib/config.js";
import { toToolError } from "./lib/errors.js";
import { log } from "./lib/logger.js";
import { NeteaseClient } from "./lib/neteaseClient.js";
import { callTool, tools } from "./tools/musicTools.js";

// MCP clients expect tool results in a content array. We return JSON as text
// so the output stays readable in Claude Desktop, Cursor, and the inspector.
function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export class McpServer {
  constructor({ client = new NeteaseClient() } = {}) {
    // Dependency injection keeps the protocol layer independent from NetEase.
    // A test or future OpenAPI client can be passed in here.
    this.client = client;
  }

  async handleRequest(message) {
    const { id, method, params } = message;

    // Initialization tells the client what this server supports.
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        },
      };
    }

    // These are the MCP discovery methods. Resources and prompts are empty
    // for now because this server is focused on tools.
    if (method === "notifications/initialized") return null;
    if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
    if (method === "resources/list") return { jsonrpc: "2.0", id, result: { resources: [] } };
    if (method === "prompts/list") return { jsonrpc: "2.0", id, result: { prompts: [] } };

    if (method === "tools/call") {
      try {
        const result = await callTool(this.client, params?.name, params?.arguments ?? {});
        return { jsonrpc: "2.0", id, result: textResult(result) };
      } catch (error) {
        // Convert every thrown error into a stable shape the MCP client can show.
        const toolError = toToolError(error);
        log("tool call failed", {
          tool: params?.name,
          code: toolError.code,
          error: toolError.message,
        });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            ...textResult({
              error: toolError.message,
              code: toolError.code,
              hint: toolError.hint,
            }),
            isError: true,
          },
        };
      }
    }

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    };
  }
}
