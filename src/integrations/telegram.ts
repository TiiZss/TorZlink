import { telegramConfig } from "../config/env";
import { formatBytes, formatBytesPerSec, formatEtaShort } from "../util/format";
import { magnetAttachmentFilename } from "../util/magnet-file";

export interface MagnetAttachmentEvent {
  name: string;
  magnet: string;
  infoHash?: string;
  dir?: string;
}

export interface DownloadCompletedEvent {
  name: string;
  infoHash?: string;
  dir?: string;
  totalBytes: number;
  files?: number;
  durationSec: number;
  avgSpeedBytesPerSec: number;
}

export interface DownloadFailedEvent {
  name: string;
  infoHash?: string;
  dir?: string;
  error?: string;
}

/** @deprecated Use MagnetAttachmentEvent, DownloadCompletedEvent, or DownloadFailedEvent */
export type MagnetEvent = MagnetAttachmentEvent;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendMessage(text: string): Promise<void> {
  const cfg = telegramConfig();
  if (!cfg) return;
  const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        chat_id: cfg.channelId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      process.stderr.write(`TorZlink: Telegram notify failed (${res.status})\n`);
    }
  } catch {
    process.stderr.write("TorZlink: Telegram notify failed\n");
  }
}

async function sendDocument(filename: string, content: string, caption: string): Promise<void> {
  const cfg = telegramConfig();
  if (!cfg) return;
  const url = `https://api.telegram.org/bot${cfg.botToken}/sendDocument`;
  try {
    const form = new FormData();
    form.append("chat_id", cfg.channelId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("document", new Blob([content], { type: "text/plain" }), filename);
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) {
      process.stderr.write(`TorZlink: Telegram notify failed (${res.status})\n`);
    }
  } catch {
    process.stderr.write("TorZlink: Telegram notify failed\n");
  }
}

function captionBlock(ev: { name: string; dir?: string }): string {
  const title = esc(ev.name);
  const extra = ev.dir ? `\n📁 <code>${esc(ev.dir)}</code>` : "";
  return `<b>${title}</b>${extra}`;
}

function completionSummary(ev: DownloadCompletedEvent): string {
  const title = esc(ev.name);
  const lines = [`<b>${title}</b>`];
  if (ev.dir) lines.push(`📁 <code>${esc(ev.dir)}</code>`);
  lines.push(`📦 ${esc(formatBytes(ev.totalBytes))}`);
  if (ev.files !== undefined && ev.files > 0) {
    lines.push(`📄 ${ev.files} file${ev.files === 1 ? "" : "s"}`);
  }
  lines.push(`⏱ ${esc(formatEtaShort(ev.durationSec) || `${Math.round(ev.durationSec)}s`)}`);
  const speed = formatBytesPerSec(ev.avgSpeedBytesPerSec);
  if (speed) lines.push(`⚡ ${esc(speed)} avg`);
  return lines.join("\n");
}

function failedSummary(ev: DownloadFailedEvent): string {
  const err = ev.error ? `\n⚠️ ${esc(ev.error)}` : "";
  return `❌ Error en descarga\n${captionBlock(ev)}${err}`;
}

export function notifyMagnetCopied(ev: MagnetAttachmentEvent): void {
  const filename = magnetAttachmentFilename(ev.name, ev.infoHash);
  void sendDocument(filename, ev.magnet, `📋 Magnet copiado\n${captionBlock(ev)}`);
}

export function notifyDownloadStarted(ev: MagnetAttachmentEvent): void {
  const filename = magnetAttachmentFilename(ev.name, ev.infoHash);
  void sendDocument(filename, ev.magnet, `⬇️ Descarga iniciada\n${captionBlock(ev)}`);
}

export function notifyDownloadCompleted(ev: DownloadCompletedEvent): void {
  void sendMessage(`✅ Descarga completada\n${completionSummary(ev)}`);
}

export function notifyDownloadFailed(ev: DownloadFailedEvent): void {
  void sendMessage(failedSummary(ev));
}
