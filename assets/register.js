// ============================================================
//  register.html - ikki forma: o'quv markaz va iqtidorli yosh
//  Bu sahifa mustaqil: index.html ga bog'liq emas.
//  Markaz → Sheets "Markazlar", yosh → Sheets "Yoshlar".
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOsfh4if4NsK4pYWgmHDYIGM9Z2vR8YeLI8QcQqata_zdJrAlTNuO1fObLt4WMpVZB/exec";

// ---------- Iqtidorli yosh formasining qoidalari ----------
const SCHOOL_MIN = 1;
const SCHOOL_MAX = 61;
const GRADE_MIN = 5;
const GRADE_MAX = 11;

// Sertifikat faqat 2026-yilda berilgan bo'lsa qabul qilinadi
const CERT_YEAR = 2026;
const CERT_DATE_MIN = CERT_YEAR + "-01-01";
const CERT_DATE_MAX = CERT_YEAR + "-12-31";

const RESULT_OPTIONS = {
  CEFR: ["B2", "C1", "C2"],
  IELTS: ["5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"]
};

const SAT_RANGE = { min: 1400, max: 1600, step: 10 };

const LANGUAGES = [
  "Ingliz tili", "Nemis tili", "Fransuz tili", "Koreys tili", "Yapon tili",
  "Xitoy tili", "Arab tili", "Turk tili", "Rus tili", "Boshqa"
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sana maydoni uchun yuqori chegara: bugundan ham, 2026-yildan ham oshmaydi */
function certDateMax() {
  const today = todayISO();
  return today < CERT_DATE_MAX ? today : CERT_DATE_MAX;
}

function isValidCertDate(value) {
  if (!value) return false;
  return value >= CERT_DATE_MIN && value <= CERT_DATE_MAX && value <= todayISO();
}

/** "+998 95 477 08 11" → "954770811" */
function phoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("998") ? digits.slice(3) : digits;
}

function formatPhone(value) {
  const digits = phoneDigits(value).slice(0, 9);
  let out = "+998";
  if (digits.length > 0) out += " " + digits.slice(0, 2);
  if (digits.length > 2) out += " " + digits.slice(2, 5);
  if (digits.length > 5) out += " " + digits.slice(5, 7);
  if (digits.length > 7) out += " " + digits.slice(7, 9);
  return out;
}

const LOGO_MAX_BYTES = 5 * 1024 * 1024;   // foydalanuvchi tanlaydigan fayl chegarasi
const LOGO_MAX_SIDE = 512;                // yuborishdan oldin shu o'lchamga kichraytiriladi

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const TAB_ACTIVE = ["bg-brand-blue", "text-white", "shadow-soft"];
const TAB_IDLE = ["text-brand-muted", "hover:text-brand-ink"];

// ============================================================
//  TOAST
// ============================================================

function showToast(message, ok = true) {
  const toast = $("#toast");
  const icon = $("#toast-icon");
  $("#toast-msg").textContent = message;
  toast.classList.remove("hidden");
  toast.classList.add("show");
  toast.firstElementChild.classList.toggle("bg-brand-ink", ok);
  toast.firstElementChild.classList.toggle("bg-red-600", !ok);
  icon.innerHTML = ok
    ? '<polyline points="20 6 9 17 4 12"/>'
    : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, 4500);
}

function setLoading(form, loading, label) {
  const btn = form.querySelector("[data-submit]");
  btn.disabled = loading;
  btn.querySelector(".btn-icon").classList.toggle("hidden", loading);
  btn.querySelector(".btn-spin").classList.toggle("hidden", !loading);
  btn.querySelector(".btn-label").textContent = loading ? "Yuborilmoqda…" : label;
}

/** Apps Script CORS preflight'ni qo'llamaydi - javob o'qilmaydi, lekin yozuv tushadi */
async function postData(payload) {
  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}

function jsonp(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const name = "__reg_cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const done = (fn) => {
      clearTimeout(timer);
      delete window[name];
      script.remove();
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("Javob kelmadi"))), timeout);
    window[name] = (data) => done(() => resolve(data));
    script.onerror = () => done(() => reject(new Error("Tarmoq xatosi")));
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + name;
    document.body.appendChild(script);
  });
}

