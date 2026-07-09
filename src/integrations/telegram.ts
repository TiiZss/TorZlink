import { telegramConfig } from "../config/env";

export interface MagnetEvent {
  name: string;
  magnet: string;
  infoHash?: string;
  dir?: string;
  error?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function send(text: string): Promise<void> {
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

function magnetBlock(ev: MagnetEvent): string {
  const title = esc(ev.name);
  const magnet = esc(ev.magnet);
  const extra = ev.dir ? `\n📁 <code>${esc(ev.dir)}</code>` : "";
  return `<b>${title}</b>${extra}\n<code>${magnet}</code>`;
}

export function notifyMagnetCopied(ev: MagnetEvent): void {
  void send(`📋 Magnet copiado\n${magnetBlock(ev)}`);
}

export function notifyDownloadStarted(ev: MagnetEvent): void {
  void send(`⬇️ Descarga iniciada\n${magnetBlock(ev)}`);
}

export function notifyDownloadCompleted(ev: MagnetEvent): void {
  void send(`✅ Descarga completada\n${magnetBlock(ev)}`);
}

export function notifyDownloadFailed(ev: MagnetEvent): void {
  const err = ev.error ? `\n⚠️ ${esc(ev.error)}` : "";
  void send(`❌ Error en descarga\n${magnetBlock(ev)}${err}`);
}
