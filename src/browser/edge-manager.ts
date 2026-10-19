import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { findEdgePath } from "../utils/edge-paths.js";
import { TabManager } from "./tab-manager.js";
import type { LaunchOptions, ConnectOptions } from "../types.js";

export class EdgeManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private tabManager: TabManager = new TabManager();
  private isConnectedOverCDP = false;

  public getTabManager(): TabManager {
    return this.tabManager;
  }

  public isRunning(): boolean {
    return this.browser !== null || this.context !== null;
  }

  /**
   * Attempts to connect to an existing Edge debugging session over CDP.
   * Defaults to http://localhost:9222.
   */
  public async connect(options?: ConnectOptions): Promise<{ connected: boolean; message: string }> {
    const host = options?.host || "localhost";
    const port = options?.port || 9222;
    const endpoint = options?.endpoint || `http://${host}:${port}`;

    try {
      this.browser = await chromium.connectOverCDP(endpoint);
      this.isConnectedOverCDP = true;

      const contexts = this.browser.contexts();
      this.context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();

      this.setupContextListeners(this.context);

      const existingPages = this.context.pages();
      if (existingPages.length === 0) {
        const newPage = await this.context.newPage();
        this.tabManager.registerPage(newPage);
      } else {
        for (const page of existingPages) {
          this.tabManager.registerPage(page);
        }
      }

      return {
        connected: true,
        message: `Successfully connected to Microsoft Edge via CDP endpoint ${endpoint}. Registered ${this.context.pages().length} tab(s).`
      };
    } catch (err: any) {
      throw new Error(`Failed to connect to Microsoft Edge at ${endpoint}: ${err.message}`);
    }
  }

  /**
   * Launches a new instance of Microsoft Edge.
   * Can use persistent context (if userDataDir specified) or ephemeral context.
   */
  public async launch(options: LaunchOptions = {}): Promise<{ launched: boolean; message: string }> {
    if (this.isRunning()) {
      await this.close();
    }

    const edgePath = findEdgePath();
    const headless = options.headless ?? false;
    const args = [
      "--no-default-browser-check",
      "--no-first-run",
      "--disable-blink-features=AutomationControlled",
      ...(options.args || [])
    ];

    if (options.port) {
      args.push(`--remote-debugging-port=${options.port}`);
    }

    if (options.userDataDir) {
      // Launch persistent context
      this.context = await chromium.launchPersistentContext(options.userDataDir, {
        channel: edgePath ? undefined : "msedge",
        executablePath: edgePath,
        headless,
        args,
        viewport: options.viewport ?? { width: 1280, height: 800 },
        userAgent: options.userAgent,
        locale: options.locale,
        timezoneId: options.timezoneId,
        ignoreHTTPSErrors: options.ignoreHTTPSErrors
      });

      this.setupContextListeners(this.context);
      const pages = this.context.pages();
      if (pages.length === 0) {
        const p = await this.context.newPage();
        this.tabManager.registerPage(p);
      } else {
        for (const page of pages) {
          this.tabManager.registerPage(page);
        }
      }
    } else {
      // Standard launch
      this.browser = await chromium.launch({
        channel: edgePath ? undefined : "msedge",
        executablePath: edgePath,
        headless,
        args
      });

      this.context = await this.browser.newContext({
        viewport: options.viewport ?? { width: 1280, height: 800 },
        userAgent: options.userAgent,
        locale: options.locale,
        timezoneId: options.timezoneId,
        ignoreHTTPSErrors: options.ignoreHTTPSErrors
      });

      this.setupContextListeners(this.context);
      const page = await this.context.newPage();
      this.tabManager.registerPage(page);
    }

    return {
      launched: true,
      message: `Microsoft Edge launched successfully (headless: ${headless}, binary: ${edgePath || "system channel"}).`
    };
  }

  /**
   * Intelligent Hybrid connect-or-launch.
   * First tries to attach to an active Edge on port 9222.
   * If not available, launches a new instance.
   */
  public async ensureReady(preferredHeadless = false): Promise<string> {
    if (this.isRunning()) {
      return "Microsoft Edge is already running and ready.";
    }

    // Try connecting to 9222 first
    try {
      const res = await this.connect({ port: 9222 });
      return res.message;
    } catch {
      // Fallback: launch fresh
      const res = await this.launch({ headless: preferredHeadless });
      return res.message;
    }
  }

  public async newTab(url = "about:blank"): Promise<{ tabId: string; url: string }> {
    if (!this.context) {
      await this.ensureReady();
    }
    const page = await this.context!.newPage();
    const tabId = this.tabManager.registerPage(page);
    if (url && url !== "about:blank") {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    }
    this.tabManager.setActiveTab(tabId);
    return { tabId, url: page.url() };
  }

  public async closeTab(tabId?: string): Promise<string> {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) {
      return "No tab to close.";
    }
    const page = targetId === this.tabManager.getActiveTabId()
      ? this.tabManager.getActivePage()
      : (await this.tabManager.getTabs()).find(t => t.id === targetId) ? this.tabManager.setActiveTab(targetId) : null;

    if (page) {
      await page.close();
      this.tabManager.removePage(targetId);
      return `Tab ${targetId} closed.`;
    }
    return `Tab ${targetId} was not found.`;
  }

  public async close(): Promise<void> {
    this.tabManager.clearAll();

    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // Ignored
      }
      this.context = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignored
      }
      this.browser = null;
    }

    this.isConnectedOverCDP = false;
  }

  private setupContextListeners(context: BrowserContext): void {
    context.on("page", (newPage: Page) => {
      this.tabManager.registerPage(newPage);
    });
  }
}
