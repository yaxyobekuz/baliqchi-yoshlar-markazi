const SPREADSHEET_ID = "11llr8WBRzh3vDbAhHXp7cxIzcSNi3MSIGMDXDbUhVJo";

// Sahifalar - har bir sahifa o'z formasiga tegishli
const APPLICATION_SHEET = "Arizalar";   // index.html (mustaqil landing formasi)
const YOUTH_SHEET = "Yoshlar";          // register.html - iqtidorli yosh tabi
const CENTER_SHEET = "Markazlar";       // register.html - o'quv markaz tabi

// Logotiplar saqlanadigan Drive papkasi
const LOGO_FOLDER = "Baliqchi - markaz logotiplari";

// Sertifikat faqat shu yilda berilgan bo'lsa qabul qilinadi
// (frontend: assets/form-rules.js dagi CERT_YEAR bilan bir xil bo'lishi kerak)
const CERT_YEAR = 2026;

// Dashboard (dashboard.html) ma'lumot olish uchun shu kalitni yuboradi.
// Bo'sh qoldirilsa - endpoint hammaga ochiq bo'ladi (tavsiya etilmaydi).
const ACCESS_KEY = "baliqchi-2026";

// index.html formasi - o'z ustunlari (markaz maydoni yo'q)
const APPLICATION_HEADERS = [
  "Vaqt",
  "Maktab raqami",
  "Sinfi",
  "O'quvchining ismi-sharifi",
  "Xorijiy til nomi",
  "Sertifikat turi",
  "Sertifikat berilgan sana",
  "Sertifikat natijasi",
  "Telefon raqami",
  "Sayt tili"
];

// register.html - 2-tab ("O'quv markazi" ustuni qo'shimcha)
const YOUTH_HEADERS = [
  "Vaqt",
  "Maktab raqami",
  "Sinfi",
  "O'quvchining ismi-sharifi",
  "Xorijiy til nomi",
  "Sertifikat turi",
  "Sertifikat berilgan sana",
  "Sertifikat natijasi",
  "Telefon raqami",
  "O'quv markazi",
  "Sayt tili"
];

const CENTER_HEADERS = [
  "Vaqt",
  "O'quv markaz nomi",
  "Logotip",
  "Xodimlar soni",
  "To'garaklar soni",
  "To'garaklar (nom va o'quvchi soni)",
  "Jami o'quvchilar",
  "Ijtimoiy reyestrdagi oila farzandlari"
];

// Ikkala yosh jadvalida ham bir xil ustun raqamlari (1 dan boshlanadi)
const COL_DATE_ISSUED = 7;  // G - Sertifikat berilgan sana
const COL_RESULT = 8;       // H - Sertifikat natijasi (B2 / 6.5 / 1450)
const COL_PHONE = 9;        // I - Telefon raqami

// ============================================================
//  O'RNATISH
// ============================================================

/**
 * index.html uchun "Arizalar" sahifasini tayyorlaydi.
 * DIQQAT: mavjud sahifani tozalaydi.
 */
function setupSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = resetSheet(ss, APPLICATION_SHEET, APPLICATION_HEADERS);
  sheet.setColumnWidths(1, APPLICATION_HEADERS.length, 150);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 280);
  applyYouthFormats(sheet);
}

/**
 * register.html uchun "Yoshlar" va "Markazlar" sahifalarini tayyorlaydi.
 * "Arizalar" ga tegmaydi.
 * DIQQAT: shu ikki sahifani tozalaydi.
 */
function setupRegisterSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const youth = resetSheet(ss, YOUTH_SHEET, YOUTH_HEADERS);
  youth.setColumnWidths(1, YOUTH_HEADERS.length, 150);
  youth.setColumnWidth(2, 120);
  youth.setColumnWidth(3, 80);
  youth.setColumnWidth(4, 280);
  applyYouthFormats(youth);

  const centers = resetSheet(ss, CENTER_SHEET, CENTER_HEADERS);
  centers.setColumnWidths(1, CENTER_HEADERS.length, 160);
  centers.setColumnWidth(2, 240);
  centers.setColumnWidth(3, 260);
  centers.setColumnWidth(6, 420);
}

function resetSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const header = sheet.getRange(1, 1, 1, headers.length);
  header.setFontWeight("bold");
  header.setBackground("#0099B5");
  header.setFontColor("#FFFFFF");
  header.setHorizontalAlignment("center");

  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * Formatlar: sana - dd.MM.yyyy; natija va telefon - Plain text
 * (aks holda "6.0" → 6 ga, "+998..." esa formulaga aylanadi).
 */
function applyYouthFormats(sheet) {
  const rows = sheet.getMaxRows() - 1;
  if (rows < 1) return;
  sheet.getRange(2, COL_DATE_ISSUED, rows, 1).setNumberFormat("dd.MM.yyyy");
  sheet.getRange(2, COL_RESULT, rows, 1).setNumberFormat("@");
  sheet.getRange(2, COL_PHONE, rows, 1).setNumberFormat("@");
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    if (name === YOUTH_SHEET || name === APPLICATION_SHEET) applyYouthFormats(sheet);
  }
  return sheet;
}

