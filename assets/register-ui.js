// ============================================================
//  register-ui.js — register.html uchun interaktiv qatlam
//  register.js dan KEYIN yuklanadi va unga tegmaydi:
//  faqat ikonka, bayroq, jarayon halqasi, jonli ko'rinish
//  va konfetti qo'shadi.
// ============================================================

(function () {
  "use strict";

  var doc = document;
  var one = function (sel, root) { return (root || doc).querySelector(sel); };
  var all = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ----------------------------------------------------------
  //  1. IKONKA KUTUBXONASI
  // ----------------------------------------------------------

  function svg(body, fill) {
    return '<svg viewBox="0 0 24 24" fill="' + (fill || "none") +
      '" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      body + "</svg>";
  }

  var ICON = {
    building: svg('<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M10 21v-5h4v5"/><path d="M9 10h.01M15 10h.01M9 13h.01M15 13h.01"/>'),
    school:   svg('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
    grade:    svg('<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
    user:     svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    globe:    svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
    award:    svg('<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    gauge:    svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    shield:   svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
    check:    svg('<polyline points="20 6 9 17 4 12"/>'),
    sparkle:  svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
    image:    svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
    phone:    svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9z"/>'),
    users:    svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),

    // --- fanlar ---
    math:     svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 8h3M9 6.5v3M13.5 7.5h3M13.5 11h3M7 14.5h3.5M13.5 14.5h3M13.5 17.5h3M8 13.2l2.5 3M10.5 13.2l-2.5 3"/>'),
    atom:     svg('<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.3"/><ellipse cx="12" cy="12" rx="10" ry="4.3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.3" transform="rotate(-60 12 12)"/>'),
    flask:    svg('<path d="M9 2h6M10 2v6.5L4.6 18A2 2 0 0 0 6.4 21h11.2a2 2 0 0 0 1.8-3L14 8.5V2"/><path d="M7.5 15h9"/>'),
    leaf:     svg('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>'),
    moon:     svg('<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9z"/><path d="M19 3.5l.5 1.5 1.5.5-1.5.5L19 7.5 18.5 6 17 5.5 18.5 5z"/>'),
    monitor:  svg('<rect x="2" y="3" width="20" height="14" rx="3"/><path d="M8 21h8M12 17v4"/>'),
    code:     svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    bot:      svg('<rect x="4" y="8" width="16" height="12" rx="4"/><path d="M12 8V4.5M9.5 4h5"/><circle cx="9.3" cy="14" r="1.2"/><circle cx="14.7" cy="14" r="1.2"/><path d="M2 13v3M22 13v3"/>'),
    palette:  svg('<path d="M12 2a10 10 0 1 0 0 20c.6 0 1-.5 1-1v-1a2 2 0 0 1 2-2h2a4 4 0 0 0 4-4 10 10 0 0 0-9-12z"/><circle cx="8.5" cy="8" r="1.2"/><circle cx="13" cy="6.5" r="1.2"/><circle cx="6.8" cy="12.5" r="1.2"/>'),
    book:     svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    clock:    svg('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>'),
    scale:    svg('<path d="M12 3v18M6 21h12"/><path d="M12 6 4 8.5M12 6l8 2.5"/><path d="M4 8.5 1.5 14.5h5zM20 8.5 17.5 14.5h5z"/>'),
    trend:    svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
    brain:    svg('<path d="M12 5.5A3 3 0 0 0 6.5 4a3 3 0 0 0-1.6 5.3A3 3 0 0 0 6 16.5a3 3 0 0 0 6 1.4z"/><path d="M12 5.5A3 3 0 0 1 17.5 4a3 3 0 0 1 1.6 5.3A3 3 0 0 1 18 16.5a3 3 0 0 1-6 1.4z"/>'),
    music:    svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    chess:    svg('<path d="M8.5 21h7M10 21l.5-4.5M14 21l-.5-4.5M7.5 16.5h9l-1-4h-7z"/><path d="M12 12.5v-3M9.5 9.5h5"/><path d="M10 9.5 8.5 5l3.5 2 3.5-2L14 9.5"/>'),
    trophy:   svg('<path d="M8.5 21h7M12 17.5V21M7 3.5h10v4.5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4.5A2.5 2.5 0 0 0 7 10M17 5.5h2.5A2.5 2.5 0 0 1 17 10"/>')
  };

  // bayroqlar — flagcdn.com
  var FLAG = {
    "Ingliz tili": "gb",
    "Rus tili": "ru",
    "Nemis tili": "de",
    "Fransuz tili": "fr",
    "Koreys tili": "kr",
    "Yapon tili": "jp",
    "Xitoy tili": "cn",
    "Arab tili": "sa",
    "Turk tili": "tr"
  };

  var SUBJECT = {
    "Matematika": "math",
    "Fizika": "atom",
    "Kimyo": "flask",
    "Biologiya": "leaf",
    "Geografiya": "globe",
    "Astronomiya": "moon",
    "Informatika": "monitor",
    "Dasturlash": "code",
    "Robototexnika": "bot",
    "Grafik dizayn": "palette",
    "Ona tili va adabiyot": "book",
    "Tarix": "clock",
    "Huquq": "scale",
    "Iqtisodiyot": "trend",
    "Psixologiya": "brain",
    "Musiqa": "music",
    "Tasviriy san'at": "palette",
    "Shaxmat": "chess",
    "Sport": "trophy"
  };

  // Yuklanmagan bayroqlar shu yerda eslab qolinadi — qayta urinilmaydi
  var flagFailed = {};

  function flagImg(code, alt) {
    return '<img src="https://flagcdn.com/w40/' + code + '.png" ' +
      'srcset="https://flagcdn.com/w80/' + code + '.png 2x" ' +
      'alt="' + (alt || "") + '" data-flag="1" loading="lazy" decoding="async" />';
  }

  /** { html, isFlag } — internet bo'lmasa globus ikonkasiga tushadi */
  function flagVisual(code, alt) {
    if (!code || flagFailed[code]) return { html: ICON.globe, isFlag: false };
    return { html: flagImg(code, alt), isFlag: true };
  }

  /** Bayroq yuklanmasa: kodni belgilab qo'yamiz va hamma joyni qayta chizamiz */
  doc.addEventListener("error", function (e) {
    var el = e.target;
    if (!el || el.tagName !== "IMG" || el.getAttribute("data-flag") !== "1") return;

    var m = /flagcdn\.com\/w\d+\/([a-z-]+)\.png/.exec(el.currentSrc || el.src || "");
    if (m) flagFailed[m[1]] = true;

    var host = el.parentNode;
    if (host && host.classList && /(^|\s)(f-ico|club-ico|ci|ic)(\s|$)/.test(host.className)) {
      host.setAttribute("data-html", ICON.globe);
      host.innerHTML = ICON.globe;
      host.classList.remove("is-flag");
    } else {
      el.remove();
    }

    if (m) syncAll();   // shu bayroq ishlatilgan boshqa joylar ham yangilansin
  }, true);

  /** Fan nomi uchun ikonka: bayroq yoki SVG. { html, isFlag } */
  function subjectVisual(name) {
    if (!name) return { html: ICON.sparkle, isFlag: false };
    if (FLAG[name]) return flagVisual(FLAG[name], name);
    var key = SUBJECT[name];
    if (key && ICON[key]) return { html: ICON[key], isFlag: false };
    return { html: ICON.sparkle, isFlag: false };
  }

  // ----------------------------------------------------------
  //  2. KICHIK YORDAMCHILAR
  // ----------------------------------------------------------

  function digitsOf(v) {
    var d = String(v || "").replace(/\D/g, "");
    return d.indexOf("998") === 0 ? d.slice(3) : d;
  }

  function val(sel) {
    var el = one(sel);
    return el ? String(el.value || "").trim() : "";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function dateUz(iso) {
    if (!iso || iso.length < 10) return "";
    var p = iso.split("-");
    return p[2] + "." + p[1] + "." + p[0];
  }

  function centerIsActive() {
    var p = one("#panel-center");
    return !!p && !p.hidden;
  }

  // ----------------------------------------------------------
  //  3. MAYDON IKONKALARI VA "TO'LDIRILDI" BELGISI
  // ----------------------------------------------------------

  function setIco(sel, html, isFlag) {
    var wrap = one(sel);
    if (!wrap) return;
    var ico = one(".f-ico", wrap.closest(".f-wrap") || wrap);
    if (!ico) return;
    if (ico.getAttribute("data-html") === html) return;
    ico.setAttribute("data-html", html);
    ico.innerHTML = html;
    ico.classList.toggle("is-flag", !!isFlag);
  }

  function miniBadge(text) {
    return '<span class="mini-badge">' + esc(text) + "</span>";
  }

  var CERT_LOGO = {
    IELTS: '<img src="assets/ielts-logog-2000x1200.png" alt="IELTS" />',
    CEFR:  '<span class="txt">CEFR</span>',
    SAT:   '<span class="txt">SAT</span>',
    TOPIK: '<span class="txt">TOPIK</span>'
  };

  /** Maydon ichidagi qisqa nishon: IELTS -> IEL, TOPIK -> TPK */
  var CERT_SHORT = { IELTS: "IEL", TOPIK: "TPK", CEFR: "CEFR", SAT: "SAT" };

  function syncDynamicIcons() {
    // xorijiy til → bayroq
    var lang = val("#y-language");
    var lv = FLAG[lang] ? flagVisual(FLAG[lang], lang) : { html: ICON.globe, isFlag: false };
    setIco("#y-language", lv.html, lv.isFlag);

    // maktab → raqamli nishon
    var school = val("#y-school");
    if (/^\d+$/.test(school)) setIco("#y-school", miniBadge(school), false);
    else if (school) setIco("#y-school", miniBadge("IX"), false);
    else setIco("#y-school", ICON.school, false);

    // sinf → raqamli nishon
    var grade = val("#y-grade");
    setIco("#y-grade", grade ? miniBadge(grade) : ICON.grade, false);

    // sertifikat turi → nishon
    var ct = val("#y-cert-type");
    var ctShort = ct === "Boshqa" ? (val("#y-cert-other").slice(0, 4) || "···") : (CERT_SHORT[ct] || ct);
    setIco("#y-cert-type", ct ? miniBadge(ctShort) : ICON.award, false);
  }

  /** Bitta o'ramda ikkita boshqaruv bo'lishi mumkin (natija: select / SAT raqami) */
  function syncWrap(wrap) {
    if (!wrap) return;
    var filled = all("input, select, textarea", wrap).some(function (el) {
      if (el.classList.contains("hidden") || el.disabled) return false;
      if (el.dataset && el.dataset.progType === "phone") return digitsOf(el.value).length === 9;
      return !!String(el.value || "").trim();
    });
    wrap.classList.toggle("is-filled", filled);
  }

  function syncFilled(el) {
    if (!el || !el.closest) return;
    syncWrap(el.closest(".f-wrap"));
  }

  function syncAllFilled() {
    all(".f-wrap").forEach(syncWrap);
  }

  // ----------------------------------------------------------
  //  4. TO'GARAK QATORLARI — ikonka va ko'rsatkich chizig'i
  // ----------------------------------------------------------

  function clubName(row) {
    var sel = one("[data-club-subject]", row);
    if (!sel) return "";
    if (sel.value === "Boshqa") {
      var c = one("[data-club-custom]", row);
      return c ? c.value.trim() : "";
    }
    return sel.value;
  }

  function clubCount(row) {
    var c = one("[data-club-count]", row);
    return c ? Number(c.value) || 0 : 0;
  }

  function syncClubUI() {
    var rows = all("#club-rows .club-row");
    var max = 1;
    rows.forEach(function (r) { max = Math.max(max, clubCount(r)); });

    rows.forEach(function (row) {
      var host = one(".club-subject", row);
      if (!host) return;

      var ico = one(".club-ico", host);
      if (!ico) {
        ico = doc.createElement("span");
        ico.className = "club-ico";
        host.insertBefore(ico, host.firstChild);
      }

      var name = clubName(row);
      var v = subjectVisual(name);
      if (ico.getAttribute("data-html") !== v.html) {
        ico.setAttribute("data-html", v.html);
        ico.innerHTML = v.html;
      }
      ico.classList.toggle("is-flag", v.isFlag);
      row.classList.toggle("is-set", !!name);

      var bar = one(".club-bar", row);
      if (!bar) {
        bar = doc.createElement("div");
        bar.className = "club-bar";
        bar.innerHTML = "<b></b>";
        row.appendChild(bar);
      }
      var n = clubCount(row);
      one("b", bar).style.width = (n > 0 ? Math.max(6, (n / max) * 100) : 0) + "%";
    });
  }

  // ----------------------------------------------------------
  //  5. JARAYON HALQASI VA RO'YXAT
  // ----------------------------------------------------------

  var RING_R = 52;
  var RING_C = 2 * Math.PI * RING_R;

  function progressItems() {
    var form = centerIsActive() ? one("#center-form") : one("#youth-form");
    if (!form) return [];

    var seen = {};
    var items = [];

    all("[data-prog]", form).forEach(function (el) {
      // Yashirilgan bo'lim ("Boshqa" sertifikat nomi) talab qilinmaydi
      if (el.closest("[hidden]")) return;

      var label = el.dataset.prog;
      var ok = !!String(el.value || "").trim();
      if (el.dataset.progType === "phone") ok = digitsOf(el.value).length === 9;

      if (seen[label] != null) {
        items[seen[label]].ok = items[seen[label]].ok || ok;
        return;
      }
      seen[label] = items.length;
      items.push({ label: label, ok: ok });
    });

    if (form.id === "center-form") {
      var done = all("#club-rows .club-row").some(function (r) {
        return clubName(r) && clubCount(r) > 0;
      });
      items.push({ label: "Kamida bitta to'garak", ok: done });
    }

    return items;
  }

  function renderProgress() {
    var items = progressItems();
    var okCount = items.filter(function (i) { return i.ok; }).length;
    var pct = items.length ? Math.round((okCount / items.length) * 100) : 0;

    var ring = one("#prog-ring");
    var fg = one("#prog-fg");
    if (fg) {
      fg.setAttribute("stroke-dasharray", RING_C.toFixed(1));
      fg.setAttribute("stroke-dashoffset", (RING_C * (1 - pct / 100)).toFixed(1));
    }
    if (ring) ring.classList.toggle("is-done", pct === 100);

    var pctEl = one("#prog-pct");
    if (pctEl) pctEl.textContent = String(pct);

    var note = one("#prog-note");
    if (note) {
      note.textContent = pct === 100
        ? "Hammasi tayyor — yuborishingiz mumkin."
        : okCount + " / " + items.length + " majburiy maydon to'ldirildi.";
    }

    var list = one("#prog-list");
    if (list) {
      var html = items.map(function (i) {
        return '<div class="prog-item' + (i.ok ? " ok" : "") + '">' +
          '<span class="tick">' + ICON.check + "</span>" +
          "<span>" + esc(i.label) + "</span></div>";
      }).join("");
      if (list.getAttribute("data-html") !== html) {
        list.setAttribute("data-html", html);
        list.innerHTML = html;
      }
    }
  }

  // ----------------------------------------------------------
  //  6. MARKAZ KARTASI (jonli ko'rinish)
  // ----------------------------------------------------------

  function renderCenterPreview() {
    var name = val("#c-name");
    var phone = val("#c-phone");
    var staff = val("#c-staff");

    var nameEl = one("#pv-name");
    if (nameEl) {
      nameEl.textContent = name || "O'quv markaz nomi";
      nameEl.style.color = name ? "" : "#94A3B8";
    }

    var metaEl = one("#pv-meta");
    if (metaEl) {
      metaEl.textContent = digitsOf(phone).length
        ? phone
        : "Telefon raqami kiritilmagan";
    }

    // logotip — forma ichidagi ko'rinishdan olinadi
    var pvLogo = one("#pv-logo");
    if (pvLogo) {
      var srcImg = one("#logo-preview img");
      if (srcImg) {
        if (pvLogo.getAttribute("data-src") !== srcImg.src) {
          pvLogo.setAttribute("data-src", srcImg.src);
          pvLogo.innerHTML = '<img src="' + srcImg.src + '" alt="Logotip" />';
        }
      } else {
        var initials = name
          ? name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase()
          : "";
        var html = initials || ICON.building;
        if (pvLogo.getAttribute("data-src") !== html) {
          pvLogo.setAttribute("data-src", html);
          pvLogo.innerHTML = html;
        }
      }
    }

    var list = all("#club-rows .club-row").map(function (r) {
      return { name: clubName(r), count: clubCount(r) };
    }).filter(function (c) { return c.name && c.count > 0; });

    var total = list.reduce(function (s, c) { return s + c.count; }, 0);

    var sEl = one("#pv-staff");
    if (sEl) sEl.textContent = staff ? staff : "—";
    var cEl = one("#pv-clubs");
    if (cEl) cEl.textContent = String(list.length);
    var stEl = one("#pv-students");
    if (stEl) stEl.textContent = total ? String(total) : "—";

    var chips = one("#pv-chips");
    if (chips) {
      var out;
      if (!list.length) {
        out = '<div class="pv-empty">' + ICON.sparkle +
          "<span>To'garak tanlang — shu yerda ro'yxat paydo bo'ladi.</span></div>";
      } else {
        out = list.map(function (c) {
          var v = subjectVisual(c.name);
          return '<span class="pv-chip"><span class="ci">' + v.html + "</span>" +
            esc(c.name) + " <em>" + c.count + "</em></span>";
        }).join("");
      }
      if (chips.getAttribute("data-html") !== out) {
        chips.setAttribute("data-html", out);
        chips.innerHTML = out;
      }
    }
  }

  // ----------------------------------------------------------
  //  7. SERTIFIKAT KARTASI (jonli ko'rinish)
  // ----------------------------------------------------------

  var GAUGE_R = 35;
  var GAUGE_C = 2 * Math.PI * GAUGE_R;

  function scoreInfo(type, raw) {
    if (!type || !raw) return { pct: 0, label: "—", scale: "NATIJA" };
    if (type === "IELTS") {
      return { pct: Math.min(1, Number(raw) / 9), label: raw, scale: "BAND" };
    }
    if (type === "CEFR") {
      var map = { B2: 0.72, C1: 0.86, C2: 1 };
      return { pct: map[raw] || 0.6, label: raw, scale: "DARAJA" };
    }
    if (type === "SAT") {
      var n = Number(raw);
      var p = 0.7 + 0.3 * ((n - 1400) / 200);
      return { pct: Math.max(0, Math.min(1, p)), label: raw, scale: "SAT" };
    }
    if (type === "TOPIK") {
      return { pct: Math.min(1, (Number(raw) || 0) / 6), label: raw, scale: "DARAJA" };
    }
    // Ro'yxatda yo'q sertifikat: halqa to'la, natija matn ko'rinishida
    return { pct: raw ? 1 : 0, label: String(raw).slice(0, 7), scale: "NATIJA" };
  }

  function renderCertPreview() {
    var fish = val("#y-fish");
    var school = val("#y-school");
    var grade = val("#y-grade");
    var lang = val("#y-language");
    var type = val("#y-cert-type");
    var date = val("#y-cert-date");
    var center = val("#y-center");
    var other = val("#y-cert-other");
    var raw = type === "SAT" ? val("#y-result-sat")
            : type === "Boshqa" ? val("#y-result-text")
            : val("#y-result");

    var nameEl = one("#cv-name");
    if (nameEl) {
      nameEl.textContent = fish || "O'quvchining ismi-sharifi";
      nameEl.style.color = fish ? "" : "#94A3B8";
    }

    var subEl = one("#cv-sub");
    if (subEl) {
      var parts = [];
      if (school) parts.push(/^\d+$/.test(school) ? school + "-maktab" : school);
      if (grade) parts.push(grade + "-sinf");
      subEl.textContent = parts.length ? parts.join(" · ") : "Maktab va sinf tanlanmagan";
    }

    var logo = one("#cv-logo");
    if (logo) {
      var lhtml = type === "Boshqa"
        ? (other ? '<span class="txt">' + esc(other.slice(0, 8)) + "</span>" : '<span class="txt">—</span>')
        : (CERT_LOGO[type] || '<span class="txt">—</span>');
      if (logo.getAttribute("data-html") !== lhtml) {
        logo.setAttribute("data-html", lhtml);
        logo.innerHTML = lhtml;
      }
    }

    var info = scoreInfo(type, raw);
    var fg = one("#cv-gauge");
    if (fg) {
      fg.setAttribute("stroke-dasharray", GAUGE_C.toFixed(1));
      fg.setAttribute("stroke-dashoffset", (GAUGE_C * (1 - info.pct)).toFixed(1));
    }
    var scoreEl = one("#cv-score");
    if (scoreEl) scoreEl.textContent = info.label;
    var scaleEl = one("#cv-scale");
    if (scaleEl) scaleEl.textContent = info.scale;

    // til qatori
    var langRow = one("#cv-lang");
    if (langRow) {
      var ic = one(".ic", langRow);
      var tx = one("b", langRow);
      var vis = FLAG[lang] ? flagVisual(FLAG[lang], lang) : { html: ICON.globe, isFlag: false };
      if (ic && ic.getAttribute("data-html") !== vis.html) {
        ic.setAttribute("data-html", vis.html);
        ic.innerHTML = vis.html;
      }
      if (tx) tx.textContent = lang || "Xorijiy til";
      langRow.classList.toggle("dim", !lang);
    }

    var dateRow = one("#cv-date");
    if (dateRow) {
      var db = one("b", dateRow);
      if (db) db.textContent = date ? dateUz(date) : "Sertifikat sanasi";
      dateRow.classList.toggle("dim", !date);
    }

    var centerRow = one("#cv-center");
    if (centerRow) {
      var cb = one("b", centerRow);
      if (cb) cb.textContent = center || "O'quv markaz";
      centerRow.classList.toggle("dim", !center);
    }

    var seal = one("#cv-seal");
    if (seal) {
      var ready = !!(fish && school && grade && lang && type && date && raw && center
        && (type !== "Boshqa" || other));
      seal.classList.toggle("idle", !ready);
      var p = one("#cv-seal-text");
      if (p) {
        p.innerHTML = ready
          ? "<b>Tayyor</b>Ma'lumotlar to'liq — yuborishingiz mumkin."
          : "<b>To'ldirilmoqda</b>Maydonlarni to'ldirgan sari karta jonlanadi.";
      }
    }
  }

  // ----------------------------------------------------------
  //  8. UMUMIY YANGILASH
  // ----------------------------------------------------------

  var rafId = null;
  var timerId = null;

  function runSync() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (timerId) { clearTimeout(timerId); timerId = null; }
    syncAllFilled();
    syncDynamicIcons();
    syncClubUI();
    renderProgress();
    renderCenterPreview();
    renderCertPreview();
  }

  /** rAF fon tabida to'xtab qoladi — shuning uchun taymer zaxirasi bor */
  function syncAll() {
    if (rafId || timerId) return;
    rafId = requestAnimationFrame(runSync);
    timerId = setTimeout(runSync, 90);
  }

  function swapRail() {
    var isCenter = centerIsActive();
    var rc = one("#rail-center");
    var ry = one("#rail-youth");
    if (rc) rc.hidden = !isCenter;
    if (ry) ry.hidden = isCenter;
    syncAll();
  }

  // ----------------------------------------------------------
  //  9. KONFETTI
  // ----------------------------------------------------------

  var confettiFn = null;
  var confettiLoading = false;

  function loadConfetti(then) {
    if (confettiFn) return then(confettiFn);
    if (confettiLoading) return;
    confettiLoading = true;

    var s = doc.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js";
    s.async = true;
    s.onload = function () {
      confettiLoading = false;
      if (!window.confetti) return;
      var canvas = doc.createElement("canvas");
      canvas.id = "confetti-canvas";
      canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:60;pointer-events:none";
      doc.body.appendChild(canvas);
      confettiFn = window.confetti.create(canvas, { resize: true, useWorker: true });
      then(confettiFn);
    };
    s.onerror = function () { confettiLoading = false; };
    doc.head.appendChild(s);
  }

  function celebrate() {
    if (reduceMotion) return;
    loadConfetti(function (fire) {
      var colors = ["#0099B5", "#1EB53A", "#CE1126", "#FFFFFF", "#F59E0B"];
      fire({ particleCount: 70, spread: 62, startVelocity: 45, origin: { x: 0.5, y: 0.72 }, colors: colors });
      setTimeout(function () {
        fire({ particleCount: 45, angle: 60, spread: 70, origin: { x: 0, y: 0.8 }, colors: colors });
        fire({ particleCount: 45, angle: 120, spread: 70, origin: { x: 1, y: 0.8 }, colors: colors });
      }, 180);
    });
  }

  // register.js ichidagi showToast global — muvaffaqiyatda konfetti qo'shamiz
  if (typeof window.showToast === "function") {
    var origToast = window.showToast;
    window.showToast = function (message, ok) {
      origToast.apply(this, arguments);
      if (ok !== false) celebrate();
    };
  }

  // ----------------------------------------------------------
  //  10. SCROLL-REVEAL
  // ----------------------------------------------------------

  function initReveal() {
    var nodes = all(".reveal");
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window) || reduceMotion) {
      nodes.forEach(function (n) { n.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    nodes.forEach(function (n) { io.observe(n); });

    // Zaxira: kuzatuvchi biror sababga ko'ra ishlamasa ham sahifa ko'rinmay qolmasin
    setTimeout(function () {
      nodes.forEach(function (n) { n.classList.add("is-visible"); });
      io.disconnect();
    }, 2500);
  }

  // ----------------------------------------------------------
  //  11. ULASH
  // ----------------------------------------------------------

  function bind() {
    // har qanday kiritish → yangilash
    ["input", "change"].forEach(function (type) {
      doc.addEventListener(type, function (e) {
        if (e.target && e.target.matches && e.target.matches("input, select, textarea")) {
          syncFilled(e.target);
          syncAll();
        }
      }, true);
    });

    // tab almashishini kuzatish
    var panel = one("#panel-center");
    if (panel && window.MutationObserver) {
      new MutationObserver(swapRail).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    }

    // to'garak qatorlari o'zgarishi
    var host = one("#club-rows");
    if (host && window.MutationObserver) {
      new MutationObserver(syncAll).observe(host, { childList: true, subtree: true });
    }

    // logotip ko'rinishi o'zgarishi
    var lp = one("#logo-preview");
    if (lp && window.MutationObserver) {
      new MutationObserver(function () { renderCenterPreview(); })
        .observe(lp, { childList: true, subtree: true });
    }

    // forma tozalanganda
    ["#center-form", "#youth-form"].forEach(function (sel) {
      var f = one(sel);
      if (!f) return;
      f.addEventListener("reset", function () {
        setTimeout(function () { syncAllFilled(); syncAll(); }, 0);
      });
      f.addEventListener("submit", function () {
        setTimeout(function () { syncAllFilled(); syncAll(); }, 60);
      });
    });

    // markazlar ro'yxati asinxron kelgach
    var centerSel = one("#y-center");
    if (centerSel && window.MutationObserver) {
      new MutationObserver(function () { syncAll(); })
        .observe(centerSel, { childList: true });
    }

    initReveal();
    syncAllFilled();
    swapRail();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
