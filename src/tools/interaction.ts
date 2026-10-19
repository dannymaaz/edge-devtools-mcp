import type { EdgeManager } from "../browser/edge-manager.js";

export function registerInteractionTools(edgeManager: EdgeManager) {
  return [
    {
      name: "edge_click",
      description: "Click an element on the active page identified by CSS selector, text content, or role.",
      inputSchema: {
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "CSS selector, XPath, or text selector (e.g. 'button#submit', 'text=Sign In')"
          },
          button: {
            type: "string",
            enum: ["left", "right", "middle"],
            description: "Mouse button to click with (default: left)"
          },
          clickCount: {
            type: "number",
            description: "Number of clicks: 1 for single click, 2 for double click (default: 1)"
          },
          timeout: {
            type: "number",
            description: "Max time in milliseconds to wait for element (default: 10000)"
          }
        },
        required: ["selector"]
      },
      handler: async (args: { selector: string; button?: "left" | "right" | "middle"; clickCount?: number; timeout?: number }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();
        await page.click(args.selector, {
          button: args.button || "left",
          clickCount: args.clickCount || 1,
          timeout: args.timeout || 10000
        });

        return {
          content: [
            {
              type: "text",
              text: `Clicked element '${args.selector}' successfully.`
            }
          ]
        };
      }
    },
    {
      name: "edge_fill",
      description: "Fill or type text into an input, textarea, or contenteditable element on the active page.",
      inputSchema: {
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "CSS selector or text selector targeting the input element"
          },
          text: {
            type: "string",
            description: "Text value to fill into the input"
          },
          pressEnter: {
            type: "boolean",
            description: "Press Enter key immediately after typing (useful for search inputs, default: false)"
          },
          timeout: {
            type: "number",
            description: "Max time in milliseconds to wait for input element (default: 10000)"
          }
        },
        required: ["selector", "text"]
      },
      handler: async (args: { selector: string; text: string; pressEnter?: boolean; timeout?: number }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();
        await page.fill(args.selector, args.text, {
          timeout: args.timeout || 10000
        });

        if (args.pressEnter) {
          await page.press(args.selector, "Enter");
        }

        return {
          content: [
            {
              type: "text",
              text: `Filled text into '${args.selector}'${args.pressEnter ? " and pressed Enter" : ""}.`
            }
          ]
        };
      }
    },
    {
      name: "edge_press_key",
      description: "Send keyboard key combinations to the page (e.g. 'Enter', 'Escape', 'Tab', 'Control+A', 'ArrowDown').",
      inputSchema: {
        type: "object" as const,
        properties: {
          key: {
            type: "string",
            description: "Key or key combination to press (e.g. Enter, Tab, Escape, Control+f)"
          },
          selector: {
            type: "string",
            description: "Optional element selector to focus before sending the key"
          }
        },
        required: ["key"]
      },
      handler: async (args: { key: string; selector?: string }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();

        if (args.selector) {
          await page.press(args.selector, args.key);
        } else {
          await page.keyboard.press(args.key);
        }

        return {
          content: [
            {
              type: "text",
              text: `Sent key press: '${args.key}'${args.selector ? ` on '${args.selector}'` : ""}.`
            }
          ]
        };
      }
    },
    {
      name: "edge_hover",
      description: "Hover mouse cursor over an element to trigger tooltips, dropdown menus, or hover effects.",
      inputSchema: {
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "Target element selector"
          },
          timeout: {
            type: "number",
            description: "Max wait time in milliseconds (default: 10000)"
          }
        },
        required: ["selector"]
      },
      handler: async (args: { selector: string; timeout?: number }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();
        await page.hover(args.selector, { timeout: args.timeout || 10000 });

        return {
          content: [
            {
              type: "text",
              text: `Hovered over element '${args.selector}'.`
            }
          ]
        };
      }
    },
    {
      name: "edge_scroll",
      description: "Scroll the page vertically or horizontally by a pixel offset or into a specific target element.",
      inputSchema: {
        type: "object" as const,
        properties: {
          deltaX: {
            type: "number",
            description: "Pixels to scroll horizontally (positive = right, negative = left)"
          },
          deltaY: {
            type: "number",
            description: "Pixels to scroll vertically (positive = down, negative = up)"
          },
          selector: {
            type: "string",
            description: "Optional element selector to scroll directly into view"
          }
        }
      },
      handler: async (args: { deltaX?: number; deltaY?: number; selector?: string }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();

        if (args.selector) {
          const locator = page.locator(args.selector);
          await locator.scrollIntoViewIfNeeded({ timeout: 10000 });
          return {
            content: [
              {
                type: "text",
                text: `Scrolled '${args.selector}' into view.`
              }
            ]
          };
        }

        const dx = args.deltaX || 0;
        const dy = args.deltaY || 0;
        await page.mouse.wheel(dx, dy);

        return {
          content: [
            {
              type: "text",
              text: `Scrolled by deltaX: ${dx}, deltaY: ${dy}.`
            }
          ]
        };
      }
    },
    {
      name: "edge_select_option",
      description: "Select one or more options in a <select> dropdown element.",
      inputSchema: {
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "Selector targeting the <select> element"
          },
          values: {
            type: "array",
            items: { type: "string" },
            description: "Array of option values or labels to select"
          }
        },
        required: ["selector", "values"]
      },
      handler: async (args: { selector: string; values: string[] }) => {
        await edgeManager.ensureReady();
        const page = edgeManager.getTabManager().getActivePage();
        const selected = await page.selectOption(args.selector, args.values);

        return {
          content: [
            {
              type: "text",
              text: `Selected options [${selected.join(", ")}] in '${args.selector}'.`
            }
          ]
        };
      }
    }
  ];
}
