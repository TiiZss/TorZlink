import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  notifyMagnetCopied,
  notifyDownloadStarted,
  notifyDownloadCompleted,
  notifyDownloadFailed,
} from "../../src/integrations/telegram";

describe("telegram notifications", () => {
  const fetchMock = vi.fn();
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    for (const k of ["TELEGRAM_ENABLED", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNEL_ID"]) {
      saved[k] = process.env[k];
    }
    process.env.TELEGRAM_ENABLED = "1";
    process.env.TELEGRAM_BOT_TOKEN = "999:test-token";
    process.env.TELEGRAM_CHANNEL_ID = "-1001";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("sends magnet copied notification", async () => {
    notifyMagnetCopied({
      name: "Test Torrent",
      magnet: "magnet:?xt=urn:btih:abc",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bot999:test-token/sendMessage");
    const body = JSON.parse(String(init?.body));
    expect(body.chat_id).toBe("-1001");
    expect(body.text).toContain("Test Torrent");
    expect(body.text).toContain("magnet:?xt=urn:btih:abc");
  });

  it("does nothing when Telegram is disabled", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    notifyDownloadStarted({ name: "x", magnet: "m" });
    notifyDownloadCompleted({ name: "x", magnet: "m" });
    notifyDownloadFailed({ name: "x", magnet: "m", error: "fail" });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
