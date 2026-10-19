import type { BrowserContext, Page, Request, Response, ConsoleMessage } from "playwright-core";
import type { TabInfo, NetworkLogEntry, ConsoleLogEntry } from "../types.js";
import { CDPClient } from "./cdp-client.js";

export class TabManager {
  private pages: Map<string, Page> = new Map();
  private cdpClients: Map<string, CDPClient> = new Map();
  private activeTabId: string | null = null;
  private networkLogs: Map<string, NetworkLogEntry[]> = new Map();
  private consoleLogs: Map<string, ConsoleLogEntry[]> = new Map();
  private tabCounter = 1;

  public registerPage(page: Page): string {
    const tabId = `tab-${this.tabCounter++}`;
    this.pages.set(tabId, page);
    this.cdpClients.set(tabId, new CDPClient(page));
    this.networkLogs.set(tabId, []);
    this.consoleLogs.set(tabId, []);

    if (!this.activeTabId) {
      this.activeTabId = tabId;
    }

    // Attach listeners for Network and Console DevTools logs
    page.on("request", (req: Request) => {
      const logs = this.networkLogs.get(tabId) || [];
      logs.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        timestamp: Date.now(),
        headers: req.headers(),
        postData: req.postData() || undefined
      });
      // Keep up to 200 entries to avoid memory bloating
      if (logs.length > 200) logs.shift();
      this.networkLogs.set(tabId, logs);
    });

    page.on("response", (res: Response) => {
      const logs = this.networkLogs.get(tabId) || [];
      const entry = logs.find((l) => l.url === res.url());
      if (entry) {
        entry.status = res.status();
        entry.statusText = res.statusText();
      }
    });

    page.on("requestfailed", (req: Request) => {
      const logs = this.networkLogs.get(tabId) || [];
      const entry = logs.find((l) => l.url === req.url());
      if (entry) {
        entry.error = req.failure()?.errorText || "Request failed";
      }
    });

    page.on("console", (msg: ConsoleMessage) => {
      const logs = this.consoleLogs.get(tabId) || [];
      logs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
        location: msg.location()
      });
      if (logs.length > 200) logs.shift();
      this.consoleLogs.set(tabId, logs);
    });

    page.on("close", () => {
      this.removePage(tabId);
    });

    return tabId;
  }

  public removePage(tabId: string): void {
    const cdp = this.cdpClients.get(tabId);
    if (cdp) {
      void cdp.detach();
      this.cdpClients.delete(tabId);
    }
    this.pages.delete(tabId);
    this.networkLogs.delete(tabId);
    this.consoleLogs.delete(tabId);

    if (this.activeTabId === tabId) {
      const remainingIds = Array.from(this.pages.keys());
      this.activeTabId = remainingIds.length > 0 ? remainingIds[0] : null;
    }
  }

  public getActivePage(): Page {
    if (!this.activeTabId || !this.pages.has(this.activeTabId)) {
      throw new Error("No active tab available. Ensure an Edge instance with a tab is open.");
    }
    return this.pages.get(this.activeTabId)!;
  }

  public getActiveTabId(): string | null {
    return this.activeTabId;
  }

  public setActiveTab(tabId: string): Page {
    if (!this.pages.has(tabId)) {
      throw new Error(`Tab ID ${tabId} not found.`);
    }
    this.activeTabId = tabId;
    const page = this.pages.get(tabId)!;
    void page.bringToFront();
    return page;
  }

  public async getTabs(): Promise<TabInfo[]> {
    const list: TabInfo[] = [];
    for (const [id, page] of this.pages.entries()) {
      let title = "";
      let url = "";
      try {
        title = await page.title();
        url = page.url();
      } catch {
        // Page might be transitioning
      }
      list.push({
        id,
        title,
        url,
        active: id === this.activeTabId
      });
    }
    return list;
  }

  public getCDPClient(tabId?: string): CDPClient {
    const id = tabId || this.activeTabId;
    if (!id || !this.cdpClients.has(id)) {
      throw new Error(`No CDP client available for tab ${id}.`);
    }
    return this.cdpClients.get(id)!;
  }

  public getNetworkLogs(tabId?: string, limit = 50): NetworkLogEntry[] {
    const id = tabId || this.activeTabId;
    if (!id) return [];
    const logs = this.networkLogs.get(id) || [];
    return logs.slice(-limit);
  }

  public getConsoleLogs(tabId?: string, limit = 50): ConsoleLogEntry[] {
    const id = tabId || this.activeTabId;
    if (!id) return [];
    const logs = this.consoleLogs.get(id) || [];
    return logs.slice(-limit);
  }

  public clearAll(): void {
    for (const cdp of this.cdpClients.values()) {
      void cdp.detach();
    }
    this.pages.clear();
    this.cdpClients.clear();
    this.networkLogs.clear();
    this.consoleLogs.clear();
    this.activeTabId = null;
  }
}
