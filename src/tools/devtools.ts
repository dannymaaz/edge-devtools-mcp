import type { EdgeManager } from "../browser/edge-manager.js";

export function registerDevToolsTools(edgeManager: EdgeManager) {
  return [
    {
      name: "edge_cdp_execute",
      description: "Execute a raw Chrome/Edge DevTools Protocol (CDP) command directly on the active page (e.g. 'Network.getCookies', 'Page.captureScreenshot', 'Emulation.setDeviceMetricsOverride', 'Performance.getMetrics', 'Storage.clearDataForOrigin'). Gives 100% full DevTools power to the AI agent.",
      inputSchema: {
        type: "object" as const,
        properties: {
          method: {
            type: "string",
            description: "CDP method name formatted as 'Domain.action' (e.g. 'Network.enable', 'Page.printToPDF', 'DOM.getDocument')"
          },
          params: {
            type: "object",
            description: "Optional dictionary of parameters matching the CDP method signature",
            additionalProperties: true
          },
          tabId: {
            type: "string",
            description: "Target tab ID (if omitted, uses active tab)"
          }
        },
        required: ["method"]
      },
      handler: async (args: { method: string; params?: Record<string, any>; tabId?: string }) => {
        await edgeManager.ensureReady();
        const tabManager = edgeManager.getTabManager();
        const cdp = tabManager.getCDPClient(args.tabId);

        const result = await cdp.execute(args.method, args.params || {});
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result ?? { success: true }, null, 2)
            }
          ]
        };
      }
    },
    {
      name: "edge_get_console_logs",
      description: "Inspect browser console messages and runtime errors produced on the active page or target tab.",
      inputSchema: {
        type: "object" as const,
        properties: {
          tabId: {
            type: "string",
            description: "Optional tab ID (if omitted, uses active tab)"
          },
          type: {
            type: "string",
            enum: ["all", "error", "warning", "info", "log"],
            description: "Filter by log severity (default: all)"
          },
          limit: {
            type: "number",
            description: "Maximum number of recent log entries to return (default: 50)"
          }
        }
      },
      handler: async (args: { tabId?: string; type?: "all" | "error" | "warning" | "info" | "log"; limit?: number }) => {
        await edgeManager.ensureReady();
        const tabManager = edgeManager.getTabManager();
        let logs = tabManager.getConsoleLogs(args.tabId, args.limit || 50);

        if (args.type && args.type !== "all") {
          logs = logs.filter(l => l.type === args.type);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(logs, null, 2)
            }
          ]
        };
      }
    },
    {
      name: "edge_get_network_activity",
      description: "Inspect network traffic, API requests, status codes, and HTTP headers captured on the active tab.",
      inputSchema: {
        type: "object" as const,
        properties: {
          tabId: {
            type: "string",
            description: "Optional tab ID (if omitted, uses active tab)"
          },
          resourceType: {
            type: "string",
            description: "Filter by resource type (e.g. 'fetch', 'xhr', 'document', 'stylesheet', 'image')"
          },
          limit: {
            type: "number",
            description: "Maximum number of recent network entries to return (default: 50)"
          }
        }
      },
      handler: async (args: { tabId?: string; resourceType?: string; limit?: number }) => {
        await edgeManager.ensureReady();
        const tabManager = edgeManager.getTabManager();
        let logs = tabManager.getNetworkLogs(args.tabId, args.limit || 50);

        if (args.resourceType) {
          logs = logs.filter(l => l.resourceType.toLowerCase() === args.resourceType!.toLowerCase());
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(logs, null, 2)
            }
          ]
        };
      }
    },
    {
      name: "edge_manage_cookies",
      description: "Inspect, set, or clear cookies across the Microsoft Edge browser session.",
      inputSchema: {
        type: "object" as const,
        properties: {
          action: {
            type: "string",
            enum: ["get", "set", "clear"],
            description: "Cookie operation: 'get', 'set', or 'clear'"
          },
          urls: {
            type: "array",
            items: { type: "string" },
            description: "URLs to filter cookies when retrieving (optional)"
          },
          cookies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "string" },
                url: { type: "string" },
                domain: { type: "string" },
                path: { type: "string" }
              },
              required: ["name", "value"]
            },
            description: "List of cookies to set (required for 'set' action)"
          }
        },
        required: ["action"]
      },
      handler: async (args: {
        action: "get" | "set" | "clear";
        urls?: string[];
        cookies?: Array<{ name: string; value: string; url?: string; domain?: string; path?: string }>;
      }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();
        const context = page.context();

        switch (args.action) {
          case "get": {
            const cookies = await context.cookies(args.urls);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(cookies, null, 2)
                }
              ]
            };
          }
          case "set": {
            if (!args.cookies || args.cookies.length === 0) {
              throw new Error("Must provide at least one cookie in 'cookies' array.");
            }
            await context.addCookies(args.cookies as any);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully injected ${args.cookies.length} cookie(s).`
                }
              ]
            };
          }
          case "clear": {
            await context.clearCookies();
            return {
              content: [
                {
                  type: "text",
                  text: "All browser session cookies cleared successfully."
                }
              ]
            };
          }
        }
      }
    },
    {
      name: "edge_emulate_device",
      description: "Emulate device characteristics: viewport size, mobile touch, user agent, or dark/light color scheme.",
      inputSchema: {
        type: "object" as const,
        properties: {
          width: {
            type: "number",
            description: "Viewport width in pixels (e.g. 390 for iPhone 14, 1920 for desktop)"
          },
          height: {
            type: "number",
            description: "Viewport height in pixels (e.g. 844 for iPhone 14, 1080 for desktop)"
          },
          isMobile: {
            type: "boolean",
            description: "Enable mobile touch and viewport emulation"
          },
          colorScheme: {
            type: "string",
            enum: ["light", "dark", "no-preference"],
            description: "Emulate system color scheme"
          },
          userAgent: {
            type: "string",
            description: "Custom User-Agent header string"
          }
        }
      },
      handler: async (args: {
        width?: number;
        height?: number;
        isMobile?: boolean;
        colorScheme?: "light" | "dark" | "no-preference";
        userAgent?: string;
      }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();

        if (args.width && args.height) {
          await page.setViewportSize({ width: args.width, height: args.height });
        }

        if (args.colorScheme) {
          await page.emulateMedia({ colorScheme: args.colorScheme });
        }

        return {
          content: [
            {
              type: "text",
              text: `Device emulation applied: ${JSON.stringify(args)}`
            }
          ]
        };
      }
    }
  ];
}