// ============================================================
//  YOZISH
// ============================================================

/**
 * Front-end POST - `type` qaysi sahifaga yozishni belgilaydi:
 *
 *   type yo'q         → index.html landing formasi      → "Arizalar"
 *   type: "youth"     → register.html 2-tab             → "Yoshlar"
 *   type: "center"    → register.html 1-tab             → "Markazlar"
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "No payload" });
    }

    const data = JSON.parse(e.postData.contents);
    const type = String(data.type || "application");

    if (type === "center") return saveCenter(data);
    if (type === "youth") return saveYouth(data, YOUTH_SHEET, YOUTH_HEADERS, true);
    if (type === "application") return saveYouth(data, APPLICATION_SHEET, APPLICATION_HEADERS, false);
    return jsonResponse({ ok: false, error: "Unknown type: " + type });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/** Ikkala yosh formasi uchun umumiy yozuvchi - faqat sahifa va markaz ustuni farqli */
function saveYouth(data, sheetName, headers, withCenter) {
  const required = ["school", "grade", "fish", "language", "certType", "certDate", "result", "phone"];
  const missing = required.filter(function (k) { return !data[k]; });
  if (missing.length) {
    return jsonResponse({ ok: false, error: "Missing fields: " + missing.join(", ") });
  }

  if (!isValidCertDate(data.certDate)) {
    return jsonResponse({ ok: false, error: "Invalid certDate: " + CERT_YEAR + "-yil kutilgan" });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ensureSheet(ss, sheetName, headers);

  const row = [
    data.timestamp ? new Date(data.timestamp) : new Date(),
    toNumberOrText(data.school),
    toNumberOrText(data.grade),
    String(data.fish).slice(0, 200),
    String(data.language).slice(0, 60),
    String(data.certType).slice(0, 20),
    parseIsoDate(data.certDate),
    String(data.result).slice(0, 20),
    String(data.phone).slice(0, 30)
  ];
  if (withCenter) row.push(String(data.center || "").slice(0, 120));
  row.push(String(data.lang || "uz").slice(0, 4));

  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, COL_DATE_ISSUED).setNumberFormat("dd.MM.yyyy");
  sheet.getRange(nextRow, COL_RESULT).setNumberFormat("@");
  sheet.getRange(nextRow, COL_PHONE).setNumberFormat("@");
  sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);

  return jsonResponse({ ok: true, sheet: sheetName, row: nextRow });
}

function saveCenter(data) {
  if (!data.name) return jsonResponse({ ok: false, error: "Missing fields: name" });

  const staff = Number(data.staff);
  const social = Number(data.social);
  if (!(staff > 0)) return jsonResponse({ ok: false, error: "Invalid staff" });
  if (!(social >= 0)) return jsonResponse({ ok: false, error: "Invalid social" });

  const clubs = (data.clubs || []).filter(function (c) {
    return c && c.name && Number(c.count) > 0;
  });
  if (!clubs.length) return jsonResponse({ ok: false, error: "Missing fields: clubs" });

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ensureSheet(ss, CENTER_SHEET, CENTER_HEADERS);

  const name = String(data.name).trim().slice(0, 120);
  const logoUrl = data.logo ? saveLogo(data.logo, name) : "";
  const summary = clubs.map(function (c) {
    return String(c.name).trim() + " (" + Number(c.count) + ")";
  }).join("; ");
  const students = clubs.reduce(function (sum, c) { return sum + Number(c.count); }, 0);

  const row = [
    data.timestamp ? new Date(data.timestamp) : new Date(),
    name,
    logoUrl,
    staff,
    clubs.length,
    summary.slice(0, 2000),
    students,
    social
  ];

  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);

  return jsonResponse({ ok: true, row: nextRow });
}

