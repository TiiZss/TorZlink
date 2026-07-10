import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  notifyMagnetCopied,
  notifyDownloadStarted,
  notifyDownloadCompleted,
  notifyDownloadFailed,
} from "../../src/integrations/telegram";

async function formDataEntries(body: FormData): Promise<[string, string | File][]> {
  const out: [string, string | File][] = [];
  for (const [key, value] of body.entries()) {
    out.push([key, value]);
  }
  return out;
}

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

  it("sends magnet copied as document attachment", async () => {
    const magnet = "magnet:?xt=urn:btih:abc123&dn=Test";
    notifyMagnetCopied({
      name: "Test Torrent",
      magnet,
      infoHash: "abc123def4567890abcdef5678901234567890ab",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bot999:test-token/sendDocument");
    expect(init?.body).toBeInstanceOf(FormData);
    const entries = await formDataEntries(init!.body as FormData);
    expect(entries.find(([k]) => k === "chat_id")?.[1]).toBe("-1001");
    const caption = entries.find(([k]) => k === "caption")?.[1];
    expect(String(caption)).toContain("Test Torrent");
    expect(String(caption)).not.toContain("magnet:?");
    const doc = entries.find(([k]) => k === "document")?.[1] as File;
    expect(doc.name).toMatch(/\.magnet$/);
    expect(await doc.text()).toBe(magnet);
  });

  it("sends download started as document attachment", async () => {
    const magnet = "magnet:?xt=urn:btih:deadbeef";
    notifyDownloadStarted({
      name: "Started Torrent",
      magnet,
      infoHash: "deadbeef",
      dir: "/downloads",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/sendDocument");
    const entries = await formDataEntries(init!.body as FormData);
    const caption = String(entries.find(([k]) => k === "caption")?.[1]);
    expect(caption).toContain("Descarga iniciada");
    expect(caption).toContain("Started Torrent");
    expect(caption).toContain("/downloads");
    expect(caption).not.toContain("magnet:?");
    const doc = entries.find(([k]) => k === "document")?.[1] as File;
    expect(await doc.text()).toBe(magnet);
  });

  it("sends completion summary without magnet", async () => {
    notifyDownloadCompleted({
      name: "Done Torrent",
      dir: "/data/dl",
      totalBytes: 1_500_000_000,
      files: 2,
      durationSec: 125,
      avgSpeedBytesPerSec: 12_000_000,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bot999:test-token/sendMessage");
    const body = JSON.parse(String(init?.body));
    expect(body.chat_id).toBe("-1001");
    expect(body.text).toContain("Done Torrent");
    expect(body.text).toContain("1.40 GB");
    expect(body.text).toContain("2 files");
    expect(body.text).not.toContain("magnet:?");
  });

  it("sends failure without magnet", async () => {
    notifyDownloadFailed({
      name: "Bad Torrent",
      dir: "/tmp",
      error: "timeout",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/sendMessage");
    const body = JSON.parse(String(init?.body));
    expect(body.text).toContain("Bad Torrent");
    expect(body.text).toContain("timeout");
    expect(body.text).not.toContain("magnet:?");
  });

  it("does nothing when Telegram is disabled", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    notifyDownloadStarted({ name: "x", magnet: "magnet:?xt=urn:btih:x" });
    notifyDownloadCompleted({
      name: "x",
      totalBytes: 1,
      durationSec: 1,
      avgSpeedBytesPerSec: 1,
    });
    notifyDownloadFailed({ name: "x", error: "fail" });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
