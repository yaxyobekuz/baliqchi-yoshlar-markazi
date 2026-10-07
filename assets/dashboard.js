// ============================================================
//  Statistika paneli
//  Ma'lumot manbai: Apps Script Web App (doGet?action=data)
//  Grafiklar qo'lda SVG bilan chiziladi - tashqi kutubxona yo'q.
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOsfh4if4NsK4pYWgmHDYIGM9Z2vR8YeLI8QcQqata_zdJrAlTNuO1fObLt4WMpVZB/exec";

const PAGE_SIZE = 25;
const KEY_STORAGE = "dash_key";
const THEME_STORAGE = "dash_theme";

// Sertifikat turlari - rang entity'ga biriktirilgan, filtrda o'zgarmaydi
const CERT_TYPES = [
  { id: "CEFR", label: "CEFR", varName: "--series-1" },
  { id: "IELTS", label: "IELTS", varName: "--series-2" },
  { id: "SAT", label: "SAT", varName: "--series-3" }
];

// CEFR va IELTS natijalari past→yuqori tartibda bo'lishi kerak
const RESULT_ORDER = {
  CEFR: ["B2", "C1", "C2"],
  IELTS: ["5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"]
};

const state = {
  rows: [],
  filtered: [],
  demo: false,
  key: "",
  updatedAt: null,
  filters: { range: "all", cert: "", lang: "", grade: "", school: "", search: "" },
  views: {},          // kartadagi grafik/jadval tanlovi
  sort: { key: "ts", dir: "desc" },
  page: 0,
  maskPhones: true
};

// ---------- qisqa yordamchilar ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const SVG_NS = "http://www.w3.org/2000/svg";

function elem(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (v != null) node.setAttribute(k, v);
  }
  if (text != null) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, v);
  }
  if (text != null) node.textContent = text;
  return node;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const fmt = (n) => Number(n).toLocaleString("ru-RU").replace(/ /g, " ");

function pct(part, total) {
  if (!total) return "0%";
  const v = (part / total) * 100;
  return (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + "%";
}

/** Matn kengligini o'lchaydi - yorliq belgiga sig'adimi, shuni hal qilish uchun */
const measure = (() => {
  const ctx = document.createElement("canvas").getContext("2d");
  return (text, size = 11.5, weight = 600) => {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
    return ctx.measureText(String(text)).width;
  };
})();

/** Fon rangiga qarab ichki yorliq oq yoki qora bo'ladi */
function inkOn(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#0b0b0b" : "#ffffff";
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(String(value).length <= 10 ? value + "T00:00:00" : value);
  return isNaN(d) ? null : d;
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shortDate = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
const fullDate = (d) => `${shortDate(d)}.${d.getFullYear()}`;

function certColor(id) {
  const t = CERT_TYPES.find((c) => c.id === id);
  return cssVar(t ? t.varName : "--series-de");
}

// ============================================================
//  MA'LUMOT OLISH
// ============================================================

/** Apps Script CORS preflight'ni qo'llamaydi - avval fetch, keyin JSONP */
async function loadData() {
  const url = `${APPS_SCRIPT_URL}?action=data&key=${encodeURIComponent(state.key)}`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (_) {
    return jsonp(url);
  }
}

function jsonp(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const name = "__dash_cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const done = (fn) => {
      clearTimeout(timer);
      delete window[name];
      script.remove();
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("Javob kelmadi (timeout)"))), timeout);
    window[name] = (data) => done(() => resolve(data));
    script.onerror = () => done(() => reject(new Error("Tarmoq xatosi")));
    script.src = url + "&callback=" + name;
    document.body.appendChild(script);
  });
}

function normalize(rows) {
  return (rows || [])
    .map((r) => ({
      ts: parseDate(r.ts),
      school: String(r.school ?? "").trim(),
      grade: String(r.grade ?? "").trim(),
      fish: String(r.fish ?? "").trim(),
      language: String(r.language ?? "").trim() || "Ko'rsatilmagan",
      certType: String(r.certType ?? "").trim(),
      certDate: parseDate(r.certDate),
      result: String(r.result ?? "").trim(),
      phone: String(r.phone ?? "").trim()
    }))
    .filter((r) => r.fish)
    .sort((a, b) => (b.ts?.getTime() || 0) - (a.ts?.getTime() || 0));
}