// ============================================================
//  TABLAR
// ============================================================

const TABS = [
  { btn: "#tab-center", panel: "#panel-center", hash: "#markaz" },
  { btn: "#tab-youth", panel: "#panel-youth", hash: "#yosh" }
];

function selectTab(index, { focus = false, updateHash = true } = {}) {
  TABS.forEach((t, i) => {
    const btn = $(t.btn);
    const panel = $(t.panel);
    const active = i === index;

    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
    btn.classList.toggle("bg-brand-blue", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("shadow-soft", active);
    btn.classList.toggle("text-brand-muted", !active);
    btn.classList.toggle("hover:text-brand-ink", !active);

    panel.hidden = !active;
  });

  if (focus) $(TABS[index].btn).focus();
  if (updateHash && location.hash !== TABS[index].hash) {
    history.replaceState(null, "", TABS[index].hash);
  }
}

function bindTabs() {
  TABS.forEach((t, i) => {
    $(t.btn).addEventListener("click", () => selectTab(i));
  });

  const list = $("[role='tablist']");
  list.addEventListener("keydown", (e) => {
    const current = TABS.findIndex((t) => $(t.btn).getAttribute("aria-selected") === "true");
    let next = null;
    if (e.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next !== null) {
      e.preventDefault();
      selectTab(next, { focus: true });
    }
  });

  const fromHash = TABS.findIndex((t) => t.hash === location.hash);
  selectTab(fromHash >= 0 ? fromHash : 0, { updateHash: false });
}

// ============================================================
//  1-TAB: O'QUV MARKAZ
// ============================================================

let logoPayload = null;   // { name, mime, data }

function bindLogo() {
  const input = $("#c-logo");
  const preview = $("#logo-preview");
  const note = $("#logo-note");
  const clearBtn = $("#logo-clear");

  const reset = () => {
    logoPayload = null;
    input.value = "";
    clearBtn.hidden = true;
    note.textContent = "PNG, JPG yoki SVG · 5 MB gacha";
    preview.innerHTML = '<svg class="w-7 h-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  };

  $("#logo-pick").addEventListener("click", () => input.click());
  clearBtn.addEventListener("click", reset);

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return reset();

    if (!file.type.startsWith("image/")) {
      showToast("Faqat rasm fayli tanlang.", false);
      return reset();
    }
    if (file.size > LOGO_MAX_BYTES) {
      showToast("Rasm 5 MB dan katta bo'lmasin.", false);
      return reset();
    }

    try {
      const prepared = await prepareLogo(file);
      logoPayload = prepared;
      clearBtn.hidden = false;
      note.textContent = `${file.name} · ${Math.round(prepared.data.length * 0.75 / 1024)} KB`;
      preview.innerHTML = "";
      const img = document.createElement("img");
      img.src = `data:${prepared.mime};base64,${prepared.data}`;
      img.alt = "Logotip";
      img.className = "w-full h-full object-contain";
      preview.appendChild(img);
    } catch (err) {
      console.error(err);
      showToast("Rasmni o'qib bo'lmadi.", false);
      reset();
    }
  });
}

