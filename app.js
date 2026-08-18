const PAGE_SIZE = 24;

const state = {
  mode: "public",
  scripts: [],
  stats: {},
  query: "",
  language: [],
  category: "all",
  collection: "all",
  showBackups: false,
  sort: "newest",
  visible: PAGE_SIZE,
  current: null,
  view: "home",
  featureIndex: 0,
  starred: new Set(JSON.parse(localStorage.getItem("dk-stars") || "[]")),
};

const els = {
  searchInput: document.getElementById("searchInput"),
  navSearchForm: document.getElementById("navSearchForm"),
  navLinks: document.getElementById("navLinks"),
  menuBtn: document.getElementById("menuBtn"),
  featureGrid: document.getElementById("featureGrid"),
  scriptGrid: document.getElementById("scriptGrid"),
  collectionGrid: document.getElementById("collectionGrid"),
  categoryNav: document.getElementById("categoryNav"),
  languageNav: document.getElementById("languageNav"),
  heroMeta: document.getElementById("heroMeta"),
  loadMore: document.getElementById("loadMore"),
  showBackups: document.getElementById("showBackups"),
  sortSelect: document.getElementById("sortSelect"),
  scriptCountPill: document.getElementById("scriptCountPill"),
  modalTitle: document.getElementById("modalTitle"),
  modalDesc: document.getElementById("modalDesc"),
  modalTags: document.getElementById("modalTags"),
  aboutText: document.getElementById("aboutText"),
  featureList: document.getElementById("featureList"),
  installSteps: document.getElementById("installSteps"),
  sourceBlock: document.getElementById("sourceBlock"),
  modalCode: document.getElementById("modalCode"),
  termPreview: document.getElementById("termPreview"),
  termTitle: document.getElementById("termTitle"),
  metaLanguage: document.getElementById("metaLanguage"),
  metaPlatform: document.getElementById("metaPlatform"),
  metaUpdated: document.getElementById("metaUpdated"),
  metaSize: document.getElementById("metaSize"),
  breadcrumb: document.getElementById("breadcrumb"),
  starBtn: document.getElementById("starBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  viewSourceBtn: document.getElementById("viewSourceBtn"),
  copyCodeBtn: document.getElementById("copyCodeBtn"),
  copyPathBtn: document.getElementById("copyPathBtn"),
  launchBtn: document.getElementById("launchBtn"),
  openBtn: document.getElementById("openBtn"),
  featPrev: document.getElementById("featPrev"),
  featNext: document.getElementById("featNext"),
  gridViewBtn: document.getElementById("gridViewBtn"),
  listViewBtn: document.getElementById("listViewBtn"),
};

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.getElementById("toasts").appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function displayPath(script) {
  return script.public_path || script.path;
}

function iconFor(script) {
  const blob = `${script.category} ${script.name} ${script.language}`.toLowerCase();
  if (blob.includes("adb") || blob.includes("android")) return { glyph: "▣", tone: "" };
  if (blob.includes("voice") || blob.includes("tts")) return { glyph: "≋", tone: "purple" };
  if (blob.includes("media") || blob.includes("player") || blob.includes("video")) return { glyph: "▶", tone: "blue" };
  if (blob.includes("chat") || blob.includes("agent") || blob.includes("ai")) return { glyph: "◉", tone: "purple" };
  if (blob.includes("window") || blob.includes("desktop") || blob.includes("clean")) return { glyph: "▢", tone: "blue" };
  return { glyph: "</>", tone: "" };
}

function isChromecast(script) {
  const blob = `${script.name} ${script.stem} ${script.path || ""}`.toLowerCase();
  return blob.includes("chromecast") || blob.includes("cromcast");
}

function chromecastScript() {
  return state.scripts.find((item) => isChromecast(item) && !item.backup);
}

function tagsFor(script) {
  const tags = [script.language, script.category];
  if (!script.backup) tags.push("Open Source");
  return tags.filter(Boolean).slice(0, 4);
}

function filteredScripts() {
  const query = state.query.trim().toLowerCase();
  const items = state.scripts.filter((script) => {
    if (!state.showBackups && script.backup) return false;
    if (state.language.length && !state.language.includes(script.language)) return false;
    if (state.category !== "all" && script.category !== state.category) return false;
    if (state.collection !== "all" && script.collection !== state.collection) return false;
    if (!query) return true;
    return [
      script.name, script.stem, displayPath(script), script.folder,
      script.description, script.language, script.category, script.collection,
    ].join(" ").toLowerCase().includes(query);
  });
  items.sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name);
    if (state.sort === "language") return a.language.localeCompare(b.language) || a.name.localeCompare(b.name);
    return (b.mtime || 0) - (a.mtime || 0);
  });
  return items;
}

