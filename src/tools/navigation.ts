import { z } from "zod";
import type { EdgeManager } from "../browser/edge-manager.js";

export function registerNavigationTools(edgeManager: EdgeManager) {
  return [
    {
      name: "edge_launch",
      description: "Launch a fresh instance of Microsoft Edge browser. Supports headless or headed modes, custom user data directories, and custom viewports.",
      inputSchema: {
        type: "object" as const,
        properties: {
          headless: {
            type: "boolean",
            description: "Run in background without GUI window (default: false)"
          },
          port: {
            type: "number",
            description: "Remote debugging port for Edge (default: optional)"
          },
          userDataDir: {
            type: "string",
            description: "Path to persistent user profile directory to reuse sessions/cookies"
          },
          viewportWidth: {
            type: "number",
            description: "Initial browser viewport width in pixels (default: 1280)"
          },
          viewportHeight: {
            type: "number",
            description: "Initial browser viewport height in pixels (default: 800)"
          }
        }
      },
      handler: async (args: {
        headless?: boolean;
        port?: number;
        userDataDir?: string;
        viewportWidth?: number;
        viewportHeight?: number;
      }) => {
        const viewport = args.viewportWidth && args.viewportHeight
          ? { width: args.viewportWidth, height: args.viewportHeight }
          : undefined;

        const res = await edgeManager.launch({
          headless: args.headless ?? false,
          port: args.port,
          userDataDir: args.userDataDir,
          viewport
        });

        return {
          content: [
            {
              type: "text",
              text: res.message
            }
          ]
        };
      }
    },
    {
      name: "edge_connect",
      description: "Connect to an already running Microsoft Edge instance with remote debugging enabled (CDP). Defaults to http://localhost:9222.",
      inputSchema: {
        type: "object" as const,
        properties: {
          port: {
            type: "number",
            description: "Remote debugging port (default: 9222)"
          },
          host: {
            type: "string",
            description: "Host where Edge is listening (default: localhost)"
          },
          endpoint: {
            type: "string",
            description: "Full CDP WebSocket or HTTP endpoint (e.g. http://localhost:9222)"
          }
        }
      },
      handler: async (args: { port?: number; host?: string; endpoint?: string }) => {
        const res = await edgeManager.connect(args);
        return {
          content: [
            {
              type: "text",
              text: res.message
            }
          ]
        };
      }
    },
    {
      name: "edge_navigate",
      description: "Navigate active Edge tab to a specified URL. Automatically launches or prepares the browser if not already open.",
      inputSchema: {
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description: "Target URL (e.g. https://www.bing.com or https://example.com)"
          },
          waitUntil: {
            type: "string",
            enum: ["load", "domcontentloaded", "networkidle", "commit"],
            description: "Navigation condition to wait for (default: domcontentloaded)"
          },
          timeout: {
            type: "number",
            description: "Navigation timeout in milliseconds (default: 30000)"
          }
        },
        required: ["url"]
      },
      handler: async (args: { url: string; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; timeout?: number }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();
        const response = await page.goto(args.url, {
          waitUntil: args.waitUntil || "domcontentloaded",
          timeout: args.timeout || 30000
        });

        const status = response ? response.status() : "cache";
        const title = await page.title();

        return {
          content: [
            {
              type: "text",
              text: `Navigated to ${page.url()}\nStatus: ${status}\nTitle: "${title}"`
            }
          ]
        };
      }
    },
    {
      name: "edge_manage_tabs",
      description: "Manage Edge browser tabs: list all active tabs, switch active tab, create a new tab, or close an existing tab.",
      inputSchema: {
        type: "object" as const,
        properties: {
          action: {
            type: "string",
            enum: ["list", "switch", "new", "close"],
            description: "Tab action to perform"
          },
          tabId: {
            type: "string",
            description: "Target tab ID (e.g. tab-1). Required for 'switch' and 'close' actions."
          },
          url: {
            type: "string",
            description: "Optional URL to open when creating a 'new' tab."
          }
        },
        required: ["action"]
      },
      handler: async (args: { action: "list" | "switch" | "new" | "close"; tabId?: string; url?: string }) => {
        await edgeManager.ensureReady();
        const tabManager = edgeManager.getTabManager();

        switch (args.action) {
          case "list": {
            const tabs = await tabManager.getTabs();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(tabs, null, 2)
                }
              ]
            };
          }
          case "switch": {
            if (!args.tabId) {
              throw new Error("tabId is required for switch action.");
            }
            const page = tabManager.setActiveTab(args.tabId);
            return {
              content: [
                {
                  type: "text",
                  text: `Switched active tab to ${args.tabId} (${page.url()})`
                }
              ]
            };
          }
          case "new": {
            const res = await edgeManager.newTab(args.url || "about:blank");
            return {
              content: [
                {
                  type: "text",
                  text: `Opened new tab: ${res.tabId} (${res.url})`
                }
              ]
            };
          }
          case "close": {
            const res = await edgeManager.closeTab(args.tabId);
            return {
              content: [
                {
                  type: "text",
                  text: res
                }
              ]
            };
          }
        }
      }
    },
    {
      name: "edge_close",
      description: "Close all open tabs and terminate the Microsoft Edge browser session.",
      inputSchema: {
        type: "object" as const,
        properties: {}
      },
      handler: async () => {
        await edgeManager.close();
        return {
          content: [
            {
              type: "text",
              text: "Microsoft Edge session closed successfully."
            }
          ]
        };
      }
    }
  ];
}
