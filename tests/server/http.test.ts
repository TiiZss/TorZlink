import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { mkdtemp, rm, symlink, mkdir, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTorzlinkRuntime } from "../../src/core/runtime";
import { handleRequest } from "../../src/server/httpServer";
import { normalizeSearchQuery } from "../../src/server/searchAll";
import { parseCliArgs } from "../../src/cli/args";

function request(
  handler: http.RequestListener,
  method: string,
  urlPath: string,
  body?: string | Buffer,
  contentType = "application/json",
): Promise<{ status: number; json: unknown; text: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no addr"));
        return;
      }
      const req = http.request(
        {
          host: "127.0.0.1",
          port: addr.port,
          path: urlPath,
          method,
          headers: body
            ? { "content-type": contentType, "content-length": Buffer.byteLength(body) }
            : undefined,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            server.close();
            let json: unknown = null;
            try {
              json = JSON.parse(text);
            } catch {
              /* not json */
            }
            resolve({ status: res.statusCode ?? 0, json, text });
          });
        },
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (body) req.write(body);
      req.end();
    });
  });
}

describe("parseCliArgs serve", () => {
  it("parses serve defaults", () => {
    expect(parseCliArgs(["serve"])).toEqual({
      kind: "serve",
      host: "127.0.0.1",
      port: 8787,
    });
  });
  it("parses serve host and port", () => {
    expect(parseCliArgs(["serve", "--host", "0.0.0.0", "--port", "9000"])).toEqual({
      kind: "serve",
      host: "0.0.0.0",
      port: 9000,
    });
  });
  it("rejects bad port", () => {
    expect(parseCliArgs(["serve", "--port", "nope"])).toEqual({
      kind: "invalid",
      arg: "nope",
    });
  });
});

describe("normalizeSearchQuery", () => {
  it("trims and rejects empty / oversized", () => {
    expect(normalizeSearchQuery("  hi  ")).toBe("hi");
    expect(normalizeSearchQuery("")).toBeNull();
    expect(normalizeSearchQuery("x".repeat(201))).toBeNull();
  });
});