/** Panelni ma'lumotsiz ham ko'rish uchun ishonarli namuna to'plami */
function demoRows() {
  const langs = ["Ingliz tili", "Ingliz tili", "Ingliz tili", "Ingliz tili", "Nemis tili",
    "Koreys tili", "Yapon tili", "Turk tili", "Arab tili", "Rus tili", "Xitoy tili"];
  const names = ["Raxmonaliyev Abubakir", "Tursunova Nilufar", "Qodirov Javohir", "Yo'ldosheva Sevinch",
    "Ergashev Doniyor", "Umarova Malika", "Sobirov Bekzod", "Aliyeva Ruxshona", "Nazarov Shahzod",
    "Karimova Zilola", "To'xtasinov Islom", "Mirzayeva Dilnoza", "Hasanov Asadbek", "Yusupova Gulnoza"];
  const patronyms = ["Komiljon o'g'li", "Alisher qizi", "Bahodir o'g'li", "Rustam qizi", "Anvar o'g'li"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const out = [];
  const total = 184;
  for (let i = 0; i < total; i++) {
    // oxirgi 150 kun, yaqin kunlarga og'ir taqsimot
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.7) * 150);
    const ts = new Date();
    ts.setDate(ts.getDate() - daysAgo);
    ts.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

    const roll = Math.random();
    const certType = roll < 0.62 ? "CEFR" : roll < 0.9 ? "IELTS" : "SAT";
    const result = certType === "CEFR"
      ? pick(["B2", "B2", "B2", "B2", "C1", "C1", "C2"])
      : certType === "IELTS"
        ? pick(["5.5", "6.0", "6.0", "6.5", "6.5", "7.0", "7.0", "7.5", "8.0"])
        : pick(["1400", "1410", "1430", "1450", "1450", "1480", "1500", "1520", "1560"]);

    const certDate = new Date(ts);
    certDate.setDate(certDate.getDate() - Math.floor(Math.random() * 60));
    if (certDate.getFullYear() < 2026) certDate.setFullYear(2026, 0, 12);

    out.push({
      ts: ts.toISOString().slice(0, 19),
      school: String(pick([1, 2, 3, 5, 7, 9, 11, 12, 14, 16, 18, 21, 23, 24, 27, 30, 33, 36, 36, 36, 41, 44, 48, 52, 57, 61])),
      grade: String(pick([5, 6, 7, 8, 9, 9, 10, 10, 10, 11, 11, 11])),
      fish: `${pick(names)} ${pick(patronyms)}`,
      language: pick(langs),
      certType,
      certDate: dayKey(certDate),
      result,
      phone: `+998 ${pick([90, 91, 93, 94, 95, 97, 99])} ${100 + Math.floor(Math.random() * 900)} ${10 + Math.floor(Math.random() * 90)} ${10 + Math.floor(Math.random() * 90)}`
    });
  }
  return out;
}

// ============================================================
//  FILTRLASH
// ============================================================

function rangeStart() {
  const r = state.filters.range;
  if (r === "all") return null;
  const now = new Date();
  if (r === "mtd") return new Date(now.getFullYear(), now.getMonth(), 1);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (Number(r) - 1));
  return d;
}

function applyFilters() {
  const f = state.filters;
  const from = rangeStart();
  const q = f.search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");

  state.filtered = state.rows.filter((r) => {
    if (from && (!r.ts || r.ts < from)) return false;
    if (f.cert && r.certType !== f.cert) return false;
    if (f.lang && r.language !== f.lang) return false;
    if (f.grade && r.grade !== f.grade) return false;
    if (f.school && r.school !== f.school) return false;
    if (q) {
      const nameHit = r.fish.toLowerCase().includes(q);
      const phoneHit = qDigits.length >= 3 && r.phone.replace(/\D/g, "").includes(qDigits);
      if (!nameHit && !phoneHit) return false;
    }
    return true;
  });

  state.page = 0;
  const active = f.range !== "all" || f.cert || f.lang || f.grade || f.school || f.search;
  $("#f-reset").hidden = !active;
}

// ============================================================
//  AGREGATSIYA
// ============================================================

function countBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (k === "" || k == null) return;
    map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
}

function topN(map, n, otherLabel = "Boshqa") {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= n) return sorted.map(([label, value]) => ({ label, value }));
  const head = sorted.slice(0, n).map(([label, value]) => ({ label, value }));
  const rest = sorted.slice(n).reduce((s, [, v]) => s + v, 0);
  head.push({ label: otherLabel, value: rest, isOther: true });
  return head;
}

/** Arizalar oqimi: 70 kundan uzun davr haftalarga yig'iladi */
function trendBuckets(rows) {
  const dated = rows.filter((r) => r.ts).sort((a, b) => a.ts - b.ts);
  if (!dated.length) return { points: [], unit: "kun" };

  const first = new Date(dated[0].ts); first.setHours(0, 0, 0, 0);
  const last = new Date(dated[dated.length - 1].ts); last.setHours(0, 0, 0, 0);
  const spanDays = Math.round((last - first) / 86400000) + 1;
  const weekly = spanDays > 70;

  const bucketStart = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    if (weekly) x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // dushanba
    return x;
  };

  const counts = new Map();
  dated.forEach((r) => {
    const k = bucketStart(r.ts).getTime();
    counts.set(k, (counts.get(k) || 0) + 1);
  });

  const points = [];
  const cursor = bucketStart(first);
  const end = bucketStart(last);
  while (cursor <= end) {
    const t = cursor.getTime();
    points.push({ date: new Date(cursor), value: counts.get(t) || 0 });
    cursor.setDate(cursor.getDate() + (weekly ? 7 : 1));
  }
  return { points, unit: weekly ? "hafta" : "kun" };
}

function isHighLevel(r) {
  if (r.certType === "CEFR") return r.result === "C1" || r.result === "C2";
  if (r.certType === "IELTS") return parseFloat(r.result) >= 7;
  if (r.certType === "SAT") return parseFloat(r.result) >= 1500;
  return false;
}

// ============================================================
//  TOOLTIP
// ============================================================

const tip = {
  node: null,
  show(html, x, y) {
    if (!this.node) this.node = $("#tooltip");
    this.node.replaceChildren(...html);
    this.node.hidden = false;
    const r = this.node.getBoundingClientRect();
    let left = x + 14;
    let top = y - r.height - 12;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 18;
    this.node.style.left = Math.max(8, left) + "px";
    this.node.style.top = top + "px";
  },
  hide() {
    if (!this.node) this.node = $("#tooltip");
    this.node.hidden = true;
  }
};

function tipContent(title, rows) {
  const out = [elem("div", { class: "tt-title" }, title)];
  rows.forEach(({ name, value, color }) => {
    const row = elem("div", { class: "tt-row" });
    if (color) {
      const key = elem("span", { class: "tt-key" });
      key.style.background = color;
      row.appendChild(key);
    }
    row.appendChild(elem("span", { class: "tt-value" }, value));
    if (name) row.appendChild(elem("span", { class: "tt-name" }, name));
    out.push(row);
  });
  return out;
}

