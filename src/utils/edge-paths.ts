import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Resolves the absolute path to the Microsoft Edge binary on the host system.
 * Checks standard install locations on Windows, macOS, and Linux.
 */
export function findEdgePath(): string | undefined {
  const platform = os.platform();

  if (platform === "win32") {
    const candidates = [
      process.env["PROGRAMFILES(X86)"]
        ? path.join(process.env["PROGRAMFILES(X86)"]!, "Microsoft", "Edge", "Application", "msedge.exe")
        : undefined,
      process.env.PROGRAMFILES
        ? path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe")
        : undefined,
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe")
        : undefined,
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    ].filter((p): p is string => Boolean(p));

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  } else if (platform === "darwin") {
    const candidates = [
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta",
      "/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev",
      "/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary"
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  } else if (platform === "linux") {
    const candidates = [
      "/usr/bin/microsoft-edge-stable",
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-dev",
      "/usr/bin/microsoft-edge-beta",
      "/opt/microsoft/msedge/msedge"
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  }

  return undefined;
}
