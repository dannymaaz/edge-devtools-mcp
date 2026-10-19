export interface LaunchOptions {
  headless?: boolean;
  port?: number;
  userDataDir?: string;
  viewport?: { width: number; height: number };
  userAgent?: string;
  args?: string[];
  locale?: string;
  timezoneId?: string;
  ignoreHTTPSErrors?: boolean;
}

export interface ConnectOptions {
  endpoint?: string;
  host?: string;
  port?: number;
}

export interface NetworkLogEntry {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  resourceType: string;
  timestamp: number;
  headers?: Record<string, string>;
  postData?: string;
  error?: string;
}

export interface ConsoleLogEntry {
  type: string;
  text: string;
  timestamp: number;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

export interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface TabInfo {
  id: string;
  title: string;
  url: string;
  active: boolean;
}