function featuredPool() {
  return filteredScripts().filter((item) => !item.backup);
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach((node) => {
    node.classList.toggle("hidden", node.id !== `view-${view}`);
  });
  document.querySelectorAll("[data-nav]").forEach((node) => {
    node.classList.toggle("active", node.dataset.nav === view);
  });
  els.navLinks.classList.remove("open");
  if (view === "browse") renderBrowse();
  if (view === "collections") renderCollections();
  if (view === "home") renderFeatured();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showScript(id) {
  const script = state.scripts.find((item) => item.id === id);
  if (!script) {
    toast("Script not found");
    return;
  }
  if (state.mode === "local") {
    openLocalDetail(id);
    return;
  }
  fillDetail(script);
}

async function openLocalDetail(id) {
  const response = await fetch(`/api/script?id=${encodeURIComponent(id)}`);
  const script = await response.json();
  if (!response.ok) {
    toast(script.error || "Could not open script");
    return;
  }
  fillDetail(script);
}

function installSteps(script) {
  const name = script.name;
  if (isChromecast(script)) {
    return [
      "Download <code>DK-Chromecast-Remote.zip</code> — that is the actual remote app",
      "Install Python 3.10+ then <code>pip install PySide6 androidtvremote2</code>",
      "Run <code>OPEN_TV_REMOTE.bat</code> or <code>pythonw CHROMECAST_NEST_REMOTE.pyw</code>",
    ];
  }
  if (script.language === "Python") {
    return ["Download the script", `Run <code>python "${name}"</code>`, "Edit any paths at the top of the file if needed"];
  }
  if (script.language === "PowerShell") {
    return [
      "Download the script",
      "Run PowerShell as Administrator",
      `Execute the script: <code>powershell -ExecutionPolicy Bypass -File "${name}"</code>`,
    ];
  }
  if (script.language === "Batch") {
    return ["Download the script", `Double-click <code>${name}</code> or run it from Command Prompt`];
  }
  if (script.language === "AutoHotkey") {
    return ["Install AutoHotkey v2", `Open <code>${name}</code> with AutoHotkey`];
  }
  return ["Download the file", "Open it with the matching runtime for this language"];
}

function featureBullets(script) {
  return [
    script.language ? `${script.language} source` : "Local source file",
    script.collection ? `From ${script.collection}` : "From the DK catalog",
    `${script.category} workflow`,
    "Works as a local automation script",
    script.lines ? `${script.lines}+ lines in this preview` : "Preview available",
  ];
}

function fillDetail(script) {
  state.current = script;
  const desc = script.description || "No header description in this file.";
  els.modalTitle.textContent = (script.stem || script.name).toUpperCase();
  els.modalDesc.textContent = desc;
  els.aboutText.textContent = desc;
  els.modalTags.innerHTML = tagsFor(script).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  els.featureList.innerHTML = featureBullets(script).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  els.installSteps.innerHTML = installSteps(script).map((item) => `<li>${item}</li>`).join("");
  els.modalCode.textContent = script.content || script.preview || "";
  els.termPreview.textContent = script.preview || script.content || "";
  els.termTitle.textContent = script.name;
  els.metaLanguage.textContent = script.language;
  els.metaPlatform.textContent = /android|adb/i.test(`${script.category} ${script.name}`) ? "Android / Windows" : "Windows 10/11";
  els.metaUpdated.textContent = (script.modified || "").split(" ")[0] || "—";
  els.metaSize.textContent = script.size_label;
  els.breadcrumb.innerHTML = `<a href="#browse" data-nav="browse">Browse</a> &nbsp;&gt;&nbsp; ${escapeHtml(script.category)} &nbsp;&gt;&nbsp; ${escapeHtml(script.stem || script.name)}`;
  els.starBtn.classList.toggle("on", state.starred.has(script.id));
  els.starBtn.textContent = state.starred.has(script.id) ? "★" : "☆";
  const art = document.querySelector(".detail-art");
  if (art) {
    if (!art.dataset.default) art.dataset.default = art.innerHTML;
    art.innerHTML = isChromecast(script)
      ? `<img src="assets/chromecast-app-remote.png?v=8" alt="DK Chromecast Remote">`
      : art.dataset.default;
  }
  showTab("install");
  setView("detail");
  history.replaceState(null, "", `#script/${script.id}`);
}

function showTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  els.installSteps.classList.toggle("hidden", name !== "install");
  els.sourceBlock.classList.toggle("hidden", name !== "source");
}

