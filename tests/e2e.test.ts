import { describe, it, expect, afterAll } from "vitest";
import { createEdgeServer } from "../src/server.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

describe("Edge DevTools MCP End-to-End Real Browser Suite", () => {
  const { server, edgeManager } = createEdgeServer();
  const registeredHandlers = (server as any)._requestHandlers;
  const callToolHandler = registeredHandlers.get(CallToolRequestSchema.shape.method.value);

  async function invokeTool(name: string, args: Record<string, any> = {}) {
    return await callToolHandler({
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    });
  }

  afterAll(async () => {
    try {
      await edgeManager.close();
    } catch {
      // Ignore
    }
  });

  it("should launch Microsoft Edge in headless mode and confirm readiness", async () => {
    const res = await invokeTool("edge_launch", {
      headless: true,
      viewportWidth: 1280,
      viewportHeight: 720
    });

    expect(res).toHaveProperty("content");
    expect(res.content[0].text).toContain("Microsoft Edge launched successfully");
  }, 35000);

  it("should navigate to a website and return status and title", async () => {
    const res = await invokeTool("edge_navigate", {
      url: "https://example.com",
      waitUntil: "domcontentloaded"
    });

    expect(res).toHaveProperty("content");
    expect(res.content[0].text).toContain("example.com");
    expect(res.content[0].text).toContain("Example Domain");
  }, 25000);

  it("should retrieve semantic accessibility snapshot for AI agent reasoning", async () => {
    const res = await invokeTool("edge_get_accessibility_snapshot", {
      interestingOnly: true
    });

    expect(res).toHaveProperty("content");
    expect(res.content[0].text).toBeDefined();
    expect(res.content[0].text.length).toBeGreaterThan(0);
  }, 15000);

  it("should execute JavaScript expression via edge_evaluate", async () => {
    const res = await invokeTool("edge_evaluate", {
      expression: "document.title"
    });

    expect(res).toHaveProperty("content");
    expect(res.content[0].text).toContain("Example Domain");
  }, 15000);

  it("should execute raw CDP commands via edge_cdp_execute", async () => {
    const res = await invokeTool("edge_cdp_execute", {
      method: "Page.getLayoutMetrics"
    });

    expect(res).toHaveProperty("content");
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed).toHaveProperty("cssLayoutViewport");
  }, 15000);

  it("should capture a screenshot and save to disk", async () => {
    const testScreenshotPath = path.resolve("./test-screenshot.png");
    const res = await invokeTool("edge_take_screenshot", {
      filePath: testScreenshotPath,
      fullPage: false
    });

    expect(res).toHaveProperty("content");
    expect(res.content[0].text).toContain("Screenshot saved successfully");

    // Clean up temporary test file
    await fs.unlink(testScreenshotPath).catch(() => {});
  }, 15000);

  it("should manage tabs (create new tab and list tabs)", async () => {
    const newTabRes = await invokeTool("edge_manage_tabs", {
      action: "new",
      url: "https://example.com"
    });
    expect(newTabRes.content[0].text).toContain("Opened new tab");

    const listRes = await invokeTool("edge_manage_tabs", {
      action: "list"
    });
    const tabs = JSON.parse(listRes.content[0].text);
    expect(tabs.length).toBeGreaterThanOrEqual(2);
  }, 20000);

  it("should gracefully close Edge session", async () => {
    const res = await invokeTool("edge_close", {});
    expect(res.content[0].text).toContain("closed successfully");
  }, 15000);
});
