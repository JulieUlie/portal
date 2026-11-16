// Web apps portal. All content comes from apps.json: adding an app = adding one object.
// Search, filter, language and the chosen app live in the URL (?q=…&cat=…&lang=nl#slug), so links can be shared.
// English is the default; Dutch is an option (remembered per visitor).
(() => {
  const $ = (s) => document.querySelector(s);
  const grid = $("#grid"), cats = $("#cats"), sortBtn = $("#sort");
  const count = $("#count"), empty = $("#empty"), dlg = $("#dlg");

  // ---------- Interface texts ----------
  const UI = {
    en: {
      brand: "Web apps", title: "Pick an app",
      lead: "Everything I build and host, in one place. Every app runs right in your browser, nothing to install.",
      controls: "Search and filter", searchLabel: "Search for an app", searchPh: "Search apps",
      category: "Category", all: "All", sortLabel: "Sort", sortUpdated: "Recently updated", sortName: "Name (A–Z)",
      empty: "No apps found. Try another word or show", emptyAll: "Show all",
      footer: "Built and hosted on Cloudflare", close: "Close",
      pages: "Pages", prev: "Previous page", next: "Next page", pageN: (i) => `Page ${i}`,
      open: "Open", openApp: (n) => `Open ${n}`, isNew: "new", updated: "updated",
      countAll: (n) => `${n} apps`, countSome: (k, n) => `${k} of ${n} apps`,
      loadError: "The list of apps could not be loaded. Please reload the page.",
      docTitle: "Web apps · Julie Toussaint", locale: "en-GB",
    },
    nl: {
      brand: "Web-apps", title: "Kies een app",
      lead: "Alles wat ik bouw en host, op één plek. Elke app werkt meteen in je browser, zonder installeren.",
      controls: "Zoeken en filteren", searchLabel: "Zoek een app", searchPh: "Zoek apps",
      category: "Categorie", all: "Alle", sortLabel: "Sorteren", sortUpdated: "Laatst bijgewerkt", sortName: "Naam (A–Z)",
      empty: "Geen apps gevonden. Probeer een ander woord of kies", emptyAll: "Toon alles",
      footer: "Gebouwd en gehost op Cloudflare", close: "Sluiten",
      pages: "Pagina's", prev: "Vorige pagina", next: "Volgende pagina", pageN: (i) => `Pagina ${i}`,
      open: "Open", openApp: (n) => `Open ${n}`, isNew: "nieuw", updated: "bijgewerkt",
      countAll: (n) => `${n} apps`, countSome: (k, n) => `${k} van ${n} apps`,
      loadError: "De lijst met apps kon niet geladen worden. Herlaad de pagina.",
      docTitle: "Web-apps · Julie Toussaint", locale: "nl-BE",
    },
  };
  const LANGS = Object.keys(UI);
  const store = {
    get() { try { return localStorage.getItem("portal-lang"); } catch { return null; } },
    set(v) { try { localStorage.setItem("portal-lang", v); } catch {} },
  };

  let apps = [], categories = {};
  const params = new URLSearchParams(location.search);
  const state = {
    q: "", cat: "all", sort: "updated", page: 0,
    lang: [params.get("lang"), store.get()].find((l) => LANGS.includes(l)) || "en",
  };
  const T = () => UI[state.lang];
  // a text in apps.json is a string or { en, nl }; English is the fallback
  const tx = (v) => (v && typeof v === "object" ? v[state.lang] ?? v.en ?? Object.values(v)[0] : v) || "";

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? "" : d.toLocaleDateString(T().locale, { day: "numeric", month: "short", year: "numeric" });
  };
  const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const catLabel = (c) => tx(categories[c]) || (c ? c[0].toUpperCase() + c.slice(1) : "");
  const isNew = (a) => a.new === true || (a.updated && (Date.now() - new Date(a.updated + "T12:00:00")) / 864e5 <= 7);

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k) n.append(k);
    return n;
  };

  // ---------- Static texts ----------
  function applyLang() {
    const t = T();
    document.documentElement.lang = state.lang;
    document.title = t.docTitle;
    document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t[n.dataset.i18n]; });
    document.querySelectorAll("[data-i18n-ph]").forEach((n) => { n.placeholder = t[n.dataset.i18nPh]; });
    document.querySelectorAll("[data-i18n-label]").forEach((n) => n.setAttribute("aria-label", t[n.dataset.i18nLabel]));
    document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
  }
  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
    if (state.lang === b.dataset.lang) return;
    state.lang = b.dataset.lang; store.set(state.lang);
    applyLang(); paintSort(); update();
    const slug = location.hash.slice(1);
    if (dlg.open && slug) openApp(slug, false);
  }));

  // ---------- Cards ----------
  function media(a, cls) {
    const wrap = el("div", { class: cls });
    if (a.image) {
      const img = el("img", { src: a.image, alt: "", width: 1200, height: 630 });
      img.addEventListener("error", () => img.replaceWith(el("div", { class: "card__ph", text: a.emoji || "▦" })), { once: true });
      wrap.append(img);
    } else wrap.append(el("div", { class: "card__ph", text: a.emoji || "▦" }));
    return wrap;
  }

  function metaLine(a) {
    const parts = [catLabel(a.category), a.version, a.updated && `${T().updated} ${fmtDate(a.updated)}`].filter(Boolean);
    return el("p", { class: "meta", text: parts.join(" · ") });
  }

  // All rainbow borders share one clock: a new element starts its rotation at the same angle as
  // everything already on screen (negative delay = current time within one turn).
  const SPIN = 7;
  const sync = () => `-${((performance.now() / 1000) % SPIN).toFixed(3)}s`;
  const ARROW = '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M7.5 6H14v6.5"/></svg>';
  function card(a, i) {
    const titleBtn = el("button", { type: "button", "aria-haspopup": "dialog", text: a.name });
    titleBtn.addEventListener("click", () => openApp(a.slug));
    // stagger the border rotation so the cards do not spin in lockstep
    // ring + glow are rotating gradient layers (GPU transform), not repainted gradients
    const art = el("article", { class: "card", style: `--delay:${sync()}` },
      el("div", { class: "card__glow", "aria-hidden": "true" }, el("i")),
      el("div", { class: "card__ring", "aria-hidden": "true" }, el("i")),
      media(a, "card__media"),
      el("div", { class: "card__bar" },
        el("h2", { class: "card__title" }, titleBtn, isNew(a) && el("span", { class: "dot-new", title: T().isNew })),
        a.version && el("span", { class: "tag", text: a.version })
      )
    );
    // the whole card (banner included) opens the details; the title button stays for keyboard users
    art.addEventListener("click", (e) => { if (!e.target.closest("button")) openApp(a.slug); });
    return el("div", { role: "listitem" }, art);
  }

  // search matches both languages, so a Dutch word still finds the app while reading English
  const allText = (v) => (v && typeof v === "object" ? Object.values(v) : [v]);
  function matches(a) {
    if (state.cat !== "all" && a.category !== state.cat) return false;
    if (!state.q) return true;
    const hay = norm([a.name, a.summary, a.details, categories[a.category], a.category, ...(a.tags || [])].flatMap(allText).join(" "));
    return norm(state.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }

  function sorted(list) {
    const byName = (x, y) => x.name.localeCompare(y.name, state.lang);
    // pinned apps (the portfolio, the centrepiece) always come first, whatever the sort
    const byPin = (x, y) => (y.pinned === true) - (x.pinned === true);
    if (state.sort === "name") return [...list].sort((x, y) => byPin(x, y) || byName(x, y));
    return [...list].sort((x, y) =>
      byPin(x, y) || (y.featured === true) - (x.featured === true) || (y.updated || "").localeCompare(x.updated || "") || byName(x, y));
  }

  function renderCats() {
    const counts = apps.reduce((m, a) => ((m[a.category] = (m[a.category] || 0) + 1), m), {});
    // order from apps.json, unknown categories at the end
    const keys = [...new Set([...Object.keys(categories), ...Object.keys(counts)])].filter((k) => counts[k]);
    const entries = [["all", T().all, apps.length], ...keys.map((k) => [k, catLabel(k), counts[k]])];
    cats.replaceChildren(...entries.map(([key, label, n]) => {
      const b = el("button", { type: "button", class: "chip", role: "tab", "aria-selected": String(state.cat === key), style: `--delay:${sync()}` },
        label, el("span", { class: "chip__n", text: n }));
      b.addEventListener("click", () => { state.cat = key; state.page = 0; update(); });
      return b;
    }));
  }

  // ---------- Layout: rows of banner-shaped cards that fill the screen ----------
  // Every card keeps the exact banner shape (1200×630). Apps are split into rows; each row is as wide as
  // the screen allows, rows with fewer apps (at the top: newest first) get bigger cards. Of all ways to
  // split them, the one that covers the most of the screen wins. If the apps cannot all fit with cards of
  // at least MIN_W wide, the rest goes to further pages.
  const stage = $("#stage"), pager = $("#pager"), dots = $("#dots"), prev = $("#prev"), next = $("#next");
  const main = $(".main"), BAR = 38 + 16;   // bottom bar + gap, only shown when there are pages
  const GAP = 16, RATIO = 1200 / 630;
  let layout = { per: 1 };

  function arrange(count, w, h) {
    let best = null;
    for (let R = 1; R <= count; R++) {
      const base = Math.floor(count / R), extra = count % R;
      const rows = Array.from({ length: R }, (_, i) => (i < R - extra ? base : base + 1));
      const natural = rows.map((c) => (w - GAP * (c - 1)) / c);           // card width per row at full width
      const sumH = natural.reduce((t, cw) => t + cw / RATIO, 0);
      const s = Math.min(1, (h - GAP * (R - 1)) / sumH);
      if (s <= 0) continue;
      const widths = natural.map((cw) => cw * s);
      const area = rows.reduce((t, c, i) => t + c * widths[i] * widths[i], 0);
      if (!best || area > best.area) best = { rows, widths, area, minW: Math.min(...widths) };
    }
    return best;
  }

  function stageSize(paged) {
    const hFull = stage.clientHeight + (main.classList.contains("main--paged") ? BAR : 0);
    return { w: stage.clientWidth, h: paged ? hFull - BAR : hFull };
  }

  function perPage(n) {
    const MIN_W = stage.clientWidth < 560 ? 140 : 200;
    let { w, h } = stageSize(false);
    if (arrange(n, w, h).minW >= MIN_W) return { per: n, paged: false };
    ({ w, h } = stageSize(true));
    let per = n - 1;
    while (per > 1 && arrange(per, w, h).minW < MIN_W) per--;
    return { per: Math.max(1, per), paged: true };
  }

  new ResizeObserver(() => { if (apps.length) render(); }).observe(stage);

  function render() {
    const list = sorted(apps.filter(matches));
    if (!stage.clientWidth) return;
    const keepFirst = state.page * layout.per;            // keep the first visible app on screen after a resize
    const { per, paged } = perPage(Math.max(1, list.length));
    if (per !== layout.per) state.page = Math.floor(keepFirst / per);
    layout = { per };
    main.classList.toggle("main--paged", paged);
    const pages = Math.max(1, Math.ceil(list.length / per));
    state.page = Math.min(Math.max(0, state.page), pages - 1);
    const start = state.page * per;
    const shown = list.slice(start, start + per);
    const { w, h } = stageSize(paged);
    const plan = shown.length ? arrange(shown.length, w, h) : { rows: [], widths: [] };
    let k = 0;
    grid.replaceChildren(...plan.rows.map((c, r) => {
      const width = Math.floor(plan.widths[r]);
      return el("div", { class: "row", role: "presentation" }, shown.slice(k, (k += c)).map((a, i) => {
        const item = card(a, start + k - c + i);
        item.style.setProperty("--cw", width + "px");
        if (width < 250) item.classList.add("small");
        if (width >= 520) item.classList.add("large");
        return item;
      }));
    }));
    empty.hidden = list.length > 0;
    count.textContent = list.length === apps.length ? String(apps.length).padStart(2, "0") : `${String(list.length).padStart(2, "0")} / ${String(apps.length).padStart(2, "0")}`;
    renderPager(pages);
  }

  function renderPager(pages) {
    pager.hidden = pages <= 1;
    prev.disabled = state.page === 0;
    next.disabled = state.page >= pages - 1;
    if (pages > 9) {
      dots.replaceChildren(el("span", { class: "pager__num", text: `${state.page + 1} / ${pages}` }));
      return;
    }
    dots.replaceChildren(...Array.from({ length: pages }, (_, i) => {
      const d = el("button", { type: "button", class: "pager__dot", "aria-label": T().pageN(i + 1), "aria-current": i === state.page ? "page" : null });
      d.addEventListener("click", () => goPage(i));
      return d;
    }));
  }
  function goPage(i) {
    const pages = Math.max(1, Math.ceil(apps.filter(matches).length / layout.per));
    const p = Math.min(Math.max(0, i), pages - 1);
    if (p !== state.page) { state.page = p; render(); }
  }
  prev.addEventListener("click", () => goPage(state.page - 1));
  next.addEventListener("click", () => goPage(state.page + 1));

  // swipe on touch screens
  let sx = null, sy = null;
  stage.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") { sx = e.clientX; sy = e.clientY; } });
  stage.addEventListener("pointerup", (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) goPage(state.page + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener("pointercancel", () => { sx = null; });
  // mouse wheel / trackpad pages instead of scrolling
  let wheelAcc = 0, wheelLock = 0;
  stage.addEventListener("wheel", (e) => {
    if (pager.hidden) return;
    e.preventDefault();
    const now = Date.now();
    if (now < wheelLock) return;
    wheelAcc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(wheelAcc) >= 60) { goPage(state.page + Math.sign(wheelAcc)); wheelAcc = 0; wheelLock = now + 450; }
  }, { passive: false });

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.cat !== "all") p.set("cat", state.cat);
    if (state.sort !== "updated") p.set("sort", state.sort);
    if (state.lang !== "en") p.set("lang", state.lang);
    const s = p.toString();
    history.replaceState(null, "", (s ? "?" + s : location.pathname) + location.hash);
  }

  function update() { renderCats(); render(); syncUrl(); }

  // ---------- Detail dialog ----------
  function openApp(slug, push = true) {
    const a = apps.find((x) => x.slug === slug);
    if (!a) return;
    const img = $("#dlg-img");
    img.hidden = !a.image; if (a.image) img.src = a.image;
    $("#dlg-meta").textContent = metaLine(a).textContent;
    $("#dlg-title").textContent = a.name;
    $("#dlg-summary").textContent = tx(a.summary);
    $("#dlg-tags").replaceChildren(...(a.tags || []).map((t) => el("li", { text: tx(t) })));
    $("#dlg-open").href = a.url;
    $("#dlg-open").style.setProperty("--app", /^#[0-9a-f]{6}$/i.test(a.color || "") ? a.color : "#3db4ff");
    $("#dlg-open").innerHTML = ""; $("#dlg-open").append(T().openApp(a.name)); $("#dlg-open").insertAdjacentHTML("beforeend", ARROW);
    if (push && location.hash !== "#" + slug) history.pushState(null, "", "#" + slug);
    if (!dlg.open) { dlg.style.setProperty("--delay", sync()); dlg.showModal(); }
  }
  dlg.addEventListener("close", () => {
    if (location.hash) history.pushState(null, "", location.pathname + location.search);
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // click on the backdrop
  $("#dlg-close").addEventListener("click", () => dlg.close());
  window.addEventListener("popstate", () => {
    const slug = location.hash.slice(1);
    if (slug) openApp(slug, false); else if (dlg.open) dlg.close();
  });

  // ---------- Controls ----------
  function paintSort() {
    sortBtn.dataset.sort = state.sort;
    sortBtn.dataset.i18nLabel = state.sort === "name" ? "sortName" : "sortUpdated";
    sortBtn.setAttribute("aria-label", T()[sortBtn.dataset.i18nLabel]);
    sortBtn.title = T()[sortBtn.dataset.i18nLabel];
  }
  sortBtn.addEventListener("click", () => { state.sort = state.sort === "name" ? "updated" : "name"; state.page = 0; paintSort(); render(); syncUrl(); });
  $("#reset").addEventListener("click", () => { state.q = ""; state.cat = "all"; state.page = 0; update(); });
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if (!dlg.open && !typing) {
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goPage(state.page + 1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goPage(state.page - 1); }
    }
  });

  // ---------- Load ----------
  applyLang();
  fetch("apps.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      categories = data.categories || {};
      apps = (data.apps || []).filter((a) => a && a.slug && a.name && a.url);
      state.q = params.get("q") || "";
      state.cat = params.get("cat") || "all";
      state.sort = params.get("sort") === "name" ? "name" : "updated"; paintSort();
      if (state.cat !== "all" && !apps.some((a) => a.category === state.cat)) state.cat = "all";
      update();
      if (location.hash.length > 1) openApp(location.hash.slice(1), false);
    })
    .catch((e) => { console.error(e); count.textContent = T().loadError; });
})();
