import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { envVar } from "../config/env-vars";
import { magnetFilePath } from "./magnet-file";

export interface ClipboardMeta {
  name?: string;
  infoHash?: string;
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let out = "";
    try {
      const proc = spawn(cmd, args, { windowsHide: true });
      const timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {}
        resolve("");
      }, 4000);
      timer.unref?.();
      proc.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
      proc.on("error", () => {
        clearTimeout(timer);
        resolve("");
      });
      proc.on("close", () => {
        clearTimeout(timer);
        resolve(out);
      });
    } catch {
      resolve("");
    }
  });
}

function write(cmd: string, args: string[], text: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const proc = spawn(cmd, args, { windowsHide: true });
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const done = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };
      timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {}
        done(false);
      }, 4000);
      timer.unref?.();
      proc.on("error", () => done(false));
      const onFinish = (code: number | null = 0): void => done(code === 0);
      proc.on("exit", onFinish);
      proc.on("close", onFinish);
      proc.stdin?.end(text);
    } catch {
      resolve(false);
    }
  });
}

function downloadDir(): string | undefined {
  return envVar("TORZLINK_DOWNLOAD_DIR", "TORLINK_DOWNLOAD_DIR");
}

function stateDir(): string | undefined {
  return envVar("TORZLINK_STATE_DIR", "TORLINK_STATE_DIR");
}

let lastWrittenFile: string | null = null;

export function lastClipboardFile(): string | null {
  return lastWrittenFile;
}

export function clipboardFallbackFiles(meta?: ClipboardMeta): string[] {
  const out: string[] = [];
  const explicit =
    envVar("TORZLINK_CLIPBOARD_FILE", "TORLINK_CLIPBOARD_FILE")?.trim();
  if (explicit) out.push(explicit);
  const dl = downloadDir();
  if (dl && meta?.name) out.push(magnetFilePath(dl, meta.name, meta.infoHash));
  else if (dl) out.push(path.join(dl, "magnet.txt"));
  const state = stateDir();
  if (state) out.push(path.join(state, "clipboard.txt"));
  return out;
}

export function clipboardFallbackFile(meta?: ClipboardMeta): string | null {
  return clipboardFallbackFiles(meta)[0] ?? null;
}

function headlessClipboard(): boolean {
  return existsSync("/.dockerenv");
}

async function writeClipboardFile(text: string, meta?: ClipboardMeta): Promise<boolean> {
  lastWrittenFile = null;
  for (const file of clipboardFallbackFiles(meta)) {
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, text, "utf8");
      lastWrittenFile = file;
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

export async function readClipboard(): Promise<string> {
  if (process.platform === "win32") {
    return (await run("powershell", ["-NoProfile", "-Command", "Get-Clipboard"])).trim();
  }
  if (process.platform === "darwin") {
    return (await run("pbpaste", [])).trim();
  }
  for (const [cmd, args] of [
    ["wl-paste", ["--no-newline"]],
    ["xclip", ["-selection", "clipboard", "-o"]],
    ["xsel", ["-b"]],
  ] as [string, string[]][]) {
    const out = (await run(cmd, args)).trim();
    if (out) return out;
  }
  for (const file of clipboardFallbackFiles()) {
    try {
      const out = (await fs.readFile(file, "utf8")).trim();
      if (out) return out;
    } catch {
      /* try next */
    }
  }
  return "";
}

export async function writeClipboard(text: string, meta?: ClipboardMeta): Promise<boolean> {
  if (!text?.trim()) return false;
  if (process.platform === "win32") {
    if (await write("clip", [], text)) return true;
    if (
      await write(
        "powershell",
        ["-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
        text,
      )
    ) {
      return true;
    }
    return writeClipboardFile(text, meta);
  }
  if (process.platform === "darwin") {
    return write("pbcopy", [], text);
  }
  if (headlessClipboard()) {
    return writeClipboardFile(text, meta);
  }
  for (const [cmd, args] of [
    ["wl-copy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["xsel", ["-b", "-i"]],
  ] as [string, string[]][]) {
    if (await write(cmd, args, text)) return true;
  }
  return writeClipboardFile(text, meta);
}

export async function saveMagnetFile(
  magnet: string,
  meta: { name: string; infoHash?: string },
): Promise<string | null> {
  const dl = downloadDir();
  if (!dl || !headlessClipboard()) return null;
  const file = magnetFilePath(dl, meta.name, meta.infoHash);
  try {
    await fs.mkdir(dl, { recursive: true });
    await fs.writeFile(file, magnet, "utf8");
    lastWrittenFile = file;
    return file;
  } catch {
    return null;
  }
}