/** Sichqoncha va klaviatura bir xil ma'lumotni ko'rsatadi */
function attachTip(target, viz, build) {
  const show = (ev) => {
    const r = target.getBoundingClientRect();
    const x = ev.clientX ?? r.left + r.width / 2;
    const y = ev.clientY ?? r.top;
    viz.classList.add("is-hovering");
    target.dataset.hot = "1";
    (target.__marks || []).forEach((m) => m.classList.add("is-hot"));
    tip.show(build(), x, y);
  };
  const hide = () => {
    viz.classList.remove("is-hovering");
    delete target.dataset.hot;
    (target.__marks || []).forEach((m) => m.classList.remove("is-hot"));
    tip.hide();
  };
  target.addEventListener("pointerenter", show);
  target.addEventListener("pointermove", show);
  target.addEventListener("pointerleave", hide);
  target.addEventListener("focus", show);
  target.addEventListener("blur", hide);
}

// ============================================================
//  GRAFIKLAR
// ============================================================

/** Y o'qi uchun tekis qadamlar (0 / 5 / 10 ...) */
function niceTicks(max, count = 4) {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { max: top, ticks };
}

// ---------- 1. Dinamika: maydon + chiziq + crosshair ----------
function drawTrend(host, rows) {
  const { points, unit } = trendBuckets(rows);
  $("#trend-sub").textContent = points.length
    ? `Har bir ${unit} uchun arizalar soni · ${fmt(points.length)} ta ${unit}`
    : "";

  if (points.length < 2) {
    host.replaceChildren(elem("p", { class: "mini-empty" }, "Dinamikani ko'rsatish uchun ma'lumot yetarli emas."));
    return;
  }

  const W = host.clientWidth || 720;
  const H = 240;
  const m = { t: 14, r: 18, b: 30, l: 40 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;

  const maxVal = Math.max(...points.map((p) => p.value));
  const { max, ticks } = niceTicks(maxVal);
  const x = (i) => m.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => m.t + ih - (v / max) * ih;

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  root.appendChild(svg("title", {}, "Arizalar dinamikasi"));

  // to'r chiziqlari + y yorliqlari
  ticks.forEach((t) => {
    root.appendChild(svg("line", { class: "gridline", x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    root.appendChild(svg("text", { class: "axis-text", x: m.l - 8, y: y(t) + 3.5, "text-anchor": "end" }, fmt(t)));
  });

  const color = cssVar("--series-1");
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  root.appendChild(svg("path", {
    d: `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`,
    fill: color, "fill-opacity": "0.1", stroke: "none"
  }));
  root.appendChild(svg("path", {
    d: line, fill: "none", stroke: color, "stroke-width": "2",
    "stroke-linejoin": "round", "stroke-linecap": "round"
  }));

  // x yorliqlari - taxminan 6 ta
  const maxLabels = Math.max(2, Math.floor(iw / 58));
  const step = Math.max(1, Math.ceil(points.length / maxLabels));
  points.forEach((p, i) => {
    if (i % step && i !== points.length - 1) return;
    root.appendChild(svg("text", {
      class: "axis-text", x: x(i), y: H - 10,
      "text-anchor": i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
    }, shortDate(p.date)));
  });
  root.appendChild(svg("line", { class: "baseline", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));

  // oxirgi nuqta: 2px yuza halqasi + to'g'ridan-to'g'ri yorliq
  const lastI = points.length - 1;
  const last = points[lastI];
  root.appendChild(svg("circle", {
    cx: x(lastI), cy: y(last.value), r: 4.5,
    fill: color, stroke: cssVar("--surface-1"), "stroke-width": "2"
  }));
  if (last.value > 0) {
    root.appendChild(svg("text", {
      class: "value-text", x: x(lastI) - 8, y: y(last.value) - 9, "text-anchor": "end"
    }, fmt(last.value)));
  }

  // crosshair qatlami
  const cross = svg("line", { class: "crosshair", y1: m.t, y2: m.t + ih, opacity: "0" });
  const dot = svg("circle", { r: 4.5, fill: color, stroke: cssVar("--surface-1"), "stroke-width": "2", opacity: "0" });
  root.append(cross, dot);

  const hit = svg("rect", {
    x: m.l - iw / (points.length - 1) / 2, y: m.t,
    width: iw + iw / (points.length - 1), height: ih,
    fill: "transparent", tabindex: "0", role: "application",
    "aria-label": "Arizalar dinamikasi - chap/o'ng tugmalar bilan ko'ring"
  });
  root.appendChild(hit);

  let active = -1;
  const focusAt = (i, clientX, clientY) => {
    active = Math.max(0, Math.min(points.length - 1, i));
    const p = points[active];
    cross.setAttribute("x1", x(active));
    cross.setAttribute("x2", x(active));
    cross.setAttribute("opacity", "1");
    dot.setAttribute("cx", x(active));
    dot.setAttribute("cy", y(p.value));
    dot.setAttribute("opacity", "1");
    const box = root.getBoundingClientRect();
    tip.show(
      tipContent(unit === "hafta" ? `${fullDate(p.date)} dan boshlab` : fullDate(p.date),
        [{ name: "ariza", value: fmt(p.value), color }]),
      clientX ?? box.left + x(active), clientY ?? box.top + y(p.value)
    );
  };
  const clear = () => {
    active = -1;
    cross.setAttribute("opacity", "0");
    dot.setAttribute("opacity", "0");
    tip.hide();
  };

  hit.addEventListener("pointermove", (ev) => {
    const box = root.getBoundingClientRect();
    const rel = ((ev.clientX - box.left) / box.width) * W;
    const i = Math.round(((rel - m.l) / iw) * (points.length - 1));
    focusAt(i, ev.clientX, ev.clientY);
  });
  hit.addEventListener("pointerleave", clear);
  hit.addEventListener("blur", clear);
  hit.addEventListener("focus", () => focusAt(active < 0 ? points.length - 1 : active));
  hit.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowRight") { focusAt(active + 1); ev.preventDefault(); }
    else if (ev.key === "ArrowLeft") { focusAt(active - 1); ev.preventDefault(); }
    else if (ev.key === "Escape") clear();
  });

  host.replaceChildren(root);
}

function tableTrend(host, rows) {
  const { points, unit } = trendBuckets(rows);
  host.replaceChildren(buildTable(
    [unit === "hafta" ? "Hafta boshi" : "Sana", "Arizalar"],
    points.slice().reverse().map((p) => [fullDate(p.date), fmt(p.value)]),
    [false, true]
  ));
}

// ---------- 2. Sertifikat turlari: gorizontal stacked bar ----------
function drawCertStack(host, rows) {
  const counts = countBy(rows, (r) => r.certType);
  const total = rows.length;
  const parts = CERT_TYPES
    .map((t) => ({ id: t.id, label: t.label, value: counts.get(t.id) || 0, color: certColor(t.id) }))
    .filter((p) => p.value > 0);

  const others = [...counts.entries()].filter(([k]) => !CERT_TYPES.some((t) => t.id === k));
  if (others.length) {
    parts.push({ id: "other", label: "Boshqa", value: others.reduce((s, [, v]) => s + v, 0), color: cssVar("--series-de") });
  }

  if (!parts.length) {
    host.replaceChildren(elem("p", { class: "mini-empty" }, "Ma'lumot yo'q."));
    return;
  }

  const W = host.clientWidth || 420;
  const barH = 46;
  const GAP = 2;                       // yuza bo'shlig'i - chegara emas
  const H = barH;
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  root.appendChild(svg("title", {}, "Sertifikat turlari bo'yicha ulush"));

  const usable = W - GAP * (parts.length - 1);
  let cursor = 0;

  parts.forEach((p, i) => {
    const w = (p.value / total) * usable;
    const first = i === 0;
    const lastSeg = i === parts.length - 1;
    const r = 4;
    // chetki segmentlarning tashqi burchaklari yumaloq
    const path = roundedRectPath(cursor, 0, Math.max(w, 1), barH,
      { tl: first ? r : 0, bl: first ? r : 0, tr: lastSeg ? r : 0, br: lastSeg ? r : 0 });

    const mark = svg("path", { class: "mark", d: path, fill: p.color });
    root.appendChild(mark);

    // yorliq faqat sig'sa ichkariga yoziladi - qirqilgan matn bo'lmaydi
    const text = `${p.label} ${pct(p.value, total)}`;
    if (measure(text, 11.5) + 20 < w) {
      root.appendChild(svg("text", {
        class: "inset-text", x: cursor + w / 2, y: barH / 2 + 4,
        "text-anchor": "middle", fill: inkOn(p.color)
      }, text));
    }

    const hit = svg("rect", {
      class: "mark-hit", x: cursor, y: 0, width: Math.max(w, 1), height: barH,
      tabindex: "0", role: "img", "aria-label": `${p.label}: ${p.value} ta ariza, ${pct(p.value, total)}`
    });
    hit.__marks = [mark];
    attachTip(hit, host, () => tipContent(p.label, [
      { name: `ariza · ${pct(p.value, total)}`, value: fmt(p.value), color: p.color }
    ]));
    root.appendChild(hit);

    cursor += w + GAP;
  });

  const legend = elem("div", { class: "legend" });
  parts.forEach((p) => {
    const item = elem("div", { class: "legend-item" });
    const key = elem("span", { class: "legend-key" });
    key.style.background = p.color;
    item.append(key, elem("span", {}, p.label), elem("span", { class: "legend-value" }, fmt(p.value)));
    legend.appendChild(item);
  });

  host.replaceChildren(root, legend);
}

function roundedRectPath(x, y, w, h, r) {
  const { tl = 0, tr = 0, br = 0, bl = 0 } = r;
  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`, tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : "",
    `V${y + h - br}`, br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : "",
    `H${x + bl}`, bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : "",
    `V${y + tl}`, tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : "",
    "Z"
  ].join(" ");
}

function tableCert(host, rows) {
  const counts = countBy(rows, (r) => r.certType);
  const total = rows.length;
  const data = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  host.replaceChildren(buildTable(
    ["Sertifikat turi", "Arizalar", "Ulush"],
    data.map(([k, v]) => [{ text: k, swatch: certColor(k) }, fmt(v), pct(v, total)]),
    [false, true, true]
  ));
}

// ---------- 3. Gorizontal bar (tillar, maktablar) ----------
function drawHBars(host, items, opts = {}) {
  if (!items.length) {
    host.replaceChildren(elem("p", { class: "mini-empty" }, "Ma'lumot yo'q."));
    return;
  }
  const W = host.clientWidth || 420;
  const rowH = 30;
  const barH = 18;                                   // <= 24px
  const valueW = 42;
  const GUTTER = 12;                                 // yorliq bilan belgi orasidagi havo
  const labelW = Math.min(
    Math.max(...items.map((d) => measure(d.label, 11.5, 500))) + GUTTER + 1,
    Math.max(96, W * 0.4)
  );
  const H = items.length * rowH;
  const trackW = Math.max(40, W - labelW - valueW);
  const max = Math.max(...items.map((d) => d.value));

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  root.appendChild(svg("title", {}, opts.title || "Taqsimot"));

  const total = items.reduce((s, d) => s + d.value, 0);

  items.forEach((d, i) => {
    const yTop = i * rowH + (rowH - barH) / 2;
    const w = max ? Math.max(2, (d.value / max) * trackW) : 2;
    const color = d.isOther ? cssVar("--series-de") : (opts.color || cssVar("--series-1"));

    root.appendChild(svg("text", {
      class: "label-text", x: labelW - GUTTER, y: i * rowH + rowH / 2 + 4, "text-anchor": "end"
    }, truncate(d.label, labelW - GUTTER, 11.5, 500)));

    // 4px yumaloq uch, poydevorda to'g'ri burchak
    const mark = svg("path", {
      class: "mark",
      d: roundedRectPath(labelW, yTop, w, barH, { tr: 4, br: 4 }),
      fill: color
    });
    root.appendChild(mark);

    root.appendChild(svg("text", {
      class: "value-text", x: labelW + w + 8, y: i * rowH + rowH / 2 + 4
    }, fmt(d.value)));

    const hit = svg("rect", {
      class: "mark-hit", x: 0, y: i * rowH, width: W, height: rowH,
      tabindex: "0", role: "img", "aria-label": `${d.label}: ${d.value} ta ariza`
    });
    hit.__marks = [mark];
    attachTip(hit, host, () => tipContent(d.label, [
      { name: `ariza · ${pct(d.value, total)}`, value: fmt(d.value), color }
    ]));
    root.appendChild(hit);
  });

  host.replaceChildren(root);
}

function truncate(text, maxW, size, weight) {
  if (measure(text, size, weight) <= maxW) return text;
  let s = String(text);
  while (s.length > 1 && measure(s + "…", size, weight) > maxW) s = s.slice(0, -1);
  return s + "…";
}

// ---------- 4. Vertikal ustunlar (sinflar, natijalar) ----------
function drawColumns(host, items, opts = {}) {
  if (!items.length) {
    host.replaceChildren(elem("p", { class: "mini-empty" }, "Ma'lumot yo'q."));
    return;
  }
  const W = host.clientWidth || 420;
  const H = opts.height || 220;
  const m = { t: 22, r: 6, b: 26, l: 30 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const max = Math.max(...items.map((d) => d.value));
  const { max: top, ticks } = niceTicks(max, 3);

  const band = iw / items.length;
  const barW = Math.min(24, band * 0.62);            // <= 24px, qolgani havo
  const color = opts.color || cssVar("--series-1");
  const total = items.reduce((s, d) => s + d.value, 0);

  // Yorliqlar bir-biriga tegib ketmasligi uchun kerak bo'lsa oralatib chiziladi
  const widestLabel = Math.max(...items.map((d) => measure(d.label, 11, 400)));
  const labelStep = Math.max(1, Math.ceil((widestLabel + 8) / band));

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  root.appendChild(svg("title", {}, opts.title || "Taqsimot"));

  const y = (v) => m.t + ih - (v / top) * ih;

  ticks.forEach((t) => {
    root.appendChild(svg("line", { class: "gridline", x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    root.appendChild(svg("text", { class: "axis-text", x: m.l - 7, y: y(t) + 3.5, "text-anchor": "end" }, fmt(t)));
  });

  items.forEach((d, i) => {
    const cx = m.l + band * i + band / 2;
    const h = d.value ? Math.max(2, (d.value / top) * ih) : 0;
    const yTop = m.t + ih - h;

    let mark = null;
    if (h > 0) {
      mark = svg("path", {
        class: "mark",
        d: roundedRectPath(cx - barW / 2, yTop, barW, h, { tl: 4, tr: 4 }),
        fill: color
      });
      root.appendChild(mark);
      root.appendChild(svg("text", {
        class: "value-text", x: cx, y: yTop - 7, "text-anchor": "middle"
      }, fmt(d.value)));
    }

    if (i % labelStep === 0 || i === items.length - 1) {
      root.appendChild(svg("text", {
        class: "axis-text", x: cx, y: H - 8, "text-anchor": "middle"
      }, d.label));
    }

    const hit = svg("rect", {
      class: "mark-hit", x: m.l + band * i, y: m.t, width: band, height: ih,
      tabindex: "0", role: "img", "aria-label": `${d.label}: ${d.value} ta ariza`
    });
    hit.__marks = mark ? [mark] : [];
    attachTip(hit, host, () => tipContent(opts.labelPrefix ? opts.labelPrefix + d.label : d.label, [
      { name: `ariza · ${pct(d.value, total)}`, value: fmt(d.value), color }
    ]));
    root.appendChild(hit);
  });

  root.appendChild(svg("line", { class: "baseline", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));
  host.replaceChildren(root);
}

// ---------- 5. Natijalar: kichik multipl ----------
function drawResults(host, rows) {
  host.replaceChildren();
  CERT_TYPES.forEach((t) => {
    const subset = rows.filter((r) => r.certType === t.id);
    const wrap = elem("div");
    const title = elem("p", { class: "mini-title" });
    const dot = elem("span", { class: "pill-dot" });
    dot.style.background = certColor(t.id);
    title.append(dot, document.createTextNode(t.label));
    wrap.appendChild(title);
    wrap.appendChild(elem("p", { class: "mini-sub" }, `${fmt(subset.length)} ta ariza`));

    const plot = elem("div", { class: "viz" });
    wrap.appendChild(plot);
    host.appendChild(wrap);

    if (!subset.length) {
      plot.replaceChildren(elem("p", { class: "mini-empty" }, "Ariza yo'q."));
      return;
    }
    drawColumns(plot, resultItems(subset, t.id), {
      color: certColor(t.id),
      height: 190,
      title: `${t.label} natijalari`,
      labelPrefix: t.label + " "
    });
  });
}

function resultItems(subset, certId) {
  const counts = countBy(subset, (r) => r.result);
  if (certId === "SAT") {
    // SAT ballari uzluksiz - 50 ballik oraliqlarga guruhlanadi
    const bins = new Map();
    subset.forEach((r) => {
      const v = parseFloat(r.result);
      if (isNaN(v)) return;
      const lo = Math.floor(v / 50) * 50;
      bins.set(lo, (bins.get(lo) || 0) + 1);
    });
    return [...bins.entries()].sort((a, b) => a[0] - b[0])
      .map(([lo, value]) => ({ label: `${lo}+`, value }));
  }
  const order = RESULT_ORDER[certId] || [];
  const known = order.filter((k) => counts.has(k)).map((k) => ({ label: k, value: counts.get(k) }));
  const extra = [...counts.entries()].filter(([k]) => !order.includes(k))
    .sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  return known.concat(extra);
}

function tableResults(host, rows) {
  const body = [];
  CERT_TYPES.forEach((t) => {
    const subset = rows.filter((r) => r.certType === t.id);
    resultItems(subset, t.id).forEach((d) => {
      body.push([{ text: t.label, swatch: certColor(t.id) }, d.label, fmt(d.value), pct(d.value, subset.length)]);
    });
  });
  host.replaceChildren(body.length
    ? buildTable(["Sertifikat", "Natija", "Arizalar", "Tur ichidagi ulush"], body, [false, false, true, true])
    : elem("p", { class: "mini-empty" }, "Ma'lumot yo'q."));
}

// ---------- Umumiy kichik jadval ----------
function buildTable(headers, rows, numeric = []) {
  const table = elem("table", { class: "mini-table" });
  const thead = elem("thead");
  const hr = elem("tr");
  headers.forEach((h, i) => hr.appendChild(elem("th", { class: numeric[i] ? "num" : null }, h)));
  thead.appendChild(hr);
  const tbody = elem("tbody");
  rows.forEach((cells) => {
    const tr = elem("tr");
    cells.forEach((c, i) => {
      const td = elem("td", { class: numeric[i] ? "num" : null });
      if (c && typeof c === "object") {
        const sw = elem("span", { class: "swatch" });
        sw.style.background = c.swatch;
        td.append(sw, document.createTextNode(c.text));
      } else {
        td.textContent = c;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);
  return table;
}

// ============================================================
//  RENDER
// ============================================================

const CHARTS = {
  trend: { chart: (h, r) => drawTrend(h, r), table: tableTrend },
  cert: { chart: drawCertStack, table: tableCert },
  lang: {
    chart: (h, r) => drawHBars(h, topN(countBy(r, (x) => x.language), 7), { title: "Xorijiy tillar" }),
    table: (h, r) => {
      const total = r.length;
      h.replaceChildren(buildTable(["Xorijiy til", "Arizalar", "Ulush"],
        topN(countBy(r, (x) => x.language), 7).map((d) => [d.label, fmt(d.value), pct(d.value, total)]),
        [false, true, true]));
    }
  },
  grade: {
    chart: (h, r) => drawColumns(h, gradeItems(r), { title: "Sinflar", labelPrefix: "" }),
    table: (h, r) => {
      const total = r.length;
      h.replaceChildren(buildTable(["Sinf", "Arizalar", "Ulush"],
        gradeItems(r).map((d) => [d.label, fmt(d.value), pct(d.value, total)]), [false, true, true]));
    }
  },
  school: {
    chart: (h, r) => drawHBars(h, schoolItems(r), { title: "Maktablar" }),
    table: (h, r) => {
      const total = r.length;
      h.replaceChildren(buildTable(["Maktab", "Arizalar", "Ulush"],
        schoolItems(r).map((d) => [d.label, fmt(d.value), pct(d.value, total)]), [false, true, true]));
    }
  },
  result: { chart: drawResults, table: tableResults }
};

function gradeItems(rows) {
  const counts = countBy(rows, (r) => r.grade);
  return [...counts.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([label, value]) => ({ label: label + "-sinf", value }));
}

function schoolItems(rows) {
  const counts = countBy(rows, (r) => r.school);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .slice(0, 10)
    .map(([label, value]) => ({ label: label + "-maktab", value }));
}

function renderKPIs(rows) {
  const total = rows.length;
  $("#hero-value").textContent = fmt(total);

  const schools = new Set(rows.map((r) => r.school).filter(Boolean));
  $("#kpi-schools").textContent = fmt(schools.size);
  $("#kpi-schools-note").textContent = total
    ? `O'rtacha har bir maktabdan ${(total / Math.max(1, schools.size)).toFixed(1)} ta`
    : "";

  const weekAgo = new Date();
  weekAgo.setHours(0, 0, 0, 0);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const week = rows.filter((r) => r.ts && r.ts >= weekAgo).length;
  $("#kpi-week").textContent = fmt(week);
  $("#kpi-week-note").textContent = total ? `Jami arizalarning ${pct(week, total)} i` : "";

  const high = rows.filter(isHighLevel).length;
  $("#kpi-high").textContent = fmt(high);
  $("#kpi-high-note").textContent = total ? `Jami arizalarning ${pct(high, total)} i` : "";

  const dated = rows.filter((r) => r.ts).map((r) => r.ts).sort((a, b) => a - b);
  $("#hero-note").textContent = dated.length
    ? `${fullDate(dated[0])} - ${fullDate(dated[dated.length - 1])}`
    : "";
}

function renderCard(name) {
  const section = document.querySelector(`.chart-card[data-chart="${name}"]`);
  if (!section) return;
  const host = section.querySelector(".viz");
  const view = state.views[name] || "chart";
  host.classList.toggle("viz-multiples", name === "result" && view === "chart");
  CHARTS[name][view](host, state.filtered);
}

function renderCharts() {
  Object.keys(CHARTS).forEach(renderCard);
}

function renderAll() {
  applyFilters();
  const hasRows = state.rows.length > 0;
  const hasMatch = state.filtered.length > 0;

  $("#state-empty").hidden = hasRows;
  $("#state-nomatch").hidden = !hasRows || hasMatch;
  $("#content").hidden = !hasMatch;
  if (!hasMatch) return;

  renderKPIs(state.filtered);
  renderCharts();
  renderTable();
}

// ============================================================
//  ARIZALAR JADVALI
// ============================================================

function maskPhone(phone) {
  if (!state.maskPhones) return phone;
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return phone;
  const tail = d.slice(-2);
  const op = d.length >= 12 ? d.slice(3, 5) : d.slice(0, 2);
  return `+998 ${op} *** ** ${tail}`;
}

function sortedRows() {
  const { key, dir } = state.sort;
  const mul = dir === "asc" ? 1 : -1;
  return state.filtered.slice().sort((a, b) => {
    let x = a[key], y = b[key];
    if (key === "school" || key === "grade") { x = Number(x) || 0; y = Number(y) || 0; }
    else if (key === "result") { x = parseFloat(x) || x; y = parseFloat(y) || y; }
    if (x instanceof Date || y instanceof Date) { x = x ? x.getTime() : 0; y = y ? y.getTime() : 0; }
    if (typeof x === "string" && typeof y === "string") return x.localeCompare(y, "uz") * mul;
    return (x > y ? 1 : x < y ? -1 : 0) * mul;
  });
}

function renderTable() {
  const rows = sortedRows();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const slice = rows.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);

  const body = $("#table-body");
  body.replaceChildren();

  slice.forEach((r) => {
    const tr = elem("tr");
    tr.appendChild(elem("td", { class: "cell-num" }, r.ts ? fullDate(r.ts) : "—"));
    tr.appendChild(elem("td", { class: "cell-num" }, r.school ? r.school + "-maktab" : "—"));
    tr.appendChild(elem("td", { class: "cell-num" }, r.grade ? r.grade + "-sinf" : "—"));
    tr.appendChild(elem("td", { class: "cell-name" }, r.fish));
    tr.appendChild(elem("td", {}, r.language));

    const certTd = elem("td");
    const pill = elem("span", { class: "pill" });
    const dot = elem("span", { class: "pill-dot" });
    dot.style.background = certColor(r.certType);
    pill.append(dot, document.createTextNode(r.certType || "—"));
    certTd.appendChild(pill);
    tr.appendChild(certTd);

    tr.appendChild(elem("td", { class: "cell-num" }, r.result || "—"));
    tr.appendChild(elem("td", { class: "cell-num" }, r.certDate ? fullDate(r.certDate) : "—"));
    tr.appendChild(elem("td", { class: "cell-phone" }, maskPhone(r.phone)));
    body.appendChild(tr);
  });

  const from = rows.length ? state.page * PAGE_SIZE + 1 : 0;
  const to = Math.min(rows.length, (state.page + 1) * PAGE_SIZE);
  $("#page-info").textContent = `${fmt(from)}-${fmt(to)} / ${fmt(rows.length)} ta ariza`;
  $("#table-sub").textContent = `Filtrga mos ${fmt(rows.length)} ta yozuv`;
  $("#page-prev").disabled = state.page === 0;
  $("#page-next").disabled = state.page >= pages - 1;

  $$(".th-sort").forEach((btn) => {
    if (btn.dataset.sort === state.sort.key) btn.dataset.dir = state.sort.dir;
    else delete btn.dataset.dir;
  });
}

function exportCsv() {
  const head = ["Sana", "Maktab", "Sinf", "Ismi-sharifi", "Xorijiy til", "Sertifikat turi", "Natija", "Berilgan sana", "Telefon"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(";")];

  sortedRows().forEach((r) => {
    lines.push([
      r.ts ? fullDate(r.ts) : "",
      r.school, r.grade, r.fish, r.language, r.certType, r.result,
      r.certDate ? fullDate(r.certDate) : "",
      maskPhone(r.phone)
    ].map(esc).join(";"));
  });

  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const a = elem("a", { href: URL.createObjectURL(blob), download: `arizalar-${dayKey(new Date())}.csv` });
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

// ============================================================
//  FILTR ELEMENTLARINI TO'LDIRISH
// ============================================================

function fillFilterOptions() {
  const fill = (sel, values, labelFn = (v) => v) => {
    const node = $(sel);
    const prev = node.value;
    node.replaceChildren(elem("option", { value: "" }, "Hammasi"));
    values.forEach((v) => node.appendChild(elem("option", { value: v }, labelFn(v))));
    node.value = values.includes(prev) ? prev : "";
  };

  const uniq = (fn, sort) => [...new Set(state.rows.map(fn).filter(Boolean))].sort(sort);

  fill("#f-cert", uniq((r) => r.certType, (a, b) => a.localeCompare(b)));
  fill("#f-lang", uniq((r) => r.language, (a, b) => a.localeCompare(b, "uz")));
  fill("#f-grade", uniq((r) => r.grade, (a, b) => a - b), (v) => v + "-sinf");
  fill("#f-school", uniq((r) => r.school, (a, b) => a - b), (v) => v + "-maktab");
}

// ============================================================
//  YUKLASH OQIMI
// ============================================================

function setState(name) {
  ["loading", "error", "empty", "nomatch"].forEach((s) => {
    const node = $("#state-" + s);
    if (node) node.hidden = s !== name;
  });
  if (name) $("#content").hidden = true;
}

async function refresh({ silent = false } = {}) {
  if (state.demo) return;
  if (silent) $("#content").classList.add("is-stale");
  else if (!state.rows.length) setState("loading");

  $("#refresh").disabled = true;
  try {
    const data = await loadData();
    if (!data || data.ok === false) throw new Error(data && data.error === "unauthorized" ? "Kirish kaliti noto'g'ri" : (data && data.error) || "Noma'lum xato");
    state.rows = normalize(data.rows);
    state.updatedAt = new Date(data.updatedAt || Date.now());
    setState(null);
    fillFilterOptions();
    renderAll();
    updateSync();
  } catch (err) {
    console.error(err);
    if (!state.rows.length) {
      setState("error");
      $("#error-detail").textContent = String(err.message || err);
    } else {
      $("#sync").textContent = "Yangilab bo'lmadi";
    }
  } finally {
    $("#refresh").disabled = false;
    $("#content").classList.remove("is-stale");
  }
}

function updateSync() {
  if (!state.updatedAt) return;
  const t = state.updatedAt;
  $("#sync").textContent = `Yangilandi ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

function startDemo() {
  state.demo = true;
  state.rows = normalize(demoRows());
  state.updatedAt = new Date();
  $("#demo-badge").hidden = false;
  $("#sync").textContent = "";
  $("#gate").hidden = true;
  $("#app").hidden = false;
  setState(null);
  fillFilterOptions();
  renderAll();
}

// ============================================================
//  HODISALAR
// ============================================================

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_STORAGE, theme); } catch (_) {}
  if (!$("#content").hidden) renderCharts();   // SVG ranglari CSS o'zgaruvchilaridan olinadi
}

function currentTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function bindEvents() {
  // filtrlar
  $$(".chip[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filters.range = btn.dataset.range;
      $$(".chip[data-range]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      renderAll();
    });
  });

  const bind = (sel, key, event = "change") => {
    $(sel).addEventListener(event, (e) => {
      state.filters[key] = e.target.value;
      renderAll();
    });
  };
  bind("#f-cert", "cert");
  bind("#f-lang", "lang");
  bind("#f-grade", "grade");
  bind("#f-school", "school");

  let searchTimer;
  $("#f-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const v = e.target.value;
    searchTimer = setTimeout(() => { state.filters.search = v; renderAll(); }, 180);
  });

  $("#f-reset").addEventListener("click", () => {
    state.filters = { range: "all", cert: "", lang: "", grade: "", school: "", search: "" };
    $$(".chip[data-range]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === "all")));
    ["#f-cert", "#f-lang", "#f-grade", "#f-school", "#f-search"].forEach((s) => { $(s).value = ""; });
    renderAll();
  });

  // grafik / jadval almashtirish
  $$(".chart-card").forEach((section) => {
    const name = section.dataset.chart;
    section.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.views[name] = btn.dataset.view;
        section.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
        renderCard(name);
      });
    });
  });

  // jadval
  $$(".th-sort").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      else state.sort = { key, dir: key === "ts" || key === "certDate" ? "desc" : "asc" };
      state.page = 0;
      renderTable();
    });
  });
  $("#page-prev").addEventListener("click", () => { state.page--; renderTable(); });
  $("#page-next").addEventListener("click", () => { state.page++; renderTable(); });
  $("#mask-phones").addEventListener("change", (e) => { state.maskPhones = e.target.checked; renderTable(); });
  $("#export-csv").addEventListener("click", exportCsv);

  // yuqori panel
  $("#refresh").addEventListener("click", () => refresh({ silent: true }));
  $("#theme").addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));
  $("#error-retry").addEventListener("click", () => refresh());
  $("#error-demo").addEventListener("click", startDemo);

  // o'lcham o'zgarsa grafiklar qayta chiziladi
  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!$("#content").hidden) renderCharts(); }, 150);
  });

  // OS mavzusi o'zgarsa (qo'lda tanlanmagan bo'lsa)
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    let stored = null;
    try { stored = localStorage.getItem(THEME_STORAGE); } catch (_) {}
    if (!stored && !$("#content").hidden) renderCharts();
  });
}

function bindGate() {
  $("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = $("#gate-key").value.trim();
    if (!key) return;
    state.key = key;
    $("#gate-error").hidden = true;

    const btn = $("#gate-form .btn-primary");
    btn.disabled = true;
    btn.textContent = "Tekshirilmoqda…";
    try {
      const data = await loadData();
      if (!data || data.ok === false) throw new Error((data && data.error) || "error");
      try { localStorage.setItem(KEY_STORAGE, key); } catch (_) {}
      state.rows = normalize(data.rows);
      state.updatedAt = new Date(data.updatedAt || Date.now());
      $("#gate").hidden = true;
      $("#app").hidden = false;
      setState(null);
      fillFilterOptions();
      renderAll();
      updateSync();
    } catch (err) {
      $("#gate-error").textContent = String(err.message) === "unauthorized" ? "Kalit noto'g'ri." : "Ulanib bo'lmadi: " + err.message;
      $("#gate-error").hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Kirish";
    }
  });

  $("#gate-demo").addEventListener("click", startDemo);
}

// ============================================================
//  START
// ============================================================

(function init() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE);
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    else document.documentElement.removeAttribute("data-theme");
  } catch (_) {
    document.documentElement.removeAttribute("data-theme");
  }

  bindEvents();
  bindGate();

  let savedKey = "";
  try { savedKey = localStorage.getItem(KEY_STORAGE) || ""; } catch (_) {}

  if (savedKey) {
    state.key = savedKey;
    $("#app").hidden = false;
    refresh();
  } else {
    $("#gate").hidden = false;
  }

  // har 2 daqiqada jim yangilanish - ko'rinish sakramaydi
  setInterval(() => {
    if (!document.hidden && !state.demo && state.rows.length) refresh({ silent: true });
  }, 120000);
})();
