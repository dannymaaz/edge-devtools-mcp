import { describe, it, expect, afterAll } from "vitest";
import { findEdgePath } from "../src/utils/edge-paths.js";
import { formatAccessibilityTree, truncateOutput } from "../src/utils/formatting.js";
import { createEdgeServer } from "../src/server.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

describe("Edge MCP Unit & Integration Suite", () => {
  it("should detect Edge executable path on the host system", () => {
    const edgePath = findEdgePath();
    // On Windows, Microsoft Edge is installed by default
    if (process.platform === "win32") {
      expect(edgePath).toBeDefined();
      expect(edgePath?.toLowerCase()).toContain("msedge.exe");
    }
  });

  it("should format accessibility nodes cleanly without noise", () => {
    const mockTree = {
      role: "button",
      name: "Submit Search",
      children: [
        {
          role: "text",
          name: "Submit"
        }
      ]
    };

    const formatted = formatAccessibilityTree(mockTree);
    expect(formatted).toContain('- button "Submit Search"');
    expect(formatted).toContain('  - text "Submit"');
  });

  it("should truncate output cleanly if exceeding threshold", () => {
    const longString = "A".repeat(100);
    const truncated = truncateOutput(longString, 50);
    expect(truncated).toHaveLength(50 + "\n\n... [Content truncated at 50 characters to preserve token context]".length);
    expect(truncated).toContain("truncated at 50");
  });

  it("should initialize MCP server and expose all required tools", async () => {
    const { server, edgeManager } = createEdgeServer();

    // Verify tools listing by dispatching list tools request handler
    const registeredHandlers = (server as any)._requestHandlers;
    expect(registeredHandlers.has(ListToolsRequestSchema.shape.method.value)).toBe(true);

    const handler = registeredHandlers.get(ListToolsRequestSchema.shape.method.value);
    const result = await handler({ method: "tools/list" });

    expect(result).toHaveProperty("tools");
    const toolNames = result.tools.map((t: any) => t.name);

    // Verify core navigation tools
    expect(toolNames).toContain("edge_launch");
    expect(toolNames).toContain("edge_connect");
    expect(toolNames).toContain("edge_navigate");
    expect(toolNames).toContain("edge_manage_tabs");
    expect(toolNames).toContain("edge_close");

    // Verify interaction tools
    expect(toolNames).toContain("edge_click");
    expect(toolNames).toContain("edge_fill");
    expect(toolNames).toContain("edge_press_key");
    expect(toolNames).toContain("edge_hover");
    expect(toolNames).toContain("edge_scroll");
    expect(toolNames).toContain("edge_select_option");

    // Verify extraction tools
    expect(toolNames).toContain("edge_get_accessibility_snapshot");
    expect(toolNames).toContain("edge_get_html");
    expect(toolNames).toContain("edge_take_screenshot");
    expect(toolNames).toContain("edge_evaluate");

    // Verify devtools & CDP tools
    expect(toolNames).toContain("edge_cdp_execute");
    expect(toolNames).toContain("edge_get_console_logs");
    expect(toolNames).toContain("edge_get_network_activity");
    expect(toolNames).toContain("edge_manage_cookies");
    expect(toolNames).toContain("edge_emulate_device");

    await edgeManager.close();
  });
});
