import type { EdgeManager } from "../browser/edge-manager.js";
import { formatAccessibilityTree, truncateOutput } from "../utils/formatting.js";
import fs from "node:fs/promises";
import path from "node:path";

export function registerExtractionTools(edgeManager: EdgeManager) {
  return [
    {
      name: "edge_get_accessibility_snapshot",
      description: "Get the semantic accessibility tree of the active page. This is the most token-efficient way for an AI agent to inspect interactive elements (buttons, inputs, links, headings) without loading bulky HTML.",
      inputSchema: {
        type: "object" as const,
        properties: {
          interestingOnly: {
            type: "boolean",
            description: "Filter out non-semantic structural containers to minimize tokens (default: true)"
          },
          rootSelector: {
            type: "string",
            description: "Optional CSS selector to scope the snapshot to a specific subtree/component"
          }
        }
      },
      handler: async (args: { interestingOnly?: boolean; rootSelector?: string }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();

        let formatted = "";
        try {
          // Playwright modern semantic ariaSnapshot (best for LLMs)
          const locator = args.rootSelector ? page.locator(args.rootSelector) : page.locator(":root");
          formatted = await locator.ariaSnapshot();
        } catch {
          // Fallback to CDP Accessibility domain
          const cdp = edgeManager.getTabManager().getCDPClient();
          const axTree = await cdp.execute("Accessibility.getFullAXTree");
          formatted = JSON.stringify(axTree, null, 2);
        }

        if (!formatted || formatted.trim().length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No accessibility tree elements found for current page state."
              }
            ]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: truncateOutput(formatted, 30000)
            }
          ]
        };
      }
    },
    {
      name: "edge_get_html",
      description: "Retrieve raw HTML of the current document or a specific element selector.",
      inputSchema: {
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "Optional element selector (if omitted, returns full page HTML)"
          },
          maxLength: {
            type: "number",
            description: "Maximum characters to return to avoid token overflow (default: 25000)"
          }
        }
      },
      handler: async (args: { selector?: string; maxLength?: number }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();

        let content = "";
        if (args.selector) {
          const el = await page.$(args.selector);
          if (!el) {
            throw new Error(`Element matching selector '${args.selector}' was not found.`);
          }
          content = (await el.innerHTML()) || "";
        } else {
          content = await page.content();
        }

        return {
          content: [
            {
              type: "text",
              text: truncateOutput(content, args.maxLength || 25000)
            }
          ]
        };
      }
    },
    {
      name: "edge_take_screenshot",
      description: "Capture a screenshot of the active page or a specific selector. Can return base64 image data or save directly to a file path.",
      inputSchema: {
        type: "object" as const,
        properties: {
          filePath: {
            type: "string",
            description: "Absolute file path to save image (e.g. C:/screenshots/page.png). If omitted, returns base64 image."
          },
          fullPage: {
            type: "boolean",
            description: "Capture the entire scrollable page height (default: false)"
          },
          selector: {
            type: "string",
            description: "Optional CSS selector to screenshot only that specific element"
          },
          quality: {
            type: "number",
            description: "JPEG quality 1-100 (only applicable when type is 'jpeg')"
          },
          format: {
            type: "string",
            enum: ["png", "jpeg"],
            description: "Image format (default: png)"
          }
        }
      },
      handler: async (args: {
        filePath?: string;
        fullPage?: boolean;
        selector?: string;
        quality?: number;
        format?: "png" | "jpeg";
      }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();

        const screenshotOptions: any = {
          fullPage: args.fullPage ?? false,
          type: args.format || "png"
        };

        if (args.format === "jpeg" && args.quality) {
          screenshotOptions.quality = args.quality;
        }

        let buffer: Buffer;

        if (args.selector) {
          const locator = page.locator(args.selector);
          buffer = await locator.screenshot(screenshotOptions);
        } else {
          buffer = await page.screenshot(screenshotOptions);
        }

        if (args.filePath) {
          const resolvedPath = path.resolve(args.filePath);
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
          await fs.writeFile(resolvedPath, buffer);
          return {
            content: [
              {
                type: "text",
                text: `Screenshot saved successfully to ${resolvedPath}`
              }
            ]
          };
        }

        const base64 = buffer.toString("base64");
        return {
          content: [
            {
              type: "image",
              data: base64,
              mimeType: args.format === "jpeg" ? "image/jpeg" : "image/png"
            }
          ]
        };
      }
    },
    {
      name: "edge_evaluate",
      description: "Execute arbitrary JavaScript code within the context of the active Edge page and return the serialized result.",
      inputSchema: {
        type: "object" as const,
        properties: {
          expression: {
            type: "string",
            description: "JavaScript code or expression to evaluate (e.g. 'document.title' or 'window.location.href')"
          }
        },
        required: ["expression"]
      },
      handler: async (args: { expression: string }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();

        const result = await page.evaluate((expr: string) => {
          try {
            return (0, eval)(expr);
          } catch {
            return new Function(expr)();
          }
        }, args.expression);

        return {
          content: [
            {
              type: "text",
              text: typeof result === "object" ? JSON.stringify(result, null, 2) : String(result)
            }
          ]
        };
      }
    }
  ];
}
