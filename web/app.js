const TOKEN_KEY = "torzlinkServeToken";

/** Mirror of src/ui/lib/theme.ts SOURCE_STYLE + COLOR */
const SOURCE_STYLE = {
  fitgirl: { tag: "FG", color: "#38bdf8" },
  yts: { tag: "YTS", color: "#86d6a2" },
  eztv: { tag: "EZTV", color: "#f0c560" },
  nyaa: { tag: "NYAA", color: "#7dd3fc" },
  subsplease: { tag: "SUB", color: "#6eb5e8" },
  "tpb-movies": { tag: "TPB", color: "#5fd0c5" },
  "tpb-tv": { tag: "TPB", color: "#5fd0c5" },
  "x1337-movies": { tag: "1337", color: "#f6a55c" },
  "x1337-tv": { tag: "1337", color: "#f6a55c" },
};

const resultsEl = document.getElementById("results");
const queueEl = document.getElementById("queue");
const searchStatus = document.getElementById("search-status");
const searchForm = document.getElementById("search-form");
const magnetForm = document.getElementById("magnet-form");
const authGate = document.getElementById("auth-gate");
const authForm = document.getElementById("auth-form");
const mainLayout = document.getElementById("main");
const netSwitch = document.getElementById("net-switch");
const netSwitchState = document.getElementById("net-switch-state");
const netStatusEl = document.getElementById("net-status");
const brandModeLabel = document.getElementById("brand-mode-label");
let currentNetMode = "direct";

function sourceStyle(id) {
  return SOURCE_STYLE[id] || { tag: "•", color: "#6eb5e8" };
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function setToken(t) {
  if (t) sessionStorage.setItem(TOKEN_KEY, t);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

function formatSpeed(n) {
  if (!n) return "0 B/s";
  return `${formatBytes(n)}/s`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function api(path, options) {
  const headers = { "content-type": "application/json", ...options?.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setToken("");
    showAuth(true);
    throw new Error("Token requerido o inválido");
  }
  if (!res.ok) throw new Error(data.error || res.statusText || "request failed");
  return data;
}

function setStatus(text) {
  if (!text) {
    searchStatus.hidden = true;
    searchStatus.textContent = "";
    return;
  }
  searchStatus.hidden = false;
  searchStatus.textContent = `❯ ${text}`;
}

function showAuth(needed) {
  if (!authGate || !mainLayout) return;
  authGate.hidden = !needed;
  mainLayout.hidden = needed;
}

async function bootAuth() {
  const meta = await fetch("/api/auth").then((r) => r.json()).catch(() => ({ required: false }));
  if (!meta.required) {
    showAuth(false);
    return true;
  }
  if (getToken()) {
    try {
      await api("/api/downloads");
      showAuth(false);
      return true;
    } catch {
      /* need prompt */
    }
  }
  showAuth(true);
  return false;
}

function paintNetSwitch(vpn) {
  if (netSwitch) {
    netSwitch.setAttribute("aria-checked", vpn ? "true" : "false");
    netSwitch.title = vpn
      ? "VPN ON — clic para apagar (red del NAS)"
      : "VPN OFF — clic para encender (Gluetun)";
  }
  if (netSwitchState) {
    netSwitchState.textContent = vpn ? "ON" : "OFF";
    netSwitchState.classList.toggle("is-on", vpn);
    netSwitchState.classList.toggle("is-off", !vpn);
  }
  if (brandModeLabel) {
    brandModeLabel.textContent = vpn ? "vpn" : "lan";
  }
}

function paintNetStatus(status) {
  if (!netStatusEl) return;
  if (status.hint) {
    netStatusEl.hidden = false;
    netStatusEl.textContent = `❯ ${status.hint}`;
    netStatusEl.classList.toggle("ok", Boolean(status.applied));
    return;
  }
  if (!status.applied && status.desired !== status.runtime) {
    netStatusEl.hidden = false;
    netStatusEl.textContent = `❯ preferencia ${status.desired} — runtime actual: ${status.runtime}`;
    netStatusEl.classList.remove("ok");
    return;
  }
  netStatusEl.hidden = true;
  netStatusEl.textContent = "";
}

function paintNetwork(status) {
  const mode = status.desired || status.runtime || "direct";
  currentNetMode = mode;
  paintNetSwitch(mode === "vpn");
  paintNetStatus(status);
}

async function refreshNetwork() {
  try {
    const status = await api("/api/network");
    paintNetwork(status);
  } catch {
    /* auth gate / offline */
  }
}

async function setNetworkMode(mode) {
  if (netSwitch) netSwitch.disabled = true;
  try {
    const status = await api("/api/network", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
    paintNetwork(status);
  } catch (err) {
    paintNetwork({ desired: currentNetMode, runtime: currentNetMode, applied: true });
    if (netStatusEl) {
      netStatusEl.hidden = false;
      netStatusEl.textContent = `❯ ${err.message || "no se pudo cambiar el modo"}`;
      netStatusEl.classList.remove("ok");
    }
  } finally {
    if (netSwitch) netSwitch.disabled = false;
  }
}

netSwitch?.addEventListener("click", () => {
  void setNetworkMode(currentNetMode === "vpn" ? "direct" : "vpn");
});

authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rawToken = new FormData(authForm).get("token");
  const t = typeof rawToken === "string" ? rawToken.trim() : "";
  setToken(t);
  try {
    await api("/api/downloads");
    showAuth(false);
    await refreshNetwork();
    await refreshQueue();
  } catch (err) {
    alert(err.message || "Token inválido");
  }
});

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rawQ = new FormData(searchForm).get("q");
  const q = typeof rawQ === "string" ? rawQ.trim() : "";
  if (!q) return;
  setStatus("buscando…");
  resultsEl.innerHTML = "";
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
    const errN = data.errors?.length || 0;
    setStatus(
      `${data.results.length} resultados` + (errN ? ` · ${errN} fuente(s) con error` : ""),
    );
    if (!data.results.length) {
      resultsEl.innerHTML = `<li class="empty">· sin resultados</li>`;
      return;
    }
    resultsEl.innerHTML = data.results
      .map((r) => {
        const ss = sourceStyle(r.source);
        const payload = encodeURIComponent(
          JSON.stringify({
            id: r.infoHash,
            name: r.name,
            magnet: r.magnet,
            source: r.source,
            sizeBytes: r.sizeBytes,
          }),
        );
        return `
      <li class="card card--result">
        <div class="card-title"><span class="pointer">❯</span>${escapeHtml(r.name)}</div>
        <div class="meta">
          <span class="badge src" style="--src:${ss.color}">${escapeHtml(ss.tag)}</span>
          <span>${formatBytes(r.sizeBytes)}</span>
          <span class="seeds">↑${r.seeders}</span>
          <span class="leech">↓${r.leechers}</span>
        </div>
        <div class="actions">
          <button type="button" data-download="${payload}">Descargar</button>
        </div>
      </li>`;
      })
      .join("");
  } catch (err) {
    setStatus(err.message || "error de búsqueda");
  }
});

resultsEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-download]");
  if (!btn) return;
  try {
    const payload = JSON.parse(decodeURIComponent(btn.dataset.download || ""));
    btn.disabled = true;
    await api("/api/downloads", { method: "POST", body: JSON.stringify(payload) });
    btn.textContent = "en cola";
    await refreshQueue();
  } catch (err) {
    alert(err.message || "No se pudo añadir");
    btn.disabled = false;
  }
});

magnetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rawMagnet = new FormData(magnetForm).get("magnet");
  const input = typeof rawMagnet === "string" ? rawMagnet.trim() : "";
  if (!input) return;
  try {
    await api("/api/downloads", { method: "POST", body: JSON.stringify({ input }) });
    magnetForm.reset();
    await refreshQueue();
  } catch (err) {
    alert(err.message || "Magnet inválido");
  }
});

queueEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  try {
    await api(`/api/downloads/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      body: "{}",
    });
    await refreshQueue();
  } catch (err) {
    alert(err.message || "Acción fallida");
  }
});

async function refreshQueue() {
  try {
    const data = await api("/api/downloads");
    const items = data.items || [];
    if (!items.length) {
      queueEl.innerHTML = `<li class="empty">· cola vacía</li>`;
      return;
    }
    queueEl.innerHTML = items
      .map((it) => {
        const pct = Math.round((it.progress || 0) * 100);
        const pauseLabel = it.status === "paused" ? "Reanudar" : "Pausar";
        const pauseAction = it.status === "paused" ? "resume" : "pause";
        const canPause = it.status === "downloading" || it.status === "paused";
        let icon = "↓";
        if (it.status === "completed") icon = "✓";
        else if (it.status === "failed") icon = "✗";
        else if (it.status === "paused") icon = "⏸";
        return `
        <li class="card">
          <div class="card-title"><span class="pointer">${icon}</span>${escapeHtml(it.name)}</div>
          <div class="meta">
            <span class="badge ${escapeHtml(it.status)}">${escapeHtml(it.status)}</span>
            <span>${pct}%</span>
            <span>${formatBytes(it.downloadedBytes)} / ${formatBytes(it.totalBytes)}</span>
            <span>${formatSpeed(it.speed)}</span>
            <span>• ${it.peers || 0}</span>
          </div>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <div class="actions">
            ${
              canPause
                ? `<button type="button" class="secondary" data-action="${pauseAction}" data-id="${escapeHtml(it.id)}">${pauseLabel}</button>`
                : ""
            }
            <button type="button" class="danger" data-action="cancel" data-id="${escapeHtml(it.id)}">Cancelar</button>
          </div>
        </li>`;
      })
      .join("");
  } catch (err) {
    queueEl.innerHTML = `<li class="empty">✗ ${escapeHtml(err.message || "error de cola")}</li>`;
  }
}

const ok = await bootAuth();
if (ok) {
  await refreshNetwork();
  await refreshQueue();
  setInterval(refreshQueue, 1000);
}
