// ============================================================
//  Statistika paneli
//  Manba: Apps Script Web App (doGet?action=data) - uchta sahifa:
//    Arizalar (index.html) · Yoshlar (register.html) · Markazlar
//  Grafiklar qo'lda SVG bilan chiziladi - tashqi kutubxona yo'q.
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOsfh4if4NsK4pYWgmHDYIGM9Z2vR8YeLI8QcQqata_zdJrAlTNuO1fObLt4WMpVZB/exec";

const PAGE_SIZE = 25;
const KEY_STORAGE = "dash_key";
const THEME_STORAGE = "dash_theme";
const VIEW_STORAGE = "dash_view";

// Sertifikat turlari - rang entity'ga biriktirilgan, filtrda o'zgarmaydi
const CERT_TYPES = [
  { id: "CEFR", label: "CEFR", varName: "--series-1" },
  { id: "IELTS", label: "IELTS", varName: "--series-2" },
  { id: "SAT", label: "SAT", varName: "--series-3" }
];

const SOURCES = {
  applications: { label: "Arizalar", varName: "--series-1" },
  youth: { label: "Yoshlar", varName: "--series-2" }
};

const RESULT_ORDER = {
  CEFR: ["B2", "C1", "C2"],
  IELTS: ["5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"]
};

const state = {
  data: { applications: [], youth: [], centers: [] },
  view: "overview",
  rows: [],          // joriy ko'rinishning to'liq to'plami
  filtered: [],
  demo: false,
  stale: false,
  key: "",
  updatedAt: null,
  filters: emptyFilters(),
  views: {},
  sort: { key: "ts", dir: "desc" },
  page: 0,
  maskPhones: true
};

function emptyFilters() {
  return { range: "all", cert: "", lang: "", grade: "", school: "", center: "", social: "", search: "" };
}

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
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (n) => Number(n).toLocaleString("ru-RU").replace(/ /g, " ");

function pct(part, total) {
  if (!total) return "0%";
  const v = (part / total) * 100;
  return (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + "%";
}

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

/** "36" → "36-maktab"; "Ixtisoslashtirilgan maktab" → o'zgarmaydi */
function schoolLabel(value) {
  const v = String(value || "").trim();
  if (!v) return "—";
  return /^\d+$/.test(v) ? v + "-maktab" : v;
}

function certColor(id) {
  const t = CERT_TYPES.find((c) => c.id === id);
  return cssVar(t ? t.varName : "--series-de");
}

// ============================================================
//  MA'LUMOT OLISH
// ============================================================

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

function jsonp(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const name = "__dash_cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const done = (fn) => { clearTimeout(timer); delete window[name]; script.remove(); fn(); };
    const timer = setTimeout(() => done(() => reject(new Error("Javob kelmadi (timeout)"))), timeout);
    window[name] = (data) => done(() => resolve(data));
    script.onerror = () => done(() => reject(new Error("Tarmoq xatosi")));
    script.src = url + "&callback=" + name;
    document.body.appendChild(script);
  });
}

function normalizeYouth(rows, source) {
  return (rows || [])
    .map((r) => ({
      source,
      ts: parseDate(r.ts),
      school: String(r.school ?? "").trim(),
      grade: String(r.grade ?? "").trim(),
      fish: String(r.fish ?? "").trim(),
      language: String(r.language ?? "").trim() || "Ko'rsatilmagan",
      certType: String(r.certType ?? "").trim(),
      certDate: parseDate(r.certDate),
      result: String(r.result ?? "").trim(),
      phone: String(r.phone ?? "").trim(),
      social: String(r.social ?? "").trim(),
      center: String(r.center ?? "").trim()
    }))
    .filter((r) => r.fish);
}

function normalizeCenters(rows) {
  return (rows || [])
    .map((r) => ({
      source: "centers",
      ts: parseDate(r.ts),
      name: String(r.name ?? "").trim(),
      phone: String(r.phone ?? "").trim(),
      logo: String(r.logo ?? "").trim(),
      staff: Number(r.staff) || 0,
      clubCount: Number(r.clubCount) || 0,
      clubs: Array.isArray(r.clubs) ? r.clubs.map((c) => ({ name: String(c.name), count: Number(c.count) || 0 })) : [],
      students: Number(r.students) || 0
    }))
    .filter((r) => r.name);
}

/**
 * Eski deployment `{ rows: [...] }` qaytaradi, yangisi esa uchta ro'yxat.
 * Shu farqni aniqlab, foydalanuvchiga aniq ayt.
 */
function detectStale(payload) {
  const hasNew = ["applications", "youth", "centers"].some((k) => Array.isArray(payload[k]));
  const banner = $("#stale-banner");
  if (hasNew) {
    state.stale = false;
    banner.hidden = true;
    return payload;
  }

  state.stale = true;
  banner.hidden = false;
  $("#stale-detail").textContent = Array.isArray(payload.rows)
    ? `Javobda faqat eski "rows" maydoni bor (${payload.rows.length} ta yozuv) - "Arizalar" sifatida ko'rsatilmoqda. `
      + 'Yangi kodni qo\'ygandan keyin Deploy → Manage deployments → ✏️ → Version: New version → Deploy qiling.'
    : 'Javobda kutilgan maydonlar yo\'q. Apps Script kodini yangilab, Deploy → Manage deployments → ✏️ → '
      + 'Version: New version → Deploy qiling, so\'ng setupRegisterSheets ni ishga tushiring.';

  return Array.isArray(payload.rows)
    ? Object.assign({}, payload, { applications: payload.rows, youth: [], centers: [] })
    : payload;
}

function ingest(raw) {
  const payload = detectStale(raw);
  state.data.applications = normalizeYouth(payload.applications, "applications")
    .sort((a, b) => (b.ts?.getTime() || 0) - (a.ts?.getTime() || 0));
  state.data.youth = normalizeYouth(payload.youth, "youth")
    .sort((a, b) => (b.ts?.getTime() || 0) - (a.ts?.getTime() || 0));
  state.data.centers = normalizeCenters(payload.centers)
    .sort((a, b) => (b.ts?.getTime() || 0) - (a.ts?.getTime() || 0));
  state.updatedAt = new Date(payload.updatedAt || Date.now());
}

