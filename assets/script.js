// ============================================================
// SOZLAMA: Apps Script Web App URL-ini bu yerga qo'ying
// Deploy → New deployment → Web app → Anyone → URL
// ============================================================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOsfh4if4NsK4pYWgmHDYIGM9Z2vR8YeLI8QcQqata_zdJrAlTNuO1fObLt4WMpVZB/exec";

// ---------- i18n ----------
const SUPPORTED = ["uz", "ru", "en"];
const DEFAULT_LANG = "uz";

function getInitialLang() {
  const saved = localStorage.getItem("lang");
  if (saved && SUPPORTED.includes(saved)) return saved;
  const browser = (navigator.language || "uz").slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser) ? browser : DEFAULT_LANG;
}

function applyLang(lang) {
  const dict = i18n[lang];
  if (!dict) return;

  document.documentElement.lang = dict.html_lang || lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] != null) {
      if (el.tagName === "META") {
        el.setAttribute("content", dict[key]);
      } else if (el.tagName === "OPTION") {
        el.textContent = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    if (dict[key] != null) el.setAttribute("placeholder", dict[key]);
  });

  document.querySelectorAll(".lang-option").forEach((btn) => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle("text-brand-blue", active);
    btn.classList.toggle("bg-brand-soft", active);
  });

  const currentLabel = document.getElementById("lang-current");
  if (currentLabel) currentLabel.textContent = lang.toUpperCase();

  localStorage.setItem("lang", lang);
  window.__currentLang = lang;

  renderDynamicFields();
}

function t(key, vars) {
  const dict = i18n[window.__currentLang || DEFAULT_LANG] || i18n[DEFAULT_LANG];
  let out = dict[key] != null ? dict[key] : key;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      out = out.replace("{" + k + "}", vars[k]);
    });
  }
  return out;
}

// ---------- Forma: dinamik maydonlar ----------
const SCHOOL_MIN = 1;
const SCHOOL_MAX = 61;
const SPECIAL_SCHOOL = "Ixtisoslashtirilgan maktab";
const GRADE_MIN = 5;
const GRADE_MAX = 11;

// Sertifikat faqat 2026-yilda berilgan bo'lsa qabul qilinadi
const CERT_YEAR = 2026;
const CERT_DATE_MIN = CERT_YEAR + "-01-01";
const CERT_DATE_MAX = CERT_YEAR + "-12-31";

// Sertifikat turi → qabul qilinadigan natijalar
const RESULT_OPTIONS = {
  CEFR: ["B2", "C1", "C2"],
  IELTS: ["5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"]
};

const SAT_RANGE = { min: 1400, max: 1600, step: 10 };

const schoolSelect = document.getElementById("f-school");
const gradeSelect = document.getElementById("f-grade");
const fishInput = document.getElementById("f-fish");
const languageSelect = document.getElementById("f-language");
const certTypeSelect = document.getElementById("f-cert-type");
const certDateInput = document.getElementById("f-cert-date");
const resultSelect = document.getElementById("f-result");
const resultSatInput = document.getElementById("f-result-sat");

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

function fillSelect(select, items) {
  if (!select) return;
  const prev = select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("form_opt_select");
  select.appendChild(placeholder);

  items.forEach(({ value, label }) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  });

  if (prev) select.value = prev;
}

function renderSchoolOptions() {
  const items = [];
  for (let n = SCHOOL_MIN; n <= SCHOOL_MAX; n++) {
    items.push({ value: String(n), label: t("form_school_item", { n }) });
  }
  items.push({ value: SPECIAL_SCHOOL, label: t("form_school_special") });
  fillSelect(schoolSelect, items);
}

function renderGradeOptions() {
  const items = [];
  for (let n = GRADE_MIN; n <= GRADE_MAX; n++) {
    items.push({ value: String(n), label: t("form_grade_item", { n }) });
  }
  fillSelect(gradeSelect, items);
}

function renderResultField() {
  if (!certTypeSelect || !resultSelect || !resultSatInput) return;

  const type = certTypeSelect.value;
  const isSat = type === "SAT";

  // SAT → raqamli input, qolganlari → select
  resultSatInput.classList.toggle("hidden", !isSat);
  resultSatInput.disabled = !isSat;
  resultSatInput.required = isSat;
  if (!isSat) resultSatInput.value = "";

  resultSelect.classList.toggle("hidden", isSat);
  resultSelect.disabled = isSat || !type;
  resultSelect.required = !isSat;

  const prev = resultSelect.value;
  resultSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = type ? t("form_opt_select") : t("form_result_pick_type");
  resultSelect.appendChild(placeholder);

  (RESULT_OPTIONS[type] || []).forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    resultSelect.appendChild(opt);
  });

  if (prev && RESULT_OPTIONS[type] && RESULT_OPTIONS[type].includes(prev)) {
    resultSelect.value = prev;
  }
}

