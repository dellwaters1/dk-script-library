const PAGE_SIZE = 72;

const state = {
  mode: "public",
  scripts: [],
  stats: {},
  scannedAt: null,
  durationMs: 0,
  query: "",
  language: "all",
  category: "all",
  collection: "all",
  showBackups: false,
  visible: PAGE_SIZE,
  current: null,
};

const els = {
  searchInput: document.getElementById("searchInput"),
  statusText: document.getElementById("statusText"),
  brandSub: document.getElementById("brandSub"),
  heroMeta: document.getElementById("heroMeta"),
  statRow: document.getElementById("statRow"),
  languageNav: document.getElementById("languageNav"),
  categoryNav: document.getElementById("categoryNav"),
  collectionNav: document.getElementById("collectionNav"),
  scriptGrid: document.getElementById("scriptGrid"),
  loadMore: document.getElementById("loadMore"),
  showBackups: document.getElementById("showBackups"),
  refreshBtn: document.getElementById("refreshBtn"),
  viewToggle: document.getElementById("viewToggle"),
  detailModal: document.getElementById("detailModal"),
  closeModal: document.getElementById("closeModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalMeta: document.getElementById("modalMeta"),
  modalDesc: document.getElementById("modalDesc"),
  modalPath: document.getElementById("modalPath"),
  modalSize: document.getElementById("modalSize"),
  modalCode: document.getElementById("modalCode"),
  launchBtn: document.getElementById("launchBtn"),
  openBtn: document.getElementById("openBtn"),
  copyPathBtn: document.getElementById("copyPathBtn"),
  copyCodeBtn: document.getElementById("copyCodeBtn"),
};

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.getElementById("toasts").appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chipClass(language) {
  return language.toLowerCase().replaceAll(" ", "").replace("&", "");
}

function displayPath(script) {
  return script.public_path || script.path;
}

function filteredScripts() {
  const query = state.query.trim().toLowerCase();
  return state.scripts.filter((script) => {
    if (!state.showBackups && script.backup) return false;
    if (state.language !== "all" && script.language !== state.language) return false;
    if (state.category !== "all" && script.category !== state.category) return false;
    if (state.collection !== "all" && script.collection !== state.collection) return false;
    if (!query) return true;
    const hay = [
      script.name,
      script.stem,
      displayPath(script),
      script.folder,
      script.description,
      script.language,
      script.category,
      script.collection,
    ].join(" ").toLowerCase();
    return hay.includes(query);
  });
}

function renderNav(container, items, current, key) {
  const entries = [["all", state.scripts.filter((s) => state.showBackups || !s.backup).length], ...Object.entries(items || {})];
  container.innerHTML = entries.map(([label, count]) => `
    <button data-key="${key}" data-value="${escapeHtml(label)}" class="${current === label ? "active" : ""}">
      <span>${label === "all" ? "All" : escapeHtml(label)}</span>
      <span class="count">${count}</span>
    </button>
  `).join("");
}

function renderSidebar() {
  renderNav(els.languageNav, state.stats.languages, state.language, "language");
  renderNav(els.categoryNav, state.stats.categories, state.category, "category");
  renderNav(els.collectionNav, state.stats.collections, state.collection, "collection");
}

function renderStats(visibleCount) {
  const languages = Object.keys(state.stats.languages || {}).length;
  els.statRow.innerHTML = `
    <div class="stat"><b>${state.stats.total || 0}</b><span>indexed</span></div>
    <div class="stat"><b>${visibleCount}</b><span>showing</span></div>
    <div class="stat"><b>${languages}</b><span>languages</span></div>
  `;
}

function renderGrid() {
  const items = filteredScripts();
  const slice = items.slice(0, state.visible);
  els.heroMeta.textContent = state.scannedAt
    ? `${items.length} match${items.length === 1 ? "" : "es"} · updated ${state.scannedAt.replace("T", " ").replace("Z", " UTC")}`
    : "Loading catalog...";
  renderStats(items.length);

  if (!slice.length) {
    els.scriptGrid.innerHTML = `
      <div class="empty glass">
        <h3>No scripts match that filter</h3>
        <p>Try another language, turn on backups, or clear search.</p>
      </div>`;
    els.loadMore.hidden = true;
    return;
  }

  els.scriptGrid.innerHTML = slice.map((script) => `
    <article class="card glass" data-id="${script.id}">
      <div class="card-top">
        <div>
          <h3>${escapeHtml(script.stem || script.name)}</h3>
          <div class="path" title="${escapeHtml(displayPath(script))}">${escapeHtml(displayPath(script))}</div>
        </div>
        <span class="chip ${chipClass(script.language)}">${escapeHtml(script.language)}</span>
      </div>
      <p class="desc">${escapeHtml(script.description || "No description found in the file header.")}</p>
      <div class="preview">${escapeHtml(script.preview || "")}</div>
      <div class="card-foot">
        <span class="meta-mini">${escapeHtml(script.category)} · ${escapeHtml(script.folder)}</span>
        <span class="meta-mini">${escapeHtml(script.size_label)} · ${escapeHtml(script.modified)}</span>
      </div>
    </article>
  `).join("");
  els.loadMore.hidden = slice.length >= items.length;
}

function renderAll() {
  renderSidebar();
  renderGrid();
}

function applyCatalog(data, mode) {
  state.mode = mode;
  state.scripts = data.scripts || [];
  state.stats = data.stats || {};
  state.scannedAt = data.scanned_at;
  state.durationMs = data.duration_ms || 0;
  document.body.classList.toggle("public-mode", mode === "public");
  els.brandSub.textContent = mode === "local"
    ? "Local live catalog · dark neon glass"
    : "Public neon catalog of local automations";
  els.statusText.textContent = `${state.stats.total || 0} scripts online`;
  renderAll();
}

async function loadScripts() {
  try {
    const health = await fetch("/api/health", { cache: "no-store" });
    if (health.ok) {
      const response = await fetch("/api/scripts", { cache: "no-store" });
      applyCatalog(await response.json(), "local");
      return;
    }
  } catch (_error) {
    // Static public host — fall through to bundled catalog.
  }
  const response = await fetch("./data/scripts.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the public catalog");
  applyCatalog(await response.json(), "public");
}

async function refresh() {
  if (state.mode !== "local") return;
  els.statusText.textContent = "Rescanning...";
  els.refreshBtn.disabled = true;
  try {
    const response = await fetch("/api/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Refresh failed");
    await loadScripts();
    toast(`Rescanned ${data.stats.total} scripts`);
  } catch (error) {
    toast(error.message);
  } finally {
    els.refreshBtn.disabled = false;
  }
}

function fillModal(script) {
  state.current = script;
  els.modalTitle.textContent = script.name;
  els.modalMeta.textContent = `${script.language} · ${script.category} · ${script.collection}`;
  els.modalDesc.textContent = script.description || "No header description in this file.";
  els.modalPath.textContent = displayPath(script);
  els.modalSize.textContent = `${script.size_label} · ${script.lines || 0} lines${script.truncated ? " · preview" : ""}`;
  els.modalCode.className = `hljs language-${script.highlight}`;
  els.modalCode.textContent = script.content || script.preview || "";
  if (window.hljs) window.hljs.highlightElement(els.modalCode);
  els.detailModal.classList.add("open");
}

async function openDetail(id) {
  if (state.mode === "public") {
    const script = state.scripts.find((item) => item.id === id);
    if (!script) {
      toast("Script not found");
      return;
    }
    fillModal(script);
    return;
  }
  const response = await fetch(`/api/script?id=${encodeURIComponent(id)}`);
  const script = await response.json();
  if (!response.ok) {
    toast(script.error || "Could not open script");
    return;
  }
  fillModal(script);
}

async function postAction(url, okMessage) {
  if (!state.current || state.mode !== "local") return;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: state.current.id }),
  });
  const data = await response.json();
  if (!response.ok) {
    toast(data.error || "Action failed");
    return;
  }
  toast(okMessage);
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.visible = PAGE_SIZE;
  renderGrid();
});

