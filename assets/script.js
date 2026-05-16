// ============================================================
// SOZLAMA: Apps Script Web App URL-ini bu yerga qo'ying
// Deploy → New deployment → Web app → Anyone → URL
// ============================================================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec";

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
}

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
  const dict = i18n[window.__currentLang || DEFAULT_LANG];
  btnLabel.textContent = loading ? dict.form_sending : dict.form_submit;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const dict = i18n[window.__currentLang || DEFAULT_LANG];
  const data = {
    timestamp: new Date().toISOString(),
    fish: form.fish.value.trim(),
    phone: form.phone.value.trim(),
    school: form.school.value.trim(),
    exam: form.exam.value,
    score: form.score.value.trim(),
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
    showToast(dict.form_success, true);
    form.reset();
  } catch (err) {
    showToast(dict.form_error, false);
    console.error(err);
  } finally {
    setLoading(false);
  }
});