/** Rasmni 512px ga kichraytirib base64 ga o'giradi (SVG o'zgarmaydi) */
function prepareLogo(file) {
  if (file.type === "image/svg+xml") {
    return readAsBase64(file).then((data) => ({ name: file.name, mime: file.type, data }));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      resolve({ name: file.name, mime: "image/png", data: dataUrl.split(",")[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---------- To'garak qatorlari ----------

function clubRow() {
  const row = document.createElement("div");
  row.className = "club-row grid grid-cols-[1fr_auto_auto] gap-2.5 items-center";
  row.innerHTML = `
    <input type="text" data-club-name required maxlength="80" placeholder="To'garak nomi" aria-label="To'garak nomi"
      class="w-full min-w-0 px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition" />
    <input type="number" data-club-count required min="1" max="5000" step="1" inputmode="numeric" placeholder="Soni"
      aria-label="O'quvchi soni"
      class="w-20 sm:w-32 px-3 sm:px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition" />
    <button type="button" data-club-remove aria-label="To'garakni o'chirish"
      class="w-11 h-11 grid place-items-center rounded-xl border border-slate-200 text-brand-muted hover:border-brand-red hover:text-brand-red transition disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-brand-muted">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>`;
  return row;
}

function clubs() {
  return $$("#club-rows .club-row").map((row) => ({
    name: row.querySelector("[data-club-name]").value.trim(),
    count: Number(row.querySelector("[data-club-count]").value)
  }));
}

function syncClubs() {
  const rows = $$("#club-rows .club-row");
  rows.forEach((row) => {
    row.querySelector("[data-club-remove]").disabled = rows.length === 1;
  });

  const list = clubs().filter((c) => c.name && c.count > 0);
  const total = list.reduce((sum, c) => sum + c.count, 0);
  $("#club-total").textContent = total
    ? `${list.length} ta to'garak · jami ${total} o'quvchi`
    : "";
}

function bindClubs() {
  const host = $("#club-rows");
  host.appendChild(clubRow());
  syncClubs();

  $("#club-add").addEventListener("click", () => {
    const row = clubRow();
    host.appendChild(row);
    syncClubs();
    row.querySelector("[data-club-name]").focus();
  });

  host.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-club-remove]");
    if (!btn || btn.disabled) return;
    btn.closest(".club-row").remove();
    syncClubs();
  });

  host.addEventListener("input", syncClubs);
}

function bindCenterForm() {
  const form = $("#center-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return form.reportValidity();

    const list = clubs();
    if (list.some((c) => !c.name || !(c.count > 0))) {
      showToast("Har bir to'garak uchun nom va o'quvchi sonini kiriting.", false);
      return;
    }

    const names = list.map((c) => c.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      showToast("To'garak nomlari takrorlanmasin.", false);
      return;
    }

    const payload = {
      type: "center",
      timestamp: new Date().toISOString(),
      name: $("#c-name").value.trim(),
      staff: Number($("#c-staff").value),
      clubs: list,
      logo: logoPayload
    };

    setLoading(form, true, "Markazni saqlash");
    try {
      await postData(payload);
      showToast("Rahmat! O'quv markaz ma'lumotlari qabul qilindi.", true);
      form.reset();
      $("#logo-clear").click();
      $("#club-rows").replaceChildren(clubRow());
      syncClubs();
      loadCenters();                       // yangi markaz 2-tab ro'yxatiga tushsin
    } catch (err) {
      console.error(err);
      showToast("Xatolik yuz berdi. Qaytadan urinib ko'ring.", false);
    } finally {
      setLoading(form, false, "Markazni saqlash");
    }
  });
}

// ============================================================
//  2-TAB: IQTIDORLI YOSH
// ============================================================

const youth = {};

function fillSelect(select, items, placeholder = "Tanlang...") {
  const prev = select.value;
  select.replaceChildren(new Option(placeholder, ""));
  items.forEach(({ value, label }) => select.appendChild(new Option(label, value)));
  if (prev && items.some((i) => i.value === prev)) select.value = prev;
}

function buildYouthOptions() {
  const schools = [];
  for (let n = SCHOOL_MIN; n <= SCHOOL_MAX; n++) {
    schools.push({ value: String(n), label: `${n}-maktab` });
  }
  fillSelect(youth.school, schools);

  const grades = [];
  for (let n = GRADE_MIN; n <= GRADE_MAX; n++) {
    grades.push({ value: String(n), label: `${n}-sinf` });
  }
  fillSelect(youth.grade, grades);

  fillSelect(youth.language, LANGUAGES.map((v) => ({ value: v, label: v })));

  youth.certDate.min = CERT_DATE_MIN;
  youth.certDate.max = certDateMax();

  youth.resultSat.min = SAT_RANGE.min;
  youth.resultSat.max = SAT_RANGE.max;
  youth.resultSat.step = SAT_RANGE.step;
}

/** Natija maydoni sertifikat turiga qarab o'zgaradi */
function renderResultField() {
  const type = youth.certType.value;
  const isSat = type === "SAT";

  youth.resultSat.classList.toggle("hidden", !isSat);
  youth.resultSat.disabled = !isSat;
  youth.resultSat.required = isSat;
  if (!isSat) youth.resultSat.value = "";

  youth.result.classList.toggle("hidden", isSat);
  youth.result.disabled = isSat || !type;
  youth.result.required = !isSat;

  const options = (RESULT_OPTIONS[type] || []).map((v) => ({ value: v, label: v }));
  fillSelect(youth.result, options, type ? "Tanlang..." : "Avval sertifikat turini tanlang");
}

/** Markazlar ro'yxati Sheets'dagi "Markazlar" sahifasidan keladi */
async function loadCenters() {
  const select = youth.center;
  const reload = $("#center-reload");

  select.disabled = true;
  reload.hidden = true;
  select.replaceChildren(new Option("Yuklanmoqda…", ""));

  try {
    const res = await jsonp(`${APPS_SCRIPT_URL}?action=centers`);
    if (!res || res.ok === false) throw new Error((res && res.error) || "error");

    const names = (res.centers || []).filter(Boolean);
    select.replaceChildren(new Option(names.length ? "Tanlang..." : "Ro'yxatda markaz yo'q", ""));
    names.forEach((n) => select.appendChild(new Option(n, n)));
    select.appendChild(new Option("Markazga a'zo emas", "Markazga a'zo emas"));
    select.disabled = false;
  } catch (err) {
    console.error(err);
    select.replaceChildren(new Option("Ro'yxatni yuklab bo'lmadi", ""));
    select.appendChild(new Option("Markazga a'zo emas", "Markazga a'zo emas"));
    select.disabled = false;
    reload.hidden = false;
  }
}

function bindYouthForm() {
  youth.school = $("#y-school");
  youth.grade = $("#y-grade");
  youth.fish = $("#y-fish");
  youth.language = $("#y-language");
  youth.certType = $("#y-cert-type");
  youth.certDate = $("#y-cert-date");
  youth.result = $("#y-result");
  youth.resultSat = $("#y-result-sat");
  youth.phone = $("#y-phone");
  youth.social = $("#y-social");
  youth.center = $("#y-center");

  buildYouthOptions();
  renderResultField();

  youth.certType.addEventListener("change", renderResultField);
  $("#center-reload").addEventListener("click", loadCenters);

  youth.phone.addEventListener("input", (e) => {
    e.target.value = formatPhone(e.target.value);
  });
  youth.phone.addEventListener("focus", (e) => {
    if (!e.target.value) e.target.value = "+998 ";
  });

  const form = $("#youth-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return form.reportValidity();

    if (phoneDigits(youth.phone.value).length !== 9) {
      showToast("Telefon raqamini to'liq kiriting (9 ta raqam).", false);
      youth.phone.focus();
      return;
    }

    if (!isValidCertDate(youth.certDate.value)) {
      showToast(`Sertifikat ${CERT_YEAR}-yilda berilgan bo'lishi kerak (bugungi kundan oshmasin).`, false);
      youth.certDate.focus();
      return;
    }

    const payload = {
      type: "youth",
      timestamp: new Date().toISOString(),
      school: youth.school.value,
      grade: youth.grade.value,
      fish: youth.fish.value.trim(),
      language: youth.language.value,
      certType: youth.certType.value,
      certDate: youth.certDate.value,
      result: youth.certType.value === "SAT" ? youth.resultSat.value.trim() : youth.result.value,
      phone: youth.phone.value.trim(),
      social: youth.social.value,
      center: youth.center.value,
      lang: "uz"
    };

    setLoading(form, true, "Yuborish");
    try {
      await postData(payload);
      showToast("Rahmat! Ma'lumotlaringiz qabul qilindi.", true);
      form.reset();
      buildYouthOptions();
      renderResultField();
    } catch (err) {
      console.error(err);
      showToast("Xatolik yuz berdi. Qaytadan urinib ko'ring.", false);
    } finally {
      setLoading(form, false, "Yuborish");
    }
  });

  loadCenters();
}

// ============================================================
//  START
// ============================================================

bindTabs();
bindLogo();
bindClubs();
bindCenterForm();
bindYouthForm();