document.addEventListener("click", (event) => {
  const navBtn = event.target.closest("aside button[data-key]");
  if (navBtn) {
    state[navBtn.dataset.key] = navBtn.dataset.value;
    state.visible = PAGE_SIZE;
    renderAll();
    return;
  }
  const card = event.target.closest(".card[data-id]");
  if (card) openDetail(card.dataset.id);
});

els.showBackups.addEventListener("change", (event) => {
  state.showBackups = event.target.checked;
  state.visible = PAGE_SIZE;
  renderAll();
});

els.loadMore.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderGrid();
});

els.refreshBtn.addEventListener("click", refresh);
els.viewToggle.addEventListener("click", () => {
  document.body.classList.toggle("list-view");
});
els.closeModal.addEventListener("click", () => els.detailModal.classList.remove("open"));
els.detailModal.addEventListener("click", (event) => {
  if (event.target === els.detailModal) els.detailModal.classList.remove("open");
});
els.openBtn.addEventListener("click", () => postAction("/api/open", "Opened in Explorer"));
els.launchBtn.addEventListener("click", () => postAction("/api/launch", "Launched script"));
els.copyPathBtn.addEventListener("click", async () => {
  if (!state.current) return;
  await navigator.clipboard.writeText(displayPath(state.current));
  toast("Path copied");
});
els.copyCodeBtn.addEventListener("click", async () => {
  if (!state.current) return;
  await navigator.clipboard.writeText(state.current.content || state.current.preview || "");
  toast("Code copied");
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    els.searchInput.focus();
  }
  if (event.key === "Escape") els.detailModal.classList.remove("open");
});

loadScripts().catch((error) => {
  els.statusText.textContent = "Failed to load";
  toast(error.message);
});
