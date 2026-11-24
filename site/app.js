// Web apps portal. All content comes from apps.json: adding an app = adding one object.
// Search, filter, language and the chosen app live in the URL (?q=…&cat=…&lang=nl#slug), so links can be shared.
// English is the default; Dutch is an option (remembered per visitor).
(() => {
  const $ = (s) => document.querySelector(s);
  const grid = $("#grid"), cats = $("#cats"), sortBtn = $("#sort");
  const count = $("#count"), empty = $("#empty"), dlg = $("#dlg");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  // what the next render() should animate: { type: "boot" | "page" | "flip", dir }; null = no animation (resize, language)
  let motion = null;

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
    $(".lang").dataset.active = state.lang;   // moves the sliding rainbow pill
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
    // ring + glow are rotating gradient layers (GPU transform), not repainted gradients; all on one shared clock
    const art = el("article", { class: "card", "data-slug": a.slug, style: `--delay:${sync()}` },
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

  let picked = null;   // the chip that was just clicked gets a one-off lock-on pulse
  function renderCats() {
    const counts = apps.reduce((m, a) => ((m[a.category] = (m[a.category] || 0) + 1), m), {});
    // order from apps.json, unknown categories at the end
    const keys = [...new Set([...Object.keys(categories), ...Object.keys(counts)])].filter((k) => counts[k]);
    const entries = [["all", T().all, apps.length], ...keys.map((k) => [k, catLabel(k), counts[k]])];
    cats.replaceChildren(...entries.map(([key, label, n]) => {
      const b = el("button", { type: "button", class: "chip" + (picked === key ? " pick" : ""), role: "tab", "aria-selected": String(state.cat === key), style: `--delay:${sync()}` },
        label, el("span", { class: "chip__n", text: n }));
      b.addEventListener("click", () => {
        if (state.cat === key) return;
        state.cat = key; state.page = 0; picked = key; motion = { type: "flip" }; update(); picked = null;
      });
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
    // a re-render while the load sequence is still running (resize, font swap) keeps the sequence going
    if (!motion && performance.now() - bootStart < BOOT_MS) motion = { type: "boot", resume: true };
    const m = reduce.matches ? null : motion; motion = null;
    const before = m?.type === "flip" ? rects() : null;
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
    if (m) play(m, before);
  }

  // ---------- Motion ----------
  // card centres before a re-render, so cards that stay on screen can glide from their old spot (FLIP)
  function rects() {
    const map = new Map();
    grid.querySelectorAll(".card").forEach((c) => map.set(c.dataset.slug, c.parentElement.getBoundingClientRect()));
    return map;
  }
  // All cards animate at the same moment (no stagger), so the whole overview is there at once.
  const BOOT_MS = 800;
  let bootStart = -1e9;
  function play(m, before) {
    const cards = [...grid.querySelectorAll(".card")];
    const done = (c) => c.addEventListener("animationend", (e) => {
      if (e.target === c && (e.animationName === "boot" || e.animationName === "slide")) c.classList.remove("boot", "slide");
    });
    if (m.type === "boot") {
      // every card powers on together; a re-render mid-way continues at the same point
      if (!m.resume) bootStart = performance.now();
      const d = -Math.round(performance.now() - bootStart);
      cards.forEach((c) => { c.style.setProperty("--d", d + "ms"); c.classList.add("boot"); done(c); });
    } else if (m.type === "page") {
      cards.forEach((c) => {
        c.style.setProperty("--d", "0ms");
        c.style.setProperty("--dx", m.dir * 56 + "px");
        c.classList.add("slide"); done(c);
      });
    } else if (m.type === "flip") {
      cards.forEach((c) => {
        const o = before.get(c.dataset.slug);
        if (!o) { c.style.setProperty("--d", "0ms"); c.classList.add("boot"); done(c); return; }
        const n = c.parentElement.getBoundingClientRect();
        const dx = o.left + o.width / 2 - (n.left + n.width / 2), dy = o.top + o.height / 2 - (n.top + n.height / 2);
        const s = o.width / n.width;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.01) return;
        c.animate([{ translate: `${dx}px ${dy}px`, scale: s }, { translate: "0 0", scale: 1 }],
          { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
      });
    }
  }

  // 3D tilt + glare toward the pointer (mouse/trackpad only)
  let tilted = null;
  grid.addEventListener("pointermove", (e) => {
    if (!finePointer.matches || reduce.matches) return;
    const c = e.target.closest(".card");
    if (tilted && tilted !== c) untilt();
    if (!c) return;
    const r = c.parentElement.getBoundingClientRect();   // untransformed box
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    c.classList.add("tilt"); tilted = c;
    c.style.setProperty("--ry", ((x - 0.5) * 9).toFixed(2) + "deg");
    c.style.setProperty("--rx", ((0.5 - y) * 7).toFixed(2) + "deg");
    c.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
    c.style.setProperty("--my", (y * 100).toFixed(1) + "%");
  });
  function untilt() {
    if (!tilted) return;
    tilted.classList.remove("tilt");
    tilted.style.removeProperty("--rx"); tilted.style.removeProperty("--ry");
    tilted = null;
  }
  grid.addEventListener("pointerleave", untilt);

  // grid spotlight that follows the pointer across the background
  const bg = $(".bg");
  let spot = null;
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || reduce.matches) return;
    const run = !spot;
    spot = [e.clientX, e.clientY];
    if (run) requestAnimationFrame(() => {
      bg.style.setProperty("--px", spot[0] + "px"); bg.style.setProperty("--py", spot[1] + "px"); spot = null;
    });
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { bg.style.removeProperty("--px"); bg.style.removeProperty("--py"); });

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
  // the current page leaves against the direction of travel, then the new one slides in
  let leaving = null;
  function goPage(i) {
    const pages = Math.max(1, Math.ceil(apps.filter(matches).length / layout.per));
    const p = Math.min(Math.max(0, i), pages - 1);
    if (p === state.page) return;
    const dir = p > state.page ? 1 : -1;
    state.page = p;
    const show = () => { motion = { type: "page", dir }; render(); };
    if (leaving) { leaving.cancel(); leaving = null; show(); return; }   // pressed again mid-way: skip the exit
    if (reduce.matches || !grid.children.length) { show(); return; }
    const out = grid.animate([{ translate: "0 0", opacity: 1 }, { translate: `${-dir * 44}px 0`, opacity: 0 }],
      { duration: 170, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
    leaving = out;
    out.finished.then(() => { if (leaving !== out) return; leaving = null; show(); out.cancel(); }, () => {});
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
    dlgSlug = slug;
    if (!dlg.open || dlg.classList.contains("closing")) showDlg();
  }

  // The dialog grows out of the card that was clicked (its banner morphs into the dialog's banner) and shrinks
  // back into it on close. Without a card on screen it powers on like the cards do.
  // Two animations on the dialog: "move" (where the box is) and "clip" (how much of it shows). From a card, the banner
  // first travels and grows into place, and the details panel unfolds under it a beat later.
  let dlgSlug = null, dlgAnims = [];
  function dlgPlan() {
    const d = dlg.getBoundingClientRect();
    const media = $(".dlg__media"), mh = media.offsetParent ? media.offsetHeight : 0;
    const card = dlgSlug && grid.querySelector(`.card[data-slug="${CSS.escape(dlgSlug)}"]`);
    const open = "inset(-140px round 20px)";
    if (card && mh) {
      const c = card.parentElement.getBoundingClientRect(), s = c.width / d.width;
      return {
        move: [{ transformOrigin: "0 0", transform: `translate(${c.left - d.left}px, ${c.top - d.top}px) scale(${s})` },
               { transformOrigin: "0 0", transform: "none" }],
        clip: [{ clipPath: `inset(0 0 ${Math.max(0, d.height - mh - 3)}px 0 round ${(16 / s).toFixed(1)}px)` },
               { clipPath: open }],
      };
    }
    return {
      move: [{ transform: "scale(.97)", filter: "brightness(2.2)" }, { transform: "none", filter: "brightness(1)" }],
      clip: [{ clipPath: "inset(49.5% 0 49.5% 0 round 20px)" }, { clipPath: open }],
    };
  }
  function stopDlgAnims() { dlgAnims.forEach((a) => a.cancel()); dlgAnims = []; }
  function showDlg() {
    stopDlgAnims();
    dlg.classList.remove("closing");
    if (!dlg.open) { dlg.style.setProperty("--delay", sync()); dlg.showModal(); }
    if (reduce.matches) return;
    dlg.classList.add("opening");
    const p = dlgPlan(), ease = "cubic-bezier(.2,.8,.2,1)";
    dlgAnims = [
      dlg.animate(p.move, { duration: 520, easing: ease }),
      dlg.animate(p.clip, { duration: 440, delay: 170, easing: ease, fill: "backwards" }),
    ];
    Promise.all(dlgAnims.map((a) => a.finished)).then(() => dlg.classList.remove("opening"), () => {});
  }
  function closeDlg() {
    if (!dlg.open || dlg.classList.contains("closing")) return;
    if (reduce.matches) { dlg.close(); return; }
    stopDlgAnims();
    dlg.classList.remove("opening"); dlg.classList.add("closing");
    const p = dlgPlan(), ease = "cubic-bezier(.4,0,.2,1)";
    dlgAnims = [
      dlg.animate(p.clip.reverse(), { duration: 220, easing: ease, fill: "forwards" }),
      dlg.animate(p.move.reverse(), { duration: 340, delay: 90, easing: ease, fill: "forwards" }),
    ];
    const all = dlgAnims;
    Promise.all(all.map((a) => a.finished)).then(() => { dlg.close(); all.forEach((a) => a.cancel()); }, () => {});
  }
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeDlg(); });   // Esc animates too
  dlg.addEventListener("close", () => {
    dlg.classList.remove("closing", "opening");
    if (location.hash) history.pushState(null, "", location.pathname + location.search);
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDlg(); }); // click on the backdrop
  $("#dlg-close").addEventListener("click", closeDlg);
  window.addEventListener("popstate", () => {
    const slug = location.hash.slice(1);
    if (slug) openApp(slug, false); else closeDlg();
  });

  // ---------- Controls ----------
  function paintSort() {
    sortBtn.dataset.sort = state.sort;
    sortBtn.dataset.i18nLabel = state.sort === "name" ? "sortName" : "sortUpdated";
    sortBtn.setAttribute("aria-label", T()[sortBtn.dataset.i18nLabel]);
    sortBtn.title = T()[sortBtn.dataset.i18nLabel];
  }
  sortBtn.addEventListener("click", () => { state.sort = state.sort === "name" ? "updated" : "name"; state.page = 0; paintSort(); motion = { type: "flip" }; render(); syncUrl(); });
  $("#reset").addEventListener("click", () => { state.q = ""; state.cat = "all"; state.page = 0; motion = { type: "flip" }; update(); });
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
      motion = { type: "boot" };
      update();
      if (location.hash.length > 1) openApp(location.hash.slice(1), false);
    })
    .catch((e) => { console.error(e); count.textContent = T().loadError; });
})();