function cardHtml(script, featured) {
  const icon = iconFor(script);
  const tags = tagsFor(script).filter((tag) => tag !== "Open Source").slice(0, 3)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const date = (script.modified || "").split(" ")[0] || "";
  const visual = isChromecast(script)
    ? `<img src="assets/chromecast-app-remote.png?v=8" alt="">`
    : `<div class="card-icon ${icon.tone}">${icon.glyph}</div>`;
  return `
    <article class="card ${isChromecast(script) ? "card-remote" : ""}" data-id="${script.id}">
      ${visual}
      <h3>${escapeHtml(isChromecast(script) ? "CHROMECAST REMOTE" : (script.stem || script.name).toUpperCase())}</h3>
      <p>${escapeHtml(isChromecast(script) ? "The actual desktop remote you download — restored full clicker, no window frame." : (script.description || "No description found in the file header."))}</p>
      <div class="tag-row">${tags}</div>
      <div class="card-foot">
        ${featured ? "<span></span>" : `<span class="date">${escapeHtml(date)}</span><span>↓</span>`}
      </div>
    </article>
  `;
}

function renderFeatured() {
  const pool = featuredPool();
  const pinned = chromecastScript();
  const rest = pool.filter((item) => !pinned || item.id !== pinned.id);
  const ordered = pinned ? [pinned, ...rest] : rest;
  if (!ordered.length) {
    els.featureGrid.innerHTML = "";
    return;
  }
  const count = Math.min(3, ordered.length);
  const start = pinned ? 0 : ((state.featureIndex % ordered.length) + ordered.length) % ordered.length;
  const picks = Array.from({ length: count }, (_, i) => ordered[(start + i) % ordered.length]);
  if (pinned && !picks.includes(pinned)) {
    picks[0] = pinned;
  }
  els.featureGrid.innerHTML = picks.map((script) => cardHtml(script, true)).join("");
}

function renderFilters() {
  const cats = [["all", "All Categories"], ...Object.keys(state.stats.categories || {}).map((name) => [name, name])];
  const langs = Object.keys(state.stats.languages || {});
  els.categoryNav.innerHTML = cats.map(([value, label]) =>
    `<button data-key="category" data-value="${escapeHtml(value)}" class="${state.category === value ? "active" : ""}">${escapeHtml(label)}</button>`
  ).join("");
  els.languageNav.innerHTML = langs.map((name) =>
    `<button data-lang="${escapeHtml(name)}" class="${state.language.includes(name) ? "active" : ""}">${escapeHtml(name)}</button>`
  ).join("");
}

function renderBrowse() {
  renderFilters();
  const items = filteredScripts();
  const slice = items.slice(0, state.visible);
  els.heroMeta.textContent = `${items.length} script${items.length === 1 ? "" : "s"}`;
  els.scriptGrid.innerHTML = slice.length
    ? slice.map((script) => cardHtml(script, false)).join("")
    : `<div class="panel" style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted)">No scripts match that filter.</div>`;
  els.loadMore.hidden = slice.length >= items.length;
}

function renderCollections() {
  const counts = state.stats.collections || {};
  els.collectionGrid.innerHTML = Object.entries(counts).map(([name, count]) => `
    <article class="card collection-card" data-collection="${escapeHtml(name)}">
      <h3>${escapeHtml(name)}</h3>
      <p>${count} script${count === 1 ? "" : "s"}</p>
      <div class="card-foot"><span>Browse →</span></div>
    </article>
  `).join("");
}

function applyCatalog(data, mode) {
  state.mode = mode;
  state.scripts = data.scripts || [];
  state.stats = data.stats || {};
  document.body.classList.toggle("public-mode", mode === "public");
  const total = state.stats.total || state.scripts.length;
  els.scriptCountPill.textContent = `${total}+ Scripts`;
  renderFeatured();
  const hash = location.hash.replace("#", "");
  if (hash.startsWith("script/")) showScript(hash.slice(7));
  else if (["browse", "collections", "about"].includes(hash)) setView(hash);
  else setView("home");
}

