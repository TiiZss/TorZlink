import { envVar } from "../config/env-vars";

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): LogLevel {
  const raw = (envVar("TORZLINK_LOG") ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  if (raw === "1" || raw === "true") return "debug";
  return "info";
}

/** Redact secrets / magnets from free-form strings before logging. */
export function redactLogText(input: string): string {
  return input
    .replace(/Bearer\s+[^\s]+/gi, "Bearer ***")
    .replace(/magnet:\?[^\s"']+/gi, "magnet:?***")
    .replace(/\b[0-9a-f]{40}\b/gi, (h) => `${h.slice(0, 8)}…`)
    .replace(/(TELEGRAM_BOT_TOKEN|TORZLINK_SERVE_TOKEN|NAS_PASSWORD)=([^\s]+)/gi, "$1=***");
}

function emit(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[configuredLevel()]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: redactLogText(msg),
    ...(extra
      ? Object.fromEntries(
          Object.entries(extra).map(([k, v]) => [
            k,
            typeof v === "string" ? redactLogText(v) : v,
          ]),
        )
      : {}),
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const log = {
  debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),
};