/** Logotipni Drive papkasiga saqlab, havolasini qaytaradi */
function saveLogo(logo, centerName) {
  try {
    if (!logo.data) return "";
    const bytes = Utilities.base64Decode(logo.data);
    const ext = (logo.mime === "image/svg+xml") ? ".svg" : ".png";
    const fileName = centerName.replace(/[\\/:*?"<>|]/g, "-") + "-" +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss") + ext;

    const blob = Utilities.newBlob(bytes, logo.mime || "image/png", fileName);
    const file = getLogoFolder().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    // logotip saqlanmasa ham markaz yozuvi yo'qolmasligi kerak
    return "Xato: " + String(err).slice(0, 120);
  }
}

function getLogoFolder() {
  const found = DriveApp.getFoldersByName(LOGO_FOLDER);
  return found.hasNext() ? found.next() : DriveApp.createFolder(LOGO_FOLDER);
}

// ============================================================
//  O'QISH
// ============================================================

/**
 * GET endpoint:
 *   ?action=ping                      - health-check
 *   ?action=centers                   - markaz nomlari (ochiq, forma select'i uchun)
 *   ?action=data&key=...              - dashboard uchun barcha arizalar (JSON)
 *   ?action=...&callback=fn           - xuddi shu, JSONP ko'rinishida
 *
 * JSONP kerak, chunki Apps Script CORS preflight'ni qo'llab-quvvatlamaydi.
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || "ping";
  const callback = params.callback;

  if (action === "ping") {
    return reply({ ok: true, service: "Baliqchi gifted-youth registry", time: new Date().toISOString() }, callback);
  }

  if (action === "centers") {
    try {
      return reply({ ok: true, centers: readCenterNames() }, callback);
    } catch (err) {
      return reply({ ok: false, error: String(err) }, callback);
    }
  }

  if (action !== "data") {
    return reply({ ok: false, error: "Unknown action: " + action }, callback);
  }

  if (ACCESS_KEY && params.key !== ACCESS_KEY) {
    return reply({ ok: false, error: "unauthorized" }, callback);
  }

  try {
    return reply({ ok: true, updatedAt: new Date().toISOString(), rows: readApplicationRows() }, callback);
  } catch (err) {
    return reply({ ok: false, error: String(err) }, callback);
  }
}

/** Markaz nomlari - takrorlanmagan, alifbo tartibida */
function readCenterNames() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CENTER_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  const seen = {};
  const names = [];

  values.forEach(function (r) {
    const name = String(r[0] || "").trim();
    if (!name || seen[name.toLowerCase()]) return;
    seen[name.toLowerCase()] = true;
    names.push(name);
  });

  return names.sort(function (a, b) { return a.localeCompare(b); });
}

/** dashboard.html uchun: "Arizalar" sahifasini obyektlar ro'yxatiga aylantiradi */
function readApplicationRows() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(APPLICATION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, APPLICATION_HEADERS.length).getValues();
  const tz = Session.getScriptTimeZone();

  return values
    .filter(function (r) { return r[3] !== "" && r[3] != null; })
    .map(function (r) {
      return {
        ts: asIsoDateTime(r[0], tz),
        school: r[1],
        grade: r[2],
        fish: String(r[3]),
        language: String(r[4]),
        certType: String(r[5]),
        certDate: asIsoDate(r[6], tz),
        result: String(r[7]),
        phone: String(r[8]),
        lang: String(r[9] || "")
      };
    });
}

// ============================================================
//  YORDAMCHILAR
// ============================================================

/** "36" → 36, "36-maktab" → matn holida qoladi */
function toNumberOrText(value) {
  const str = String(value).trim();
  return /^\d+$/.test(str) ? Number(str) : str.slice(0, 40);
}

/** "2026-01-15" → Date (mahalliy tush payti, zona siljishini oldini oladi) */
function parseIsoDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!m) return String(value).slice(0, 20);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

/** Sana 2026-yilga tegishli va kelajakda emasligini tekshiradi */
function isValidCertDate(value) {
  const str = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  if (Number(str.slice(0, 4)) !== CERT_YEAR) return false;
  return str <= Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function asIsoDate(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  return String(v || "").slice(0, 10);
}

function asIsoDateTime(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss");
  return String(v || "");
}

/** JSONP so'ralgan bo'lsa JavaScript, aks holda JSON qaytaradi */
function reply(obj, callback) {
  const body = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + "(" + body + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  QO'LDA TEST
// ============================================================

/** Apps Script editorida: funksiyani tanlab Run bosing */

/** index.html formasi → "Arizalar" */
function testApplicationPost() {
  const res = doPost({
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        school: "21",
        grade: "11",
        fish: "Test Foydalanuvchi Testovich",
        language: "Ingliz tili",
        certType: "IELTS",
        certDate: CERT_YEAR + "-05-05",
        result: "6.5",
        phone: "+998 90 123 45 67",
        lang: "uz"
      })
    }
  });
  Logger.log(res.getContent());
}

/** register.html 2-tab → "Yoshlar" */
function testYouthPost() {
  const res = doPost({
    postData: {
      contents: JSON.stringify({
        type: "youth",
        timestamp: new Date().toISOString(),
        school: "36",
        grade: "10",
        fish: "Raxmonaliyev Abubakir Komiljon o'g'li",
        language: "Ingliz tili",
        certType: "CEFR",
        certDate: CERT_YEAR + "-02-14",
        result: "B2",
        phone: "+998 95 477 08 11",
        center: "Baliqchi Edu Center",
        lang: "uz"
      })
    }
  });
  Logger.log(res.getContent());
}

/** register.html 1-tab → "Markazlar" */
function testCenterPost() {
  const res = doPost({
    postData: {
      contents: JSON.stringify({
        type: "center",
        timestamp: new Date().toISOString(),
        name: "Baliqchi Edu Center",
        staff: 14,
        social: 23,
        clubs: [
          { name: "Ingliz tili", count: 42 },
          { name: "Matematika", count: 18 }
        ]
      })
    }
  });
  Logger.log(res.getContent());
}