async function loadScripts() {
  try {
    const health = await fetch("/api/health", { cache: "no-store" });
    if (health.ok) {
      applyCatalog(await (await fetch("/api/scripts", { cache: "no-store" })).json(), "local");
      return;
    }
  } catch (_error) {
    // public host
  }
  const response = await fetch("./data/scripts.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the public catalog");
  applyCatalog(await response.json(), "public");
}

function downloadCurrent() {
  if (!state.current) return;
  const link = document.createElement("a");
  if (isChromecast(state.current)) {
    link.href = "downloads/DK-Chromecast-Remote.zip";
    link.download = "DK-Chromecast-Remote.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast("Downloaded the actual Chromecast Remote app");
    return;
  }
  const text = state.current.content || state.current.preview || "";
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = state.current.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast(`Downloaded ${state.current.name}`);
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

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    if (nav.dataset.nav === "browse") {
      state.collection = "all";
      state.visible = PAGE_SIZE;
    }
    setView(nav.dataset.nav);
    history.replaceState(null, "", `#${nav.dataset.nav}`);
    return;
  }
  const filterBtn = event.target.closest(".filters button[data-key]");
  if (filterBtn) {
    state[filterBtn.dataset.key] = filterBtn.dataset.value;
    state.visible = PAGE_SIZE;
    renderBrowse();
    return;
  }
  const langBtn = event.target.closest(".filters button[data-lang]");
  if (langBtn) {
    const lang = langBtn.dataset.lang;
    if (state.language.includes(lang)) state.language = state.language.filter((item) => item !== lang);
    else state.language = [...state.language, lang];
    state.visible = PAGE_SIZE;
    renderBrowse();
    return;
  }
  const collection = event.target.closest("[data-collection]");
  if (collection) {
    state.collection = collection.dataset.collection;
    state.visible = PAGE_SIZE;
    setView("browse");
    history.replaceState(null, "", "#browse");
    return;
  }
  const card = event.target.closest(".card[data-id]");
  if (card) showScript(card.dataset.id);
});

els.menuBtn.addEventListener("click", () => els.navLinks.classList.toggle("open"));
els.navSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = els.searchInput.value;
  state.visible = PAGE_SIZE;
  setView("browse");
  history.replaceState(null, "", "#browse");
});
els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  if (state.view === "browse") {
    state.visible = PAGE_SIZE;
    renderBrowse();
  }
});
els.showBackups.addEventListener("change", (event) => {
  state.showBackups = event.target.checked;
  state.visible = PAGE_SIZE;
  renderBrowse();
});
els.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderBrowse();
});
els.loadMore.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderBrowse();
});
els.featPrev.addEventListener("click", () => {
  state.featureIndex -= 1;
  renderFeatured();
});
els.featNext.addEventListener("click", () => {
  state.featureIndex += 1;
  renderFeatured();
});
els.gridViewBtn.addEventListener("click", () => {
  document.body.classList.remove("list-view");
  els.gridViewBtn.classList.add("active");
  els.listViewBtn.classList.remove("active");
});
els.listViewBtn.addEventListener("click", () => {
  document.body.classList.add("list-view");
  els.listViewBtn.classList.add("active");
  els.gridViewBtn.classList.remove("active");
});
els.starBtn.addEventListener("click", () => {
  if (!state.current) return;
  if (state.starred.has(state.current.id)) state.starred.delete(state.current.id);
  else state.starred.add(state.current.id);
  localStorage.setItem("dk-stars", JSON.stringify([...state.starred]));
  els.starBtn.classList.toggle("on", state.starred.has(state.current.id));
  els.starBtn.textContent = state.starred.has(state.current.id) ? "★" : "☆";
});
els.downloadBtn.addEventListener("click", downloadCurrent);
els.viewSourceBtn.addEventListener("click", () => {
  showTab("source");
  document.getElementById("sourcePanel").scrollIntoView({ behavior: "smooth" });
});
els.copyCodeBtn.addEventListener("click", async () => {
  if (!state.current) return;
  await navigator.clipboard.writeText(state.current.content || state.current.preview || "");
  toast("Code copied");
});
els.copyPathBtn.addEventListener("click", async () => {
  if (!state.current) return;
  await navigator.clipboard.writeText(displayPath(state.current));
  toast("Path copied");
});
els.launchBtn.addEventListener("click", () => postAction("/api/launch", "Launched script"));
els.openBtn.addEventListener("click", () => postAction("/api/open", "Opened in Explorer"));
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
});
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    els.searchInput.focus();
  }
});

loadScripts().catch((error) => toast(error.message));
