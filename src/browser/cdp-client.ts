import type { CDPSession, Page } from "playwright-core";

export class CDPClient {
  private session: CDPSession | null = null;
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  public async getSession(): Promise<CDPSession> {
    if (!this.session) {
      this.session = await this.page.context().newCDPSession(this.page);
    }
    return this.session;
  }

  public async execute(method: string, params?: Record<string, any>): Promise<any> {
    const session = await this.getSession();
    return await session.send(method as any, params);
  }

  public async detach(): Promise<void> {
    if (this.session) {
      try {
        await this.session.detach();
      } catch {
        // Ignored if already detached
      }
      this.session = null;
    }
  }
}