// ---------- Demo ----------
function demoPayload() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const langs = ["Ingliz tili", "Ingliz tili", "Ingliz tili", "Ingliz tili", "Nemis tili",
    "Koreys tili", "Yapon tili", "Turk tili", "Arab tili", "Rus tili", "Xitoy tili"];
  const names = ["Raxmonaliyev Abubakir", "Tursunova Nilufar", "Qodirov Javohir", "Yo'ldosheva Sevinch",
    "Ergashev Doniyor", "Umarova Malika", "Sobirov Bekzod", "Aliyeva Ruxshona", "Nazarov Shahzod",
    "Karimova Zilola", "To'xtasinov Islom", "Mirzayeva Dilnoza", "Hasanov Asadbek", "Yusupova Gulnoza"];
  const patronyms = ["Komiljon o'g'li", "Alisher qizi", "Bahodir o'g'li", "Rustam qizi", "Anvar o'g'li"];
  const centerNames = ["Baliqchi Edu Center", "Smart Academy", "Oxford Lingua", "Bilim Plus",
    "IT Start", "Zehn Academy", "Global Kids"];
  const subjects = ["Ingliz tili", "Matematika", "Rus tili", "Informatika", "Fizika", "Kimyo",
    "Robototexnika", "Shaxmat", "Dasturlash", "Nemis tili", "Biologiya", "Tarix"];

  const youthRow = (maxDays, withExtras) => {
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.7) * maxDays);
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

    const row = {
      ts: ts.toISOString().slice(0, 19),
      school: String(pick([1, 2, 3, 5, 7, 9, 11, 12, 14, 16, 18, 21, 23, 24, 27, 30, 33, 36, 36, 36, 41, 44, 48, 52, 57, 61])),
      grade: String(pick([5, 6, 7, 8, 9, 9, 10, 10, 10, 11, 11, 11])),
      fish: `${pick(names)} ${pick(patronyms)}`,
      language: pick(langs),
      certType, certDate: dayKey(certDate), result,
      phone: `+998 ${pick([90, 91, 93, 94, 95, 97, 99])} ${100 + Math.floor(Math.random() * 900)} ${10 + Math.floor(Math.random() * 90)} ${10 + Math.floor(Math.random() * 90)}`
    };
    if (withExtras) {
      row.social = Math.random() < 0.18 ? "Ha" : "Yo'q";
      row.center = Math.random() < 0.72 ? pick(centerNames) : "Markazga a'zo emas";
    }
    return row;
  };

  const centers = centerNames.map((name, i) => {
    const ts = new Date();
    ts.setDate(ts.getDate() - Math.floor(Math.random() * 120));
    const used = new Set();
    const clubs = [];
    const n = 2 + Math.floor(Math.random() * 5);
    while (clubs.length < n) {
      const subj = pick(subjects);
      if (used.has(subj)) continue;
      used.add(subj);
      clubs.push({ name: subj, count: 8 + Math.floor(Math.random() * 55) });
    }
    return {
      ts: ts.toISOString().slice(0, 19),
      name,
      phone: `+998 ${pick([74, 90, 91, 93])} ${100 + Math.floor(Math.random() * 900)} ${10 + Math.floor(Math.random() * 90)} ${10 + Math.floor(Math.random() * 90)}`,
      logo: i % 3 === 0 ? "" : "https://drive.google.com/file/d/demo/view",
      staff: 6 + Math.floor(Math.random() * 22),
      clubCount: clubs.length,
      clubs,
      students: clubs.reduce((s, c) => s + c.count, 0)
    };
  });

  return {
    applications: Array.from({ length: 184 }, () => youthRow(150, false)),
    youth: Array.from({ length: 96 }, () => youthRow(90, true)),
    centers,
    updatedAt: new Date().toISOString()
  };
}

// ============================================================
//  KO'RINISHLAR
// ============================================================

const VIEWS = {
  overview: {
    label: "Umumiy",
    rows: () => state.data.applications.concat(state.data.youth),
    kind: "youth",
    heroLabel: "Ro'yxatdan o'tgan yoshlar",
    tableTitle: "Barcha yozuvlar",
    tableSub: "Arizalar va Yoshlar sahifalari birgalikda"
  },
  applications: {
    label: "Arizalar",
    rows: () => state.data.applications,
    kind: "youth",
    heroLabel: "Jami arizalar",
    tableTitle: "Arizalar ro'yxati",
    tableSub: '"Arizalar" sahifasi - index.html formasi'
  },
  youth: {
    label: "Yoshlar",
    rows: () => state.data.youth,
    kind: "youth",
    heroLabel: "Jami yozuvlar",
    tableTitle: "Iqtidorli yoshlar",
    tableSub: '"Yoshlar" sahifasi - register.html formasi'
  },
  centers: {
    label: "O'quv markazlari",
    rows: () => state.data.centers,
    kind: "centers",
    heroLabel: "O'quv markazlari",
    tableTitle: "Markazlar ro'yxati",
    tableSub: '"Markazlar" sahifasi'
  }
};

const view = () => VIEWS[state.view];
const isCenters = () => state.view === "centers";

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

    if (isCenters()) {
      if (q) {
        const nameHit = r.name.toLowerCase().includes(q);
        const phoneHit = qDigits.length >= 3 && r.phone.replace(/\D/g, "").includes(qDigits);
        const clubHit = r.clubs.some((c) => c.name.toLowerCase().includes(q));
        if (!nameHit && !phoneHit && !clubHit) return false;
      }
      return true;
    }

    if (f.cert && r.certType !== f.cert) return false;
    if (f.lang && r.language !== f.lang) return false;
    if (f.grade && r.grade !== f.grade) return false;
    if (f.school && r.school !== f.school) return false;
    if (state.view === "youth") {
      if (f.center && r.center !== f.center) return false;
      if (f.social && r.social !== f.social) return false;
    }
    if (q) {
      const nameHit = r.fish.toLowerCase().includes(q);
      const phoneHit = qDigits.length >= 3 && r.phone.replace(/\D/g, "").includes(qDigits);
      if (!nameHit && !phoneHit) return false;
    }
    return true;
  });

  state.page = 0;
  const active = f.range !== "all" || f.cert || f.lang || f.grade || f.school || f.center || f.social || f.search;
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