describe("HTTP API", () => {
  let stateDir: string;
  let publicDir: string;

  beforeEach(async () => {
    publicDir = path.resolve(process.cwd(), "web");
    stateDir = await mkdtemp(path.join(tmpdir(), "torzlink-http-"));
    process.env.TORZLINK_DISABLE_DOTENV = "1";
    process.env.TORZLINK_SKIP_UPDATE = "1";
    process.env.TORZLINK_STATE_DIR = stateDir;
    process.env.TORZLINK_DOWNLOAD_DIR = path.join(stateDir, "downloads");
    delete process.env.TORZLINK_SERVE_TOKEN;
    delete process.env.TORZLINK_NETWORK_MODE;
    delete process.env.TORZLINK_DEPLOY_ENV_FILE;
    delete process.env.TORZLINK_NETWORK_SWITCH_CMD;
  });

  afterEach(async () => {
    delete process.env.TORZLINK_SERVE_TOKEN;
    delete process.env.TORZLINK_STATE_DIR;
    delete process.env.TORZLINK_DOWNLOAD_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });

  it("health and downloads list", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const health = await request(handler, "GET", "/health");
      expect(health.status).toBe(200);
      expect(health.json).toMatchObject({ ok: true, mode: "serve" });

      const list = await request(handler, "GET", "/api/downloads");
      expect(list.status).toBe(200);
      expect(list.json).toEqual({ items: [] });
    } finally {
      runtime.dispose();
    }
  });

  it("gets and sets network mode preference", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const get = await request(handler, "GET", "/api/network");
      expect(get.status).toBe(200);
      expect(get.json).toMatchObject({ runtime: "direct", desired: expect.any(String) });

      const setVpn = await request(
        handler,
        "POST",
        "/api/network",
        JSON.stringify({ mode: "vpn" }),
      );
      expect(setVpn.status).toBe(200);
      expect(setVpn.json).toMatchObject({ ok: true, desired: "vpn" });

      const again = await request(handler, "GET", "/api/network");
      expect(again.json).toMatchObject({ desired: "vpn" });

      const bad = await request(
        handler,
        "POST",
        "/api/network",
        JSON.stringify({ mode: "nope" }),
      );
      expect(bad.status).toBe(400);
    } finally {
      runtime.dispose();
    }
  });

  it("rejects invalid magnet add", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const res = await request(
        handler,
        "POST",
        "/api/downloads",
        JSON.stringify({ input: "not-a-magnet" }),
      );
      expect(res.status).toBe(400);
    } finally {
      runtime.dispose();
    }
  });

  it("rejects invalid and oversized torrent uploads", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const bad = await request(
        handler,
        "POST",
        "/api/torrent",
        Buffer.from("not-a-torrent"),
        "application/x-bittorrent",
      );
      expect(bad.status).toBe(400);

      const huge = await request(
        handler,
        "POST",
        "/api/torrent",
        Buffer.alloc(2 * 1024 * 1024 + 1, 1),
        "application/x-bittorrent",
      );
      expect(huge.status).toBe(413);
    } finally {
      runtime.dispose();
    }
  });

  it("uploads a valid .torrent into the queue", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      // Minimal bencoded torrent (parse-torrent compatible).
      const torrent = Buffer.from(
        "ZDg6YW5ub3VuY2U0MDpodHRwOi8vdHJhY2tlci5leGFtcGxlLmNvbTo4MDgwL2Fubm91bmNlNDppbmZvZDY6bGVuZ3RoaTFlNDpuYW1lNDp0ZXN0MTI6cGllY2UgbGVuZ3RoaTE2Mzg0ZTY6cGllY2VzMjA6YWFhYWFhYWFhYWFhYWFhYWFhYWFlZQ==",
        "base64",
      );
      const add = await request(
        handler,
        "POST",
        "/api/torrent",
        torrent,
        "application/x-bittorrent",
      );
      expect(add.status).toBe(201);
      expect(add.json).toMatchObject({
        ok: true,
        id: "5593f95e1450b5791b9904e52c7ce511ea92e105",
        name: "test",
      });
      const list = await request(handler, "GET", "/api/downloads");
      expect(list.json).toMatchObject({
        items: [expect.objectContaining({ id: "5593f95e1450b5791b9904e52c7ce511ea92e105" })],
      });
    } finally {
      runtime.dispose();
    }
  });

  it("adds a sanitized infohash and cancels it", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const hash = "abcdef0123456789abcdef0123456789abcdef01";
      const add = await request(
        handler,
        "POST",
        "/api/downloads",
        JSON.stringify({ input: hash }),
      );
      expect(add.status).toBe(201);
      expect(add.json).toMatchObject({ ok: true, id: hash });

      const dup = await request(
        handler,
        "POST",
        "/api/downloads",
        JSON.stringify({ input: hash }),
      );
      expect(dup.status).toBe(409);
      expect(dup.json).toMatchObject({ ok: false, error: "already in queue", id: hash });

      const list = await request(handler, "GET", "/api/downloads");
      const items = (list.json as { items: { id: string }[] }).items;
      expect(items.map((i) => i.id)).toEqual([hash]);

      const cancel = await request(handler, "POST", `/api/downloads/${hash}/cancel`, "{}");
      expect(cancel.status).toBe(200);
      const list2 = await request(handler, "GET", "/api/downloads");
      expect((list2.json as { items: { id: string }[] }).items.map((i) => i.id)).not.toContain(hash);
    } finally {
      runtime.dispose();
    }
  });

  it("downloads to a per-item dir (relative under downloadDir)", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const hash = "fedcba9876543210fedcba9876543210fedcba98";
      const add = await request(
        handler,
        "POST",
        "/api/downloads",
        JSON.stringify({ input: hash, dir: "movies" }),
      );
      expect(add.status).toBe(201);
      const expectedDir = path.join(runtime.config.downloadDir, "movies");
      expect(add.json).toMatchObject({ ok: true, id: hash, dir: expectedDir });
      const list = await request(handler, "GET", "/api/downloads");
      expect((list.json as { items: { id: string; dir: string }[] }).items[0]).toMatchObject({
        id: hash,
        dir: expectedDir,
      });
      await request(handler, "POST", `/api/downloads/${hash}/cancel`, "{}");
    } finally {
      runtime.dispose();
    }
  });

  it("rejects per-item dir outside locked TORZLINK_DOWNLOAD_DIR", async () => {
    process.env.TORZLINK_DOWNLOAD_DIR = path.join(stateDir, "downloads");
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const hash = "11223344556677889900aabbccddeeff11223344";
      const outside = path.join(stateDir, "outside");
      const denied = await request(
        handler,
        "POST",
        "/api/downloads",
        JSON.stringify({ input: hash, dir: outside }),
      );
      expect(denied.status).toBe(403);
      const ok = await request(
        handler,
        "POST",
        "/api/downloads",
        JSON.stringify({ input: hash, dir: "sub" }),
      );
      expect(ok.status).toBe(201);
      expect((ok.json as { dir: string }).dir).toBe(
        await realpath(path.join(runtime.config.downloadDir, "sub")),
      );
      await request(handler, "POST", `/api/downloads/${hash}/cancel`, "{}");
    } finally {
      runtime.dispose();
      delete process.env.TORZLINK_DOWNLOAD_DIR;
    }
  });

  it("rejects per-item dir that escapes jail via symlink", async () => {
    const downloadRoot = path.join(stateDir, "downloads");
    const outside = path.join(stateDir, "outside-target");
    await mkdir(downloadRoot, { recursive: true });
    await mkdir(outside, { recursive: true });
    const linkPath = path.join(downloadRoot, "escape");
    try {
      await symlink(outside, linkPath, "dir");
    } catch {
      // Windows may require elevated privileges for symlinks.
      return;
    }
    process.env.TORZLINK_DOWNLOAD_DIR = downloadRoot;
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const hash = "aabbccddeeff00112233445566778899aabbccdd";
      const denied = await request(
        handler,
        "POST",
        "/api/downloads",
        JSON.stringify({ input: hash, dir: "escape" }),
      );
      expect(denied.status).toBe(403);
    } finally {
      runtime.dispose();
      delete process.env.TORZLINK_DOWNLOAD_DIR;
    }
  });

  it("requires Bearer when TORZLINK_SERVE_TOKEN is set", async () => {
    process.env.TORZLINK_SERVE_TOKEN = "test-secret-token";
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const denied = await request(handler, "GET", "/api/downloads");
      expect(denied.status).toBe(401);

      const authMeta = await request(handler, "GET", "/api/auth");
      expect(authMeta.json).toEqual({ required: true });

      const ok = await new Promise<{ status: number; json: unknown }>((resolve, reject) => {
        const server = http.createServer(handler);
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address();
          if (!addr || typeof addr === "string") {
            reject(new Error("no addr"));
            return;
          }
          const req = http.request(
            {
              host: "127.0.0.1",
              port: addr.port,
              path: "/api/downloads",
              method: "GET",
              headers: { Authorization: "Bearer test-secret-token" },
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on("data", (c) => chunks.push(c));
              res.on("end", () => {
                server.close();
                resolve({
                  status: res.statusCode ?? 0,
                  json: JSON.parse(Buffer.concat(chunks).toString("utf8")),
                });
              });
            },
          );
          req.on("error", (err) => {
            server.close();
            reject(err);
          });
          req.end();
        });
      });
      expect(ok.status).toBe(200);
    } finally {
      runtime.dispose();
      delete process.env.TORZLINK_SERVE_TOKEN;
    }
  });

  it("rejects static path escape to sibling dirs", async () => {
    const { resolvePublicPath } = await import("../../src/server/httpServer");
    const root = path.join(stateDir, "pub");
    expect(resolvePublicPath(root, "/../web-backup/secret")).toBeNull();
    expect(resolvePublicPath(root, "/index.html")).toBe(path.resolve(root, "index.html"));
  });

  it("serves the web UI index", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const res = await request(handler, "GET", "/");
      expect(res.status).toBe(200);
      expect(res.text).toContain("TorZlink");
    } finally {
      runtime.dispose();
    }
  });

  it("lists categories and empty history/seeds", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const cats = await request(handler, "GET", "/api/categories");
      expect(cats.status).toBe(200);
      expect(cats.json).toMatchObject({
        categories: expect.arrayContaining([
          expect.objectContaining({ key: "movies", group: "Movies" }),
        ]),
      });

      const history = await request(handler, "GET", "/api/history");
      expect(history.status).toBe(200);
      expect(history.json).toEqual({ items: [] });

      const seeds = await request(handler, "GET", "/api/seeds");
      expect(seeds.status).toBe(200);
      expect(seeds.json).toEqual({ items: [] });
    } finally {
      runtime.dispose();
    }
  });

  it("copies a magnet via /api/copy-magnet", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const hash = "abcdef0123456789abcdef0123456789abcdef01";
      const magnet = `magnet:?xt=urn:btih:${hash}&dn=Test`;
      const res = await request(
        handler,
        "POST",
        "/api/copy-magnet",
        JSON.stringify({ name: "Test", magnet, infoHash: hash }),
      );
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ ok: true });
      expect(JSON.stringify(res.json)).not.toMatch(/magnet:\?xt=/i);

      const bad = await request(
        handler,
        "POST",
        "/api/copy-magnet",
        JSON.stringify({ name: "x", magnet: "not-a-magnet" }),
      );
      expect(bad.status).toBe(400);
    } finally {
      runtime.dispose();
    }
  });

  it("gets and patches config (trackers + locked downloadDir)", async () => {
    // beforeEach sets TORZLINK_DOWNLOAD_DIR — keep it so we don't race other files on process.env.
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };

      const get = await request(handler, "GET", "/api/config");
      expect(get.status).toBe(200);
      const cfg = get.json as {
        downloadDir: string;
        trackers: string[];
        downloadDirLocked: boolean;
        unknownTrackerHosts: string[];
      };
      expect(cfg.downloadDir).toBeTruthy();
      expect(cfg.trackers).toEqual([]);
      expect(cfg.downloadDirLocked).toBe(true);
      expect(cfg.unknownTrackerHosts).toEqual([]);

      const tracker = "udp://tracker.opentrackr.org:1337/announce";
      const patch = await request(
        handler,
        "PATCH",
        "/api/config",
        JSON.stringify({ trackers: [tracker] }),
      );
      expect(patch.status).toBe(200);
      expect(patch.json).toMatchObject({
        ok: true,
        trackers: [tracker],
        downloadDirLocked: true,
      });

      const again = await request(handler, "GET", "/api/config");
      expect(again.json).toMatchObject({ trackers: [tracker] });

      const otherDir = path.join(stateDir, "other-downloads");
      const locked = await request(
        handler,
        "PATCH",
        "/api/config",
        JSON.stringify({ downloadDir: otherDir }),
      );
      expect(locked.status).toBe(409);
      expect(locked.json).toMatchObject({ downloadDirLocked: true });
      expect(runtime.config.downloadDir).toBe(cfg.downloadDir);
    } finally {
      runtime.dispose();
    }
  });

  it("restores history, redownloads, and clears", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const hash = "fedcba9876543210fedcba9876543210fedcba98";
      const magnet = `magnet:?xt=urn:btih:${hash}&dn=HistItem`;
      runtime.queue.restoreHistory([
        {
          id: hash,
          name: "HistItem",
          magnet,
          sizeBytes: 1000,
          dir: process.env.TORZLINK_DOWNLOAD_DIR!,
          completedAt: Date.now(),
        },
      ]);

      const list = await request(handler, "GET", "/api/history");
      expect(list.status).toBe(200);
      expect((list.json as { items: { id: string; magnet?: string }[] }).items).toHaveLength(1);
      expect((list.json as { items: { magnet?: string }[] }).items[0]?.magnet).toContain(hash);

      const redown = await request(handler, "POST", `/api/history/${hash}/redownload`, "{}");
      expect(redown.status).toBe(201);
      expect(redown.json).toMatchObject({
        ok: true,
        id: hash,
        dir: process.env.TORZLINK_DOWNLOAD_DIR,
      });

      const cancel = await request(handler, "POST", `/api/downloads/${hash}/cancel`, "{}");
      expect(cancel.status).toBe(200);

      const clear = await request(handler, "DELETE", "/api/history");
      expect(clear.status).toBe(200);
      const empty = await request(handler, "GET", "/api/history");
      expect(empty.json).toEqual({ items: [] });
    } finally {
      runtime.dispose();
    }
  });

  it("rejects history redownload when stored dir is outside locked root", async () => {
    const runtime = await createTorzlinkRuntime();
    try {
      const handler: http.RequestListener = (req, res) => {
        void handleRequest(req, res, runtime, publicDir);
      };
      const hash = "aabbccddeeff00112233445566778899aabbccdd";
      const outside = path.join(stateDir, "outside-hist");
      runtime.queue.restoreHistory([
        {
          id: hash,
          name: "Outside",
          magnet: `magnet:?xt=urn:btih:${hash}&dn=Outside`,
          sizeBytes: 1,
          dir: outside,
          completedAt: Date.now(),
        },
      ]);
      const denied = await request(handler, "POST", `/api/history/${hash}/redownload`, "{}");
      expect(denied.status).toBe(403);
    } finally {
      runtime.dispose();
    }
  });
});