function renderDynamicFields() {
  renderSchoolOptions();
  renderGradeOptions();
  renderResultField();

  if (resultSatInput) {
    resultSatInput.min = SAT_RANGE.min;
    resultSatInput.max = SAT_RANGE.max;
    resultSatInput.step = SAT_RANGE.step;
  }

  if (certDateInput) {
    const today = todayISO();
    certDateInput.min = CERT_DATE_MIN;
    certDateInput.max = today < CERT_DATE_MAX ? today : CERT_DATE_MAX;
  }
}

if (certTypeSelect) {
  certTypeSelect.addEventListener("change", renderResultField);
}

renderDynamicFields();

// Dropdown open/close
const langToggle = document.getElementById("lang-toggle");
const langMenu = document.getElementById("lang-menu");
const langCaret = document.getElementById("lang-caret");

function closeLangMenu() {
  langMenu.classList.add("hidden");
  langCaret.style.transform = "rotate(0deg)";
}
function openLangMenu() {
  langMenu.classList.remove("hidden");
  langCaret.style.transform = "rotate(180deg)";
}

langToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  langMenu.classList.contains("hidden") ? openLangMenu() : closeLangMenu();
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("lang-dropdown").contains(e.target)) closeLangMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLangMenu();
});

document.querySelectorAll(".lang-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    applyLang(btn.dataset.lang);
    closeLangMenu();
  });
});

applyLang(getInitialLang());

// ---------- Scroll reveal ----------
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// ---------- Phone mask: +998 __ ___ __ __ ----------
const phoneInput = document.querySelector('input[name="phone"]');

function phoneDigits() {
  if (!phoneInput) return "";
  const digits = phoneInput.value.replace(/\D/g, "");
  return digits.startsWith("998") ? digits.slice(3) : digits;
}

if (phoneInput) {
  phoneInput.addEventListener("input", (e) => {
    let digits = e.target.value.replace(/\D/g, "");
    if (digits.startsWith("998")) digits = digits.slice(3);
    digits = digits.slice(0, 9);
    let out = "+998";
    if (digits.length > 0) out += " " + digits.slice(0, 2);
    if (digits.length > 2) out += " " + digits.slice(2, 5);
    if (digits.length > 5) out += " " + digits.slice(5, 7);
    if (digits.length > 7) out += " " + digits.slice(7, 9);
    e.target.value = out;
  });
  phoneInput.addEventListener("focus", (e) => {
    if (!e.target.value) e.target.value = "+998 ";
  });
}

// ---------- Toast ----------
function showToast(msg, ok = true) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toast-msg");
  const iconEl = document.getElementById("toast-icon");
  msgEl.textContent = msg;
  toast.classList.remove("hidden");
  toast.classList.add("show");
  toast.firstElementChild.classList.toggle("bg-brand-ink", ok);
  toast.firstElementChild.classList.toggle("bg-red-600", !ok);
  iconEl.innerHTML = ok
    ? '<polyline points="20 6 9 17 4 12"/>'
    : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, 4000);
}

// ---------- Form submit ----------
const form = document.getElementById("registration-form");
const submitBtn = document.getElementById("submit-btn");
const btnLabel = submitBtn.querySelector(".btn-label");
const btnIcon = submitBtn.querySelector(".btn-icon");
const btnSpin = submitBtn.querySelector(".btn-spin");

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnIcon.classList.toggle("hidden", loading);
  btnSpin.classList.toggle("hidden", !loading);
  btnLabel.textContent = loading ? t("form_sending") : t("form_submit");
}

function getResultValue() {
  return certTypeSelect.value === "SAT"
    ? resultSatInput.value.trim()
    : resultSelect.value;
}

/** Brauzer min/max ni qo'llab-quvvatlamasa ham sanani tekshiramiz:
 *  faqat 2026-yil va bugungi kundan oshmagan sana. */
function validateCertDate() {
  const v = certDateInput.value;
  if (!v) return false;
  return v >= CERT_DATE_MIN && v <= CERT_DATE_MAX && v <= todayISO();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (phoneDigits().length !== 9) {
    showToast(t("form_err_phone"), false);
    phoneInput.focus();
    return;
  }

  if (!validateCertDate()) {
    showToast(t("form_err_cert_date"), false);
    certDateInput.focus();
    return;
  }

  const data = {
    timestamp: new Date().toISOString(),
    school: schoolSelect.value,
    grade: gradeSelect.value,
    fish: fishInput.value.trim(),
    language: languageSelect.value,
    certType: certTypeSelect.value,
    certDate: certDateInput.value,
    result: getResultValue(),
    phone: phoneInput.value.trim(),
    lang: window.__currentLang || DEFAULT_LANG
  };

  setLoading(true);

  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data)
    });
    showToast(t("form_success"), true);
    form.reset();
    renderDynamicFields();
  } catch (err) {
    showToast(t("form_error"), false);
    console.error(err);
  } finally {
    setLoading(false);
  }
});