function sumBy(rows, keyFn, valueFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (k === "" || k == null) return;
    map.set(k, (map.get(k) || 0) + valueFn(r));
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

/** Oqim: 70 kundan uzun davr haftalarga yig'iladi */
function trendBuckets(rows, extraSeries) {
  const all = extraSeries ? rows.concat(extraSeries) : rows;
  const dated = all.filter((r) => r.ts);
  if (!dated.length) return { points: [], unit: "kun", weekly: false };

  const times = dated.map((r) => r.ts.getTime());
  const first = new Date(Math.min(...times)); first.setHours(0, 0, 0, 0);
  const last = new Date(Math.max(...times)); last.setHours(0, 0, 0, 0);
  const spanDays = Math.round((last - first) / 86400000) + 1;
  const weekly = spanDays > 70;

  const bucketStart = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    if (weekly) x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  };

  const count = (set) => {
    const m = new Map();
    set.filter((r) => r.ts).forEach((r) => {
      const k = bucketStart(r.ts).getTime();
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  };

  const main = count(rows);
  const extra = extraSeries ? count(extraSeries) : null;

  const points = [];
  const cursor = bucketStart(first);
  const end = bucketStart(last);
  while (cursor <= end) {
    const t = cursor.getTime();
    points.push({
      date: new Date(cursor),
      value: main.get(t) || 0,
      value2: extra ? (extra.get(t) || 0) : undefined
    });
    cursor.setDate(cursor.getDate() + (weekly ? 7 : 1));
  }
  return { points, unit: weekly ? "hafta" : "kun", weekly };
}

function isHighLevel(r) {
  if (r.certType === "CEFR") return r.result === "C1" || r.result === "C2";
  if (r.certType === "IELTS") return parseFloat(r.result) >= 7;
  if (r.certType === "SAT") return parseFloat(r.result) >= 1500;
  return false;
}

/** Markazlar bo'ylab fanlar kesimi */
function subjectTotals(centers) {
  const map = new Map();
  centers.forEach((c) => c.clubs.forEach((club) => {
    map.set(club.name, (map.get(club.name) || 0) + club.count);
  }));
  return map;
}

// ============================================================
//  TOOLTIP
// ============================================================

const tip = {
  node: null,
  show(nodes, x, y) {
    if (!this.node) this.node = $("#tooltip");
    this.node.replaceChildren(...nodes);
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

function attachTip(target, viz, build) {
  const show = (ev) => {
    const r = target.getBoundingClientRect();
    const x = ev.clientX ?? r.left + r.width / 2;
    const y = ev.clientY ?? r.top;
    viz.classList.add("is-hovering");
    (target.__marks || []).forEach((m) => m.classList.add("is-hot"));
    tip.show(build(), x, y);
  };
  const hide = () => {
    viz.classList.remove("is-hovering");
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
//  GRAFIK PRIMITIVLARI
// ============================================================

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

/**
 * O'q yorliqlari uchun indekslar: qadam bo'yicha tanlanadi, so'ng
 * bir-biriga tegib ketadiganlari olib tashlanadi. Oxirgi yorliq ustuvor.
 */
function labelIndices(count, xOf, minGap) {
  const step = Math.max(1, Math.ceil(count / Math.max(2, Math.floor((xOf(count - 1) - xOf(0)) / minGap) + 1)));
  const idx = [];
  for (let i = 0; i < count; i += step) idx.push(i);
  if (idx[idx.length - 1] !== count - 1) idx.push(count - 1);
  for (let k = idx.length - 2; k >= 0; k--) {
    if (xOf(idx[k + 1]) - xOf(idx[k]) < minGap) idx.splice(k, 1);
  }
  return new Set(idx);
}

function truncate(text, maxW, size, weight) {
  if (measure(text, size, weight) <= maxW) return text;
  let s = String(text);
  while (s.length > 1 && measure(s + "…", size, weight) > maxW) s = s.slice(0, -1);
  return s + "…";
}

// ---------- Sparkline (hero) ----------
/** Sparkline faqat kattalik ko'rsata olsa chiziladi: 0/1 lik arra chiziq ma'nosiz */
function sparkIsUseful(points) {
  return points.length >= 8 && Math.max(0, ...points.map((p) => p.value)) >= 3;
}

function drawSpark(host, points) {
  if (!sparkIsUseful(points)) { host.replaceChildren(); return; }
  const W = host.clientWidth || 300;
  const H = 54;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i) => (i / (points.length - 1)) * W;
  const y = (v) => H - (v / max) * (H - 6) - 3;
  const color = cssVar("--accent");

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" });
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  root.appendChild(svg("path", { d: `${line} L${W},${H} L0,${H} Z`, fill: color, "fill-opacity": "0.1" }));
  root.appendChild(svg("path", { d: line, fill: "none", stroke: color, "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round" }));
  root.appendChild(svg("circle", {
    cx: x(points.length - 1), cy: y(points[points.length - 1].value), r: 3.5,
    fill: color, stroke: cssVar("--surface-1"), "stroke-width": "2"
  }));
  host.replaceChildren(root);
}

// ---------- Dinamika: bir yoki ikki seriya ----------
function drawTrend(host, opts) {
  const { points, unit, series } = opts;
  if (points.length < 2) {
    host.replaceChildren(elem("p", { class: "mini-empty" }, "Dinamikani ko'rsatish uchun ma'lumot yetarli emas."));
    return;
  }

  const W = host.clientWidth || 720;
  const H = 250;
  const m = { t: 16, r: 18, b: 30, l: 42 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;

  const values = points.flatMap((p) => series.map((s) => p[s.key] || 0));
  const { max, ticks } = niceTicks(Math.max(...values));
  const x = (i) => m.l + (i / (points.length - 1)) * iw;
  const y = (v) => m.t + ih - (v / max) * ih;

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  root.appendChild(svg("title", {}, "Ro'yxatga olish dinamikasi"));

  ticks.forEach((t) => {
    root.appendChild(svg("line", { class: "gridline", x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    root.appendChild(svg("text", { class: "axis-text", x: m.l - 8, y: y(t) + 3.5, "text-anchor": "end" }, fmt(t)));
  });

  series.forEach((s, si) => {
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[s.key] || 0).toFixed(1)}`).join(" ");
    if (series.length === 1) {
      root.appendChild(svg("path", {
        d: `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`,
        fill: s.color, "fill-opacity": "0.1"
      }));
    }
    root.appendChild(svg("path", {
      d: line, fill: "none", stroke: s.color, "stroke-width": "2",
      "stroke-linejoin": "round", "stroke-linecap": "round"
    }));

    // oxirgi nuqta: 2px yuza halqasi + to'g'ridan-to'g'ri yorliq
    const lastI = points.length - 1;
    const lastVal = points[lastI][s.key] || 0;
    root.appendChild(svg("circle", {
      cx: x(lastI), cy: y(lastVal), r: 4.5,
      fill: s.color, stroke: cssVar("--surface-1"), "stroke-width": "2"
    }));
    if (lastVal > 0) {
      root.appendChild(svg("text", {
        class: "value-text", x: x(lastI) - 8, y: y(lastVal) - 9 - si * 2, "text-anchor": "end"
      }, fmt(lastVal)));
    }
  });

  const minGap = measure("00.00", 10.5, 400) + 14;
  const keep = labelIndices(points.length, x, minGap);
  points.forEach((p, i) => {
    if (!keep.has(i)) return;
    root.appendChild(svg("text", {
      class: "axis-text", x: x(i), y: H - 10,
      "text-anchor": i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
    }, shortDate(p.date)));
  });
  root.appendChild(svg("line", { class: "baseline", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));

  // crosshair qatlami
  const cross = svg("line", { class: "crosshair", y1: m.t, y2: m.t + ih, opacity: "0" });
  root.appendChild(cross);
  const dots = series.map((s) => {
    const dot = svg("circle", { r: 4.5, fill: s.color, stroke: cssVar("--surface-1"), "stroke-width": "2", opacity: "0" });
    root.appendChild(dot);
    return dot;
  });

  const band = iw / (points.length - 1);
  const hit = svg("rect", {
    x: m.l - band / 2, y: m.t, width: iw + band, height: ih,
    fill: "transparent", tabindex: "0", role: "application",
    "aria-label": "Dinamika - chap/o'ng tugmalar bilan ko'ring"
  });
  root.appendChild(hit);

  let active = -1;
  const focusAt = (i, clientX, clientY) => {
    active = Math.max(0, Math.min(points.length - 1, i));
    const p = points[active];
    cross.setAttribute("x1", x(active));
    cross.setAttribute("x2", x(active));
    cross.setAttribute("opacity", "1");
    series.forEach((s, si) => {
      dots[si].setAttribute("cx", x(active));
      dots[si].setAttribute("cy", y(p[s.key] || 0));
      dots[si].setAttribute("opacity", "1");
    });
    const box = root.getBoundingClientRect();
    tip.show(
      tipContent(unit === "hafta" ? `${fullDate(p.date)} dan boshlab` : fullDate(p.date),
        series.map((s) => ({ name: s.label, value: fmt(p[s.key] || 0), color: s.color }))),
      clientX ?? box.left + x(active), clientY ?? box.top + y(p[series[0].key] || 0)
    );
  };
  const clear = () => {
    active = -1;
    cross.setAttribute("opacity", "0");
    dots.forEach((d) => d.setAttribute("opacity", "0"));
    tip.hide();
  };

  hit.addEventListener("pointermove", (ev) => {
    const box = root.getBoundingClientRect();
    const rel = ((ev.clientX - box.left) / box.width) * W;
    focusAt(Math.round(((rel - m.l) / iw) * (points.length - 1)), ev.clientX, ev.clientY);
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

  if (series.length > 1) {
    const legend = elem("div", { class: "legend" });
    series.forEach((s) => {
      const item = elem("div", { class: "legend-item" });
      const key = elem("span", { class: "legend-key is-line" });
      key.style.background = s.color;
      const total = points.reduce((sum, p) => sum + (p[s.key] || 0), 0);
      item.append(key, elem("span", {}, s.label), elem("span", { class: "legend-value" }, fmt(total)));
      legend.appendChild(item);
    });
    host.appendChild(legend);
  }
}

// ---------- Gorizontal stacked bar (ulush) ----------
function drawStack(host, parts, total) {
  parts = parts.filter((p) => p.value > 0);
  if (!parts.length) {
    host.replaceChildren(elem("p", { class: "mini-empty" }, "Ma'lumot yo'q."));
    return;
  }

  const W = host.clientWidth || 420;
  const barH = 46;
  const GAP = 2;                       // yuza bo'shlig'i - chegara emas
  const root = svg("svg", { viewBox: `0 0 ${W} ${barH}`, width: W, height: barH, role: "img" });
  root.appendChild(svg("title", {}, "Ulush"));

  const usable = W - GAP * (parts.length - 1);
  let cursor = 0;

  parts.forEach((p, i) => {
    const w = (p.value / total) * usable;
    const r = 4;
    const path = roundedRectPath(cursor, 0, Math.max(w, 1), barH, {
      tl: i === 0 ? r : 0, bl: i === 0 ? r : 0,
      tr: i === parts.length - 1 ? r : 0, br: i === parts.length - 1 ? r : 0
    });
    const mark = svg("path", { class: "mark", d: path, fill: p.color });
    root.appendChild(mark);

    const text = `${p.label} ${pct(p.value, total)}`;
    if (measure(text, 11.5) + 20 < w) {
      root.appendChild(svg("text", {
        class: "inset-text", x: cursor + w / 2, y: barH / 2 + 4,
        "text-anchor": "middle", fill: inkOn(p.color)
      }, text));
    }

    const hit = svg("rect", {
      class: "mark-hit", x: cursor, y: 0, width: Math.max(w, 1), height: barH,
      tabindex: "0", role: "img", "aria-label": `${p.label}: ${p.value}, ${pct(p.value, total)}`
    });
    hit.__marks = [mark];
    attachTip(hit, host, () => tipContent(p.label, [
      { name: `· ${pct(p.value, total)}`, value: fmt(p.value), color: p.color }
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

// ---------- Gorizontal bar ----------
function drawHBars(host, items, opts = {}) {
  if (!items.length) {
    host.replaceChildren(elem("p", { class: "mini-empty" }, "Ma'lumot yo'q."));
    return;
  }
  const W = host.clientWidth || 420;
  const rowH = 30;
  const barH = 18;                                   // <= 24px
  const GUTTER = 12;
  const valueW = Math.max(42, measure(fmt(Math.max(...items.map((d) => d.value))), 11.5, 700) + 18);
  const labelW = Math.min(
    Math.max(...items.map((d) => measure(d.label, 11.5, 500))) + GUTTER + 1,
    Math.max(96, W * 0.42)
  );
  const H = items.length * rowH;
  const trackW = Math.max(40, W - labelW - valueW);
  const max = Math.max(...items.map((d) => d.value));
  const total = items.reduce((s, d) => s + d.value, 0);

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  root.appendChild(svg("title", {}, opts.title || "Taqsimot"));

  items.forEach((d, i) => {
    const yTop = i * rowH + (rowH - barH) / 2;
    const w = max ? Math.max(2, (d.value / max) * trackW) : 2;
    const color = d.isOther ? cssVar("--series-de") : (opts.color || cssVar("--series-1"));

    root.appendChild(svg("text", {
      class: "label-text", x: labelW - GUTTER, y: i * rowH + rowH / 2 + 4, "text-anchor": "end"
    }, truncate(d.label, labelW - GUTTER, 11.5, 500)));

    const mark = svg("path", {
      class: "mark", d: roundedRectPath(labelW, yTop, w, barH, { tr: 4, br: 4 }), fill: color
    });
    root.appendChild(mark);

    root.appendChild(svg("text", {
      class: "value-text", x: labelW + w + 8, y: i * rowH + rowH / 2 + 4
    }, fmt(d.value)));

    const hit = svg("rect", {
      class: "mark-hit", x: 0, y: i * rowH, width: W, height: rowH,
      tabindex: "0", role: "img", "aria-label": `${d.label}: ${d.value}`
    });
    hit.__marks = [mark];
    attachTip(hit, host, () => tipContent(d.label, [
      { name: opts.unit ? `${opts.unit} · ${pct(d.value, total)}` : `· ${pct(d.value, total)}`, value: fmt(d.value), color }
    ]));
    root.appendChild(hit);
  });

  host.replaceChildren(root);
}

// ---------- Vertikal ustunlar ----------
function drawColumns(host, items, opts = {}) {
  if (!items.length) {
    host.replaceChildren(elem("p", { class: "mini-empty" }, "Ma'lumot yo'q."));
    return;
  }
  const W = host.clientWidth || 420;
  const H = opts.height || 220;
  const m = { t: 22, r: 6, b: 26, l: 32 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const max = Math.max(...items.map((d) => d.value));
  const { max: top, ticks } = niceTicks(max, 3);

  const band = iw / items.length;
  const barW = Math.min(24, band * 0.62);            // <= 24px, qolgani havo
  const color = opts.color || cssVar("--series-1");
  const total = items.reduce((s, d) => s + d.value, 0);

  const widestLabel = Math.max(...items.map((d) => measure(d.label, 11, 400)));
  const keep = labelIndices(items.length, (i) => m.l + band * i + band / 2, widestLabel + 10);

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
        class: "mark", d: roundedRectPath(cx - barW / 2, yTop, barW, h, { tl: 4, tr: 4 }), fill: color
      });
      root.appendChild(mark);
      root.appendChild(svg("text", { class: "value-text", x: cx, y: yTop - 7, "text-anchor": "middle" }, fmt(d.value)));
    }

    if (keep.has(i)) {
      root.appendChild(svg("text", { class: "axis-text", x: cx, y: H - 8, "text-anchor": "middle" }, d.label));
    }

    const hit = svg("rect", {
      class: "mark-hit", x: m.l + band * i, y: m.t, width: band, height: ih,
      tabindex: "0", role: "img", "aria-label": `${d.label}: ${d.value}`
    });
    hit.__marks = mark ? [mark] : [];
    attachTip(hit, host, () => tipContent((opts.labelPrefix || "") + d.label, [
      { name: `· ${pct(d.value, total)}`, value: fmt(d.value), color }
    ]));
    root.appendChild(hit);
  });

  root.appendChild(svg("line", { class: "baseline", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));
  host.replaceChildren(root);
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
//  GRAFIK KARTALARI
// ============================================================

/** Har bir karta: sarlavha + grafik/jadval almashtirgich */
function chartCard(spec) {
  const section = elem("section", { class: "card chart-card" + (spec.wide ? " chart-wide" : "") });
  section.dataset.chart = spec.id;

  const head = elem("header", { class: "card-head" });
  const titles = elem("div");
  titles.appendChild(elem("h2", { class: "card-title" }, spec.title));
  if (spec.sub) titles.appendChild(elem("p", { class: "card-sub" }, spec.sub));

  const seg = elem("div", { class: "seg", role: "group", "aria-label": "Ko'rinish" });
  const current = state.views[spec.id] || "chart";
  ["chart", "table"].forEach((mode) => {
    const btn = elem("button", { class: "seg-btn" + (current === mode ? " is-active" : "") },
      mode === "chart" ? "Grafik" : "Jadval");
    btn.dataset.view = mode;
    btn.addEventListener("click", () => {
      state.views[spec.id] = mode;
      seg.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      paint();
    });
    seg.appendChild(btn);
  });

  head.append(titles, seg);

  const body = elem("div", { class: "card-body" });
  const viz = elem("div", { class: "viz" + (spec.multiples ? " viz-multiples" : "") });
  body.appendChild(viz);
  section.append(head, body);

  const paint = () => {
    const mode = state.views[spec.id] || "chart";
    viz.classList.toggle("viz-multiples", !!spec.multiples && mode === "chart");
    spec[mode](viz);
  };
  section.__paint = paint;
  return section;
}

function renderCharts(specs) {
  const host = $("#charts");
  host.replaceChildren();

  let pairBuffer = null;
  specs.forEach((spec) => {
    const card = chartCard(spec);
    if (spec.wide) {
      pairBuffer = null;
      host.appendChild(card);
    } else {
      if (!pairBuffer) {
        pairBuffer = elem("div", { class: "grid-2" });
        host.appendChild(pairBuffer);
      }
      pairBuffer.appendChild(card);
      if (pairBuffer.children.length === 2) pairBuffer = null;
    }
  });

  // Juftsiz qolgan karta yarim kenglikda osilib qolmasin
  $$("#charts .grid-2").forEach((row) => {
    row.classList.toggle("is-single", row.children.length === 1);
  });

  $$("#charts .chart-card").forEach((c) => c.__paint());
}

function repaintCharts() {
  $$("#charts .chart-card").forEach((c) => c.__paint());
}

// ---------- Ko'rinishlar uchun grafik to'plamlari ----------

function youthChartSpecs(rows, opts = {}) {
  const specs = [];

  if (opts.dualTrend) {
    const apps = state.filtered.filter((r) => r.source === "applications");
    const yth = state.filtered.filter((r) => r.source === "youth");
    const { points, unit } = trendBuckets(apps, yth);
    const series = [
      { key: "value", label: "Arizalar", color: cssVar(SOURCES.applications.varName) },
      { key: "value2", label: "Yoshlar", color: cssVar(SOURCES.youth.varName) }
    ];
    specs.push({
      id: "trend", wide: true,
      title: "Ro'yxatga olish dinamikasi",
      sub: `Har bir ${unit} uchun yozuvlar soni · ikkala sahifa alohida`,
      chart: (h) => drawTrend(h, { points, unit, series }),
      table: (h) => h.replaceChildren(buildTable(
        [unit === "hafta" ? "Hafta boshi" : "Sana", "Arizalar", "Yoshlar"],
        points.slice().reverse().map((p) => [fullDate(p.date), fmt(p.value), fmt(p.value2 || 0)]),
        [false, true, true]))
    });
  } else {
    const { points, unit } = trendBuckets(rows);
    const series = [{ key: "value", label: "Yozuvlar", color: cssVar("--series-1") }];
    specs.push({
      id: "trend", wide: true,
      title: "Yozuvlar dinamikasi",
      sub: `Har bir ${unit} uchun · ${fmt(points.length)} ta ${unit}`,
      chart: (h) => drawTrend(h, { points, unit, series }),
      table: (h) => h.replaceChildren(buildTable(
        [unit === "hafta" ? "Hafta boshi" : "Sana", "Yozuvlar"],
        points.slice().reverse().map((p) => [fullDate(p.date), fmt(p.value)]), [false, true]))
    });
  }

  // Sertifikat turlari
  const certCounts = countBy(rows, (r) => r.certType);
  const certParts = CERT_TYPES
    .map((t) => ({ id: t.id, label: t.label, value: certCounts.get(t.id) || 0, color: certColor(t.id) }))
    .filter((p) => p.value > 0);
  const certOthers = [...certCounts.entries()].filter(([k]) => !CERT_TYPES.some((t) => t.id === k));
  if (certOthers.length) {
    certParts.push({ label: "Boshqa", value: certOthers.reduce((s, [, v]) => s + v, 0), color: cssVar("--series-de") });
  }
  specs.push({
    id: "cert",
    title: "Sertifikat turlari",
    sub: "Yozuvlarning turlar bo'yicha ulushi",
    chart: (h) => drawStack(h, certParts, rows.length),
    table: (h) => h.replaceChildren(buildTable(
      ["Sertifikat turi", "Yozuvlar", "Ulush"],
      [...certCounts.entries()].sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [{ text: k, swatch: certColor(k) }, fmt(v), pct(v, rows.length)]),
      [false, true, true]))
  });

  // Xorijiy tillar
  const langItems = topN(countBy(rows, (r) => r.language), 7);
  specs.push({
    id: "lang",
    title: "Xorijiy tillar",
    sub: "Yozuvlar soni bo'yicha",
    chart: (h) => drawHBars(h, langItems, { title: "Xorijiy tillar" }),
    table: (h) => h.replaceChildren(buildTable(["Xorijiy til", "Yozuvlar", "Ulush"],
      langItems.map((d) => [d.label, fmt(d.value), pct(d.value, rows.length)]), [false, true, true]))
  });

  // Sinflar
  const gradeItems = [...countBy(rows, (r) => r.grade).entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([label, value]) => ({ label: label + "-sinf", value }));
  specs.push({
    id: "grade",
    title: "Sinflar kesimida",
    sub: "Har bir sinfdagi yozuvlar soni",
    chart: (h) => drawColumns(h, gradeItems, { title: "Sinflar" }),
    table: (h) => h.replaceChildren(buildTable(["Sinf", "Yozuvlar", "Ulush"],
      gradeItems.map((d) => [d.label, fmt(d.value), pct(d.value, rows.length)]), [false, true, true]))
  });

  // Maktablar
  const schoolItems = [...countBy(rows, (r) => r.school).entries()]
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .slice(0, 10)
    .map(([label, value]) => ({ label: schoolLabel(label), value }));
  specs.push({
    id: "school",
    title: "Eng faol maktablar",
    sub: "Birinchi 10 ta",
    chart: (h) => drawHBars(h, schoolItems, { title: "Maktablar" }),
    table: (h) => h.replaceChildren(buildTable(["Maktab", "Yozuvlar", "Ulush"],
      schoolItems.map((d) => [d.label, fmt(d.value), pct(d.value, rows.length)]), [false, true, true]))
  });

  // O'quv markazlari kesimi (faqat Yoshlar)
  if (opts.withCenters) {
    const centerItems = topN(countBy(rows, (r) => r.center), 8);
    specs.push({
      id: "bycenter",
      title: "O'quv markazlari kesimida",
      sub: "Yoshlar qaysi markazga a'zo",
      chart: (h) => drawHBars(h, centerItems, { title: "Markazlar" }),
      table: (h) => h.replaceChildren(buildTable(["Markaz", "Yoshlar", "Ulush"],
        centerItems.map((d) => [d.label, fmt(d.value), pct(d.value, rows.length)]), [false, true, true]))
    });
  }

  // Natijalar - shkalalar har xil, shuning uchun kichik multipl
  specs.push({
    id: "result", wide: true, multiples: true,
    title: "Natijalar taqsimoti",
    sub: "Shkalalar har xil bo'lgani uchun har bir sertifikat turi alohida",
    chart: (host) => {
      host.replaceChildren();
      CERT_TYPES.forEach((t) => {
        const subset = rows.filter((r) => r.certType === t.id);
        const wrap = elem("div");
        const title = elem("p", { class: "mini-title" });
        const dot = elem("span", { class: "pill-dot" });
        dot.style.background = certColor(t.id);
        title.append(dot, document.createTextNode(t.label));
        wrap.appendChild(title);
        wrap.appendChild(elem("p", { class: "mini-sub" }, `${fmt(subset.length)} ta yozuv`));
        const plot = elem("div", { class: "viz" });
        wrap.appendChild(plot);
        host.appendChild(wrap);
        if (!subset.length) {
          plot.replaceChildren(elem("p", { class: "mini-empty" }, "Yozuv yo'q."));
          return;
        }
        drawColumns(plot, resultItems(subset, t.id), {
          color: certColor(t.id), height: 190, title: `${t.label} natijalari`, labelPrefix: t.label + " "
        });
      });
    },
    table: (host) => {
      const body = [];
      CERT_TYPES.forEach((t) => {
        const subset = rows.filter((r) => r.certType === t.id);
        resultItems(subset, t.id).forEach((d) => {
          body.push([{ text: t.label, swatch: certColor(t.id) }, d.label, fmt(d.value), pct(d.value, subset.length)]);
        });
      });
      host.replaceChildren(body.length
        ? buildTable(["Sertifikat", "Natija", "Yozuvlar", "Tur ichidagi ulush"], body, [false, false, true, true])
        : elem("p", { class: "mini-empty" }, "Ma'lumot yo'q."));
    }
  });

  return specs;
}

function resultItems(subset, certId) {
  const counts = countBy(subset, (r) => r.result);
  if (certId === "SAT") {
    const bins = new Map();
    subset.forEach((r) => {
      const v = parseFloat(r.result);
      if (isNaN(v)) return;
      const lo = Math.floor(v / 50) * 50;
      bins.set(lo, (bins.get(lo) || 0) + 1);
    });
    return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([lo, value]) => ({ label: `${lo}+`, value }));
  }
  const order = RESULT_ORDER[certId] || [];
  const known = order.filter((k) => counts.has(k)).map((k) => ({ label: k, value: counts.get(k) }));
  const extra = [...counts.entries()].filter(([k]) => !order.includes(k))
    .sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  return known.concat(extra);
}

function centerChartSpecs(rows) {
  const specs = [];

  const { points, unit } = trendBuckets(rows);
  const columnItems = points.map((p) => ({ label: shortDate(p.date), value: p.value }));
  specs.push({
    id: "ctrend", wide: true,
    title: "Markazlar qo'shilishi",
    sub: `Har bir ${unit} uchun ro'yxatga olingan markazlar`,
    // Qiymatlar kichik butun sonlar - chiziq arra bo'lib ketadi, ustun aniqroq
    chart: (h) => drawColumns(h, columnItems, { title: "Markazlar qo'shilishi", height: 210 }),
    table: (h) => h.replaceChildren(buildTable(
      [unit === "hafta" ? "Hafta boshi" : "Sana", "Markazlar"],
      points.slice().reverse().map((p) => [fullDate(p.date), fmt(p.value)]), [false, true]))
  });

  const subjects = subjectTotals(rows);
  const subjItems = topN(subjects, 10);
  const subjTotal = [...subjects.values()].reduce((s, v) => s + v, 0);
  specs.push({
    id: "subjects", wide: true,
    title: "Fanlar bo'yicha o'quvchilar",
    sub: "Barcha markazlardagi to'garaklar yig'indisi",
    chart: (h) => drawHBars(h, subjItems, { title: "Fanlar", unit: "o'quvchi" }),
    table: (h) => h.replaceChildren(buildTable(["Fan", "O'quvchilar", "Ulush"],
      subjItems.map((d) => [d.label, fmt(d.value), pct(d.value, subjTotal)]), [false, true, true]))
  });

  const byStudents = rows.slice().sort((a, b) => b.students - a.students).slice(0, 10)
    .map((c) => ({ label: c.name, value: c.students }));
  const studentsTotal = rows.reduce((s, c) => s + c.students, 0);
  specs.push({
    id: "cstudents",
    title: "Markazlar bo'yicha o'quvchilar",
    sub: "Birinchi 10 ta",
    chart: (h) => drawHBars(h, byStudents, { title: "Markazlar", unit: "o'quvchi" }),
    table: (h) => h.replaceChildren(buildTable(["Markaz", "O'quvchilar", "Ulush"],
      byStudents.map((d) => [d.label, fmt(d.value), pct(d.value, studentsTotal)]), [false, true, true]))
  });

  const byStaff = rows.slice().sort((a, b) => b.staff - a.staff).slice(0, 10)
    .map((c) => ({ label: c.name, value: c.staff }));
  const staffTotal = rows.reduce((s, c) => s + c.staff, 0);
  specs.push({
    id: "cstaff",
    title: "Markazlar bo'yicha xodimlar",
    sub: "Birinchi 10 ta",
    chart: (h) => drawHBars(h, byStaff, { title: "Xodimlar", unit: "xodim" }),
    table: (h) => h.replaceChildren(buildTable(["Markaz", "Xodimlar", "Ulush"],
      byStaff.map((d) => [d.label, fmt(d.value), pct(d.value, staffTotal)]), [false, true, true]))
  });

  return specs;
}

// ============================================================
//  HERO + KPI
// ============================================================

function statCard({ label, value, note, color }) {
  const card = elem("div", { class: "stat-card" });
  const top = elem("div", { class: "stat-top" });
  if (color) {
    const dot = elem("span", { class: "stat-dot" });
    dot.style.background = color;
    top.appendChild(dot);
  }
  top.appendChild(elem("p", { class: "stat-label" }, label));
  card.appendChild(top);
  card.appendChild(elem("p", { class: "stat-value" }, fmt(value)));
  if (note) card.appendChild(elem("p", { class: "stat-note" }, note));
  return card;
}

function renderHero(rows) {
  const v = view();
  $("#hero-label").textContent = v.heroLabel;
  $("#hero-value").textContent = fmt(rows.length);

  const dated = rows.filter((r) => r.ts).map((r) => r.ts).sort((a, b) => a - b);
  $("#hero-note").textContent = dated.length ? `${fullDate(dated[0])} - ${fullDate(dated[dated.length - 1])}` : "";

  // So'nggi 7 kun - o'sish belgisi
  const weekAgo = new Date(); weekAgo.setHours(0, 0, 0, 0); weekAgo.setDate(weekAgo.getDate() - 6);
  const week = rows.filter((r) => r.ts && r.ts >= weekAgo).length;
  const chip = $("#hero-chip");
  if (week > 0) {
    chip.replaceChildren();
    const icon = document.createElementNS(SVG_NS, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.appendChild(svg("path", { d: "M5 15l7-7 7 7" }));
    chip.append(icon, document.createTextNode(`+${fmt(week)} · 7 kun`));
    chip.className = "chip-stat is-good";
    chip.hidden = false;
  } else {
    chip.hidden = true;
  }

  const { points } = trendBuckets(rows);
  drawSpark($("#hero-spark"), points);
  $(".hero-card").classList.toggle("no-spark", !sparkIsUseful(points));
}

function renderKPIs(rows) {
  const grid = $("#kpi-grid");
  grid.replaceChildren();
  const cards = [];

  if (state.view === "overview") {
    const apps = rows.filter((r) => r.source === "applications").length;
    const yth = rows.filter((r) => r.source === "youth").length;
    const centers = state.data.centers;
    const students = centers.reduce((s, c) => s + c.students, 0);
    cards.push(
      { label: "Arizalar", value: apps, note: '"Arizalar" sahifasi', color: cssVar("--series-1") },
      { label: "Yoshlar", value: yth, note: '"Yoshlar" sahifasi', color: cssVar("--series-2") },
      { label: "O'quv markazlari", value: centers.length, note: '"Markazlar" sahifasi', color: cssVar("--series-3") },
      { label: "To'garak o'quvchilari", value: students, note: `${fmt(centers.reduce((s, c) => s + c.clubCount, 0))} ta to'garak` }
    );
  } else if (isCenters()) {
    const staff = rows.reduce((s, c) => s + c.staff, 0);
    const clubs = rows.reduce((s, c) => s + c.clubCount, 0);
    const students = rows.reduce((s, c) => s + c.students, 0);
    cards.push(
      { label: "Jami xodimlar", value: staff, note: rows.length ? `O'rtacha ${(staff / rows.length).toFixed(1)} ta markazga` : "" },
      { label: "Jami to'garaklar", value: clubs, note: `${fmt(subjectTotals(rows).size)} xil fan` },
      { label: "Jami o'quvchilar", value: students, note: rows.length ? `O'rtacha ${Math.round(students / rows.length)} ta markazga` : "" },
      { label: "O'rtacha to'garak hajmi", value: clubs ? Math.round(students / clubs) : 0, note: "Bitta to'garakdagi o'quvchi" }
    );
  } else {
    const schools = new Set(rows.map((r) => r.school).filter(Boolean));
    const weekAgo = new Date(); weekAgo.setHours(0, 0, 0, 0); weekAgo.setDate(weekAgo.getDate() - 6);
    const week = rows.filter((r) => r.ts && r.ts >= weekAgo).length;
    const high = rows.filter(isHighLevel).length;

    cards.push(
      { label: "Qamrab olingan maktablar", value: schools.size, note: rows.length ? `O'rtacha ${(rows.length / Math.max(1, schools.size)).toFixed(1)} ta` : "" },
      { label: "So'nggi 7 kun", value: week, note: rows.length ? `Jami yozuvlarning ${pct(week, rows.length)} i` : "" },
      { label: "Yuqori daraja", value: high, note: "C1 / C2 · IELTS 7.0+ · SAT 1500+" }
    );

    if (state.view === "youth") {
      const social = rows.filter((r) => r.social === "Ha").length;
      cards.push({ label: "Ijtimoiy reyestrda", value: social, note: rows.length ? `Jami yozuvlarning ${pct(social, rows.length)} i` : "" });
    } else {
      const langs = new Set(rows.map((r) => r.language).filter(Boolean));
      cards.push({ label: "Xorijiy tillar", value: langs.size, note: "Turli til yo'nalishlari" });
    }
  }

  cards.forEach((c) => grid.appendChild(statCard(c)));
}

// ============================================================
//  JADVAL
// ============================================================

function maskPhone(phone) {
  if (!state.maskPhones) return phone;
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return phone;
  const tail = d.slice(-2);
  const op = d.length >= 12 ? d.slice(3, 5) : d.slice(0, 2);
  return `+998 ${op} *** ** ${tail}`;
}

function sourcePill(source) {
  const s = SOURCES[source];
  const pill = elem("span", { class: "pill" });
  const dot = elem("span", { class: "pill-dot" });
  dot.style.background = cssVar(s ? s.varName : "--series-de");
  pill.append(dot, document.createTextNode(s ? s.label : source));
  return pill;
}

function certPill(type) {
  const pill = elem("span", { class: "pill" });
  const dot = elem("span", { class: "pill-dot" });
  dot.style.background = certColor(type);
  pill.append(dot, document.createTextNode(type || "—"));
  return pill;
}

function logoCell(center) {
  const wrap = elem("span", { class: "logo-cell" });
  const chip = elem("span", { class: "logo-chip" });
  chip.textContent = center.name.slice(0, 1).toUpperCase();
  wrap.append(chip, document.createTextNode(center.name));
  return wrap;
}

function tableColumns() {
  if (isCenters()) {
    return [
      { key: "name", label: "Markaz", sortable: true, cls: "cell-name", cell: logoCell, csv: (r) => r.name },
      { key: "phone", label: "Telefon", cls: "cell-phone", cell: (r) => maskPhone(r.phone), csv: (r) => maskPhone(r.phone) },
      { key: "staff", label: "Xodimlar", sortable: true, cls: "cell-num", cell: (r) => fmt(r.staff), csv: (r) => r.staff },
      { key: "clubCount", label: "To'garaklar", sortable: true, cls: "cell-num", cell: (r) => fmt(r.clubCount), csv: (r) => r.clubCount },
      { key: "students", label: "O'quvchilar", sortable: true, cls: "cell-num", cell: (r) => fmt(r.students), csv: (r) => r.students },
      { key: "ts", label: "Qo'shilgan", sortable: true, cls: "cell-num", cell: (r) => (r.ts ? fullDate(r.ts) : "—"), csv: (r) => (r.ts ? fullDate(r.ts) : "") },
      { key: "clubsText", label: "To'garaklar ro'yxati", cls: "cell-name", cell: (r) => r.clubs.map((c) => `${c.name} (${c.count})`).join(", ") || "—", csv: (r) => r.clubs.map((c) => `${c.name} (${c.count})`).join("; ") }
    ];
  }

  const cols = [];
  if (state.view === "overview") {
    cols.push({ key: "source", label: "Manba", sortable: true, cell: (r) => sourcePill(r.source), csv: (r) => (SOURCES[r.source] || {}).label || r.source });
  }
  cols.push(
    { key: "ts", label: "Sana", sortable: true, cls: "cell-num", cell: (r) => (r.ts ? fullDate(r.ts) : "—"), csv: (r) => (r.ts ? fullDate(r.ts) : "") },
    { key: "school", label: "Maktab", sortable: true, cls: "cell-num", cell: (r) => schoolLabel(r.school), csv: (r) => r.school },
    { key: "grade", label: "Sinf", sortable: true, cls: "cell-num", cell: (r) => (r.grade ? r.grade + "-sinf" : "—"), csv: (r) => r.grade },
    { key: "fish", label: "Ismi-sharifi", sortable: true, cls: "cell-name", cell: (r) => r.fish, csv: (r) => r.fish },
    { key: "language", label: "Til", sortable: true, cell: (r) => r.language, csv: (r) => r.language },
    { key: "certType", label: "Sertifikat", sortable: true, cell: (r) => certPill(r.certType), csv: (r) => r.certType },
    { key: "result", label: "Natija", sortable: true, cls: "cell-num", cell: (r) => r.result || "—", csv: (r) => r.result },
    { key: "certDate", label: "Berilgan", sortable: true, cls: "cell-num", cell: (r) => (r.certDate ? fullDate(r.certDate) : "—"), csv: (r) => (r.certDate ? fullDate(r.certDate) : "") }
  );
  if (state.view === "youth") {
    cols.push(
      { key: "social", label: "Reyestr", sortable: true, cell: (r) => {
        const pill = elem("span", { class: "pill" + (r.social === "Ha" ? " pill-yes" : "") });
        pill.textContent = r.social || "—";
        return pill;
      }, csv: (r) => r.social },
      { key: "center", label: "Markaz", sortable: true, cell: (r) => r.center || "—", csv: (r) => r.center }
    );
  }
  cols.push({ key: "phone", label: "Telefon", cls: "cell-phone", cell: (r) => maskPhone(r.phone), csv: (r) => maskPhone(r.phone) });
  return cols;
}

function sortedRows() {
  const { key, dir } = state.sort;
  const mul = dir === "asc" ? 1 : -1;
  const numeric = ["school", "grade", "staff", "clubCount", "students"];
  return state.filtered.slice().sort((a, b) => {
    let x = a[key], y = b[key];
    if (numeric.includes(key)) { x = Number(x) || 0; y = Number(y) || 0; }
    else if (key === "result") { x = parseFloat(x) || x; y = parseFloat(y) || y; }
    if (x instanceof Date || y instanceof Date) { x = x ? x.getTime() : 0; y = y ? y.getTime() : 0; }
    if (typeof x === "string" && typeof y === "string") return x.localeCompare(y, "uz") * mul;
    return (x > y ? 1 : x < y ? -1 : 0) * mul;
  });
}

function renderTable() {
  const cols = tableColumns();
  const v = view();
  $("#table-title").textContent = v.tableTitle;

  // sarlavhalar
  const head = $("#table-head");
  head.replaceChildren();
  const hr = elem("tr");
  cols.forEach((col) => {
    const th = elem("th");
    if (col.sortable) {
      const btn = elem("button", { class: "th-sort" }, col.label);
      btn.dataset.sort = col.key;
      if (state.sort.key === col.key) btn.dataset.dir = state.sort.dir;
      btn.appendChild(elem("span", { class: "sort-caret" }));
      btn.addEventListener("click", () => {
        if (state.sort.key === col.key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else state.sort = { key: col.key, dir: col.key === "ts" || col.key === "certDate" ? "desc" : "asc" };
        state.page = 0;
        renderTable();
      });
      th.appendChild(btn);
    } else {
      th.appendChild(elem("span", { class: "th-plain" }, col.label));
    }
    hr.appendChild(th);
  });
  head.appendChild(hr);

  const rows = sortedRows();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const slice = rows.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);

  const body = $("#table-body");
  body.replaceChildren();
  slice.forEach((r) => {
    const tr = elem("tr");
    cols.forEach((col) => {
      const td = elem("td", { class: col.cls || null });
      const content = col.cell(r);
      if (content instanceof Node) td.appendChild(content);
      else td.textContent = content;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  const from = rows.length ? state.page * PAGE_SIZE + 1 : 0;
  const to = Math.min(rows.length, (state.page + 1) * PAGE_SIZE);
  const unit = isCenters() ? "markaz" : "yozuv";
  $("#page-info").textContent = `${fmt(from)}-${fmt(to)} / ${fmt(rows.length)} ta ${unit}`;
  $("#table-sub").textContent = `${v.tableSub} · ${fmt(rows.length)} ta ${unit}`;
  $("#page-prev").disabled = state.page === 0;
  $("#page-next").disabled = state.page >= pages - 1;
}

function exportCsv() {
  const cols = tableColumns();
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.map((c) => esc(c.label)).join(";")];
  sortedRows().forEach((r) => lines.push(cols.map((c) => esc(c.csv(r))).join(";")));

  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const a = elem("a", { href: URL.createObjectURL(blob), download: `${state.view}-${dayKey(new Date())}.csv` });
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

// ============================================================
//  RENDER
// ============================================================

function setState(name) {
  ["loading", "error", "empty", "nomatch"].forEach((s) => {
    const node = $("#state-" + s);
    if (node) node.hidden = s !== name;
  });
  if (name) $("#content").hidden = true;
}

function syncFilterVisibility() {
  $$(".filterbar .field[data-for]").forEach((el) => {
    el.hidden = !el.dataset.for.split(" ").includes(state.view);
  });
  $("#mask-wrap").hidden = false;
  $("#f-search").placeholder = isCenters() ? "Markaz, telefon yoki fan" : "Ism yoki telefon";
}

function fillFilterOptions() {
  const youthRows = state.data.applications.concat(state.data.youth);
  const fill = (sel, values, labelFn = (v) => v) => {
    const node = $(sel);
    const prev = node.value;
    node.replaceChildren(elem("option", { value: "" }, "Hammasi"));
    values.forEach((v) => node.appendChild(elem("option", { value: v }, labelFn(v))));
    node.value = values.includes(prev) ? prev : "";
  };
  const uniq = (rows, fn, sort) => [...new Set(rows.map(fn).filter(Boolean))].sort(sort);

  fill("#f-cert", uniq(youthRows, (r) => r.certType, (a, b) => a.localeCompare(b)));
  fill("#f-lang", uniq(youthRows, (r) => r.language, (a, b) => a.localeCompare(b, "uz")));
  fill("#f-grade", uniq(youthRows, (r) => r.grade, (a, b) => a - b), (v) => v + "-sinf");
  fill("#f-school", uniq(youthRows, (r) => r.school, (a, b) => {
    const na = Number(a), nb = Number(b);
    if (isNaN(na) || isNaN(nb)) return String(a).localeCompare(String(b), "uz");
    return na - nb;
  }), schoolLabel);
  fill("#f-center", uniq(state.data.youth, (r) => r.center, (a, b) => a.localeCompare(b, "uz")));
}

function renderAll({ animate = false } = {}) {
  state.rows = view().rows();
  applyFilters();

  const hasRows = state.rows.length > 0;
  const hasMatch = state.filtered.length > 0;

  $("#state-empty").hidden = hasRows;
  $("#stale-banner").hidden = !state.stale;
  $("#state-nomatch").hidden = !hasRows || hasMatch;
  $("#content").hidden = !hasMatch;
  if (!hasMatch) return;

  renderHero(state.filtered);
  renderKPIs(state.filtered);
  renderCharts(isCenters()
    ? centerChartSpecs(state.filtered)
    : youthChartSpecs(state.filtered, {
        dualTrend: state.view === "overview",
        withCenters: state.view === "youth"
      }));
  renderTable();

  if (animate) {
    const c = $("#content");
    c.classList.remove("is-entering");
    void c.offsetWidth;
    c.classList.add("is-entering");
  }
}

function updateCounts() {
  $$(".view-count").forEach((el) => {
    el.textContent = fmt((state.data[el.dataset.count] || []).length);
  });
}

function switchView(name) {
  if (!VIEWS[name]) return;
  state.view = name;
  state.filters = emptyFilters();
  state.sort = isCenters() ? { key: "students", dir: "desc" } : { key: "ts", dir: "desc" };
  state.page = 0;

  $$(".view-btn").forEach((b) => {
    const on = b.dataset.view === name;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", String(on));
  });
  $$(".chip[data-range]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === "all")));
  ["#f-cert", "#f-lang", "#f-grade", "#f-school", "#f-center", "#f-social", "#f-search"].forEach((s) => { $(s).value = ""; });

  syncFilterVisibility();
  try { localStorage.setItem(VIEW_STORAGE, name); } catch (_) {}
  renderAll({ animate: true });
}

// ============================================================
//  YUKLASH OQIMI
// ============================================================

async function refresh({ silent = false } = {}) {
  if (state.demo) return;
  const loaded = state.data.applications.length || state.data.youth.length || state.data.centers.length;
  if (silent) $("#content").classList.add("is-stale");
  else if (!loaded) setState("loading");

  $("#refresh").disabled = true;
  try {
    const data = await loadData();
    if (!data || data.ok === false) {
      throw new Error(data && data.error === "unauthorized" ? "Kirish kaliti noto'g'ri" : (data && data.error) || "Noma'lum xato");
    }
    ingest(data);
    setState(null);
    updateCounts();
    fillFilterOptions();
    renderAll();
    updateSync();
  } catch (err) {
    console.error(err);
    if (!loaded) {
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
  ingest(demoPayload());
  $("#demo-badge").hidden = false;
  $("#sync").textContent = "";
  $("#gate").hidden = true;
  $("#app").hidden = false;
  setState(null);
  updateCounts();
  fillFilterOptions();
  syncFilterVisibility();
  renderAll({ animate: true });
}

// ============================================================
//  HODISALAR
// ============================================================

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_STORAGE, theme); } catch (_) {}
  if (!$("#content").hidden) {
    renderHero(state.filtered);
    repaintCharts();
    renderTable();
  }
}

function currentTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function bindEvents() {
  $$(".view-btn").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));

  $$(".chip[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filters.range = btn.dataset.range;
      $$(".chip[data-range]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      renderAll();
    });
  });

  const bind = (sel, key) => $(sel).addEventListener("change", (e) => {
    state.filters[key] = e.target.value;
    renderAll();
  });
  bind("#f-cert", "cert");
  bind("#f-lang", "lang");
  bind("#f-grade", "grade");
  bind("#f-school", "school");
  bind("#f-center", "center");
  bind("#f-social", "social");

  let searchTimer;
  $("#f-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const v = e.target.value;
    searchTimer = setTimeout(() => { state.filters.search = v; renderAll(); }, 180);
  });

  $("#f-reset").addEventListener("click", () => {
    state.filters = emptyFilters();
    $$(".chip[data-range]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === "all")));
    ["#f-cert", "#f-lang", "#f-grade", "#f-school", "#f-center", "#f-social", "#f-search"].forEach((s) => { $(s).value = ""; });
    renderAll();
  });

  $("#page-prev").addEventListener("click", () => { state.page--; renderTable(); });
  $("#page-next").addEventListener("click", () => { state.page++; renderTable(); });
  $("#mask-phones").addEventListener("change", (e) => { state.maskPhones = e.target.checked; renderTable(); });
  $("#export-csv").addEventListener("click", exportCsv);

  $("#refresh").addEventListener("click", () => refresh({ silent: true }));
  $("#theme").addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));
  $("#error-retry").addEventListener("click", () => refresh());
  $("#error-demo").addEventListener("click", startDemo);

  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if ($("#content").hidden) return;
      renderHero(state.filtered);
      repaintCharts();
    }, 150);
  });

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    let stored = null;
    try { stored = localStorage.getItem(THEME_STORAGE); } catch (_) {}
    if (!stored && !$("#content").hidden) { renderHero(state.filtered); repaintCharts(); }
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
      ingest(data);
      $("#gate").hidden = true;
      $("#app").hidden = false;
      setState(null);
      updateCounts();
      fillFilterOptions();
      syncFilterVisibility();
      renderAll({ animate: true });
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

  try {
    const savedView = localStorage.getItem(VIEW_STORAGE);
    if (savedView && VIEWS[savedView]) state.view = savedView;
  } catch (_) {}

  $$(".view-btn").forEach((b) => {
    const on = b.dataset.view === state.view;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", String(on));
  });

  bindEvents();
  bindGate();
  syncFilterVisibility();

  let savedKey = "";
  try { savedKey = localStorage.getItem(KEY_STORAGE) || ""; } catch (_) {}

  if (savedKey) {
    state.key = savedKey;
    $("#app").hidden = false;
    refresh();
  } else {
    $("#gate").hidden = false;
  }

  setInterval(() => {
    if (!document.hidden && !state.demo && state.rows.length) refresh({ silent: true });
  }, 120000);
})();
