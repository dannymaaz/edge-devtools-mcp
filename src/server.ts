import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";
import { EdgeManager } from "./browser/edge-manager.js";
import { registerNavigationTools } from "./tools/navigation.js";
import { registerInteractionTools } from "./tools/interaction.js";
import { registerExtractionTools } from "./tools/extraction.js";
import { registerDevToolsTools } from "./tools/devtools.js";

export function createEdgeServer() {
  const edgeManager = new EdgeManager();

  const server = new Server(
    {
      name: "edge-devtools-mcp",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Collect all tool definitions
  const allTools = [
    ...registerNavigationTools(edgeManager),
    ...registerInteractionTools(edgeManager),
    ...registerExtractionTools(edgeManager),
    ...registerDevToolsTools(edgeManager)
  ];

  const toolsMap = new Map<string, (typeof allTools)[0]>();
  for (const t of allTools) {
    toolsMap.set(t.name, t);
  }

  // Handle tools listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as any
    }));

    return { tools };
  });

  // Handle tool invocation
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolsMap.get(name);

    if (!tool) {
      throw new Error(`Tool '${name}' not found on edge-devtools-mcp server.`);
    }

    try {
      return await tool.handler((args as any) || {});
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error executing ${name}: ${error.message || String(error)}`
          }
        ]
      };
    }
  });

  // Handle graceful shutdown
  const cleanup = async () => {
    try {
      await edgeManager.close();
    } catch {
      // Ignore on process exit
    }
  };

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });

  return {
    server,
    edgeManager,
    start: async () => {
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }
  };
}
