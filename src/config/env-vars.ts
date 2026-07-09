/** Read env with optional legacy alias (fork migration TORLINK_* → TORZLINK_*). */
export function envVar(primary: string, legacy?: string): string | undefined {
  const v = process.env[primary]?.trim();
  if (v) return v;
  if (legacy) return process.env[legacy]?.trim() || undefined;
  return undefined;
}

export function envFlag(primary: string, legacy?: string): boolean {
  const v = envVar(primary, legacy);
  return v === "1" || v?.toLowerCase() === "true";
}
