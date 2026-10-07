const SPREADSHEET_ID = "11llr8WBRzh3vDbAhHXp7cxIzcSNi3MSIGMDXDbUhVJo";
const SHEET_NAME = "Arizalar";

const HEADERS = [
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

// Ustun indekslari (1 dan boshlanadi)
const COL_DATE_ISSUED = 7;  // G - Sertifikat berilgan sana
const COL_RESULT = 8;       // H - Sertifikat natijasi (B2 / 6.5 / 1450)
const COL_PHONE = 9;        // I - Telefon raqami

// Sertifikat faqat shu yilda berilgan bo'lsa qabul qilinadi
const CERT_YEAR = 2026;

// Dashboard (dashboard.html) ma'lumot olish uchun shu kalitni yuboradi.
// Bo'sh qoldirilsa - endpoint hammaga ochiq bo'ladi (tavsiya etilmaydi).
const ACCESS_KEY = "baliqchi-2026";

/**
 * Bir marta qo'lda ishga tushiring: sahifa va sarlavhalarni tayyorlaydi.
 */
function setupSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  const header = sheet.getRange(1, 1, 1, HEADERS.length);
  header.setFontWeight("bold");
  header.setBackground("#0099B5");
  header.setFontColor("#FFFFFF");
  header.setHorizontalAlignment("center");

  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, HEADERS.length, 150);
  sheet.setColumnWidth(2, 120); // Maktab raqami
  sheet.setColumnWidth(3, 80);  // Sinfi
  sheet.setColumnWidth(4, 280); // F.I.Sh kengroq

  applyColumnFormats(sheet);
}

/**
 * Formatlar: sana - dd.MM.yyyy; natija va telefon - Plain text
 * (aks holda "6.0" → 6 ga, "+998..." esa formulaga aylanadi).
 */
function applyColumnFormats(sheet) {
  sheet.getRange(2, COL_DATE_ISSUED, sheet.getMaxRows() - 1, 1).setNumberFormat("dd.MM.yyyy");
  sheet.getRange(2, COL_RESULT, sheet.getMaxRows() - 1, 1).setNumberFormat("@");
  sheet.getRange(2, COL_PHONE, sheet.getMaxRows() - 1, 1).setNumberFormat("@");
}

/**
 * Front-end POST: JSON yuboradi
 * { timestamp, school, grade, fish, language, certType, certDate, result, phone, lang }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "No payload" });
    }

    const data = JSON.parse(e.postData.contents);

    const required = ["school", "grade", "fish", "language", "certType", "certDate", "result", "phone"];
    const missing = required.filter(function (k) { return !data[k]; });
    if (missing.length) {
      return jsonResponse({ ok: false, error: "Missing fields: " + missing.join(", ") });
    }

    if (!isValidCertDate(data.certDate)) {
      return jsonResponse({ ok: false, error: "Invalid certDate: " + CERT_YEAR + "-yil kutilgan" });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
      applyColumnFormats(sheet);
    }

    const row = [
      data.timestamp ? new Date(data.timestamp) : new Date(),
      toNumberOrText(data.school),
      toNumberOrText(data.grade),
      String(data.fish).slice(0, 200),
      String(data.language).slice(0, 60),
      String(data.certType).slice(0, 20),
      parseIsoDate(data.certDate),
      String(data.result).slice(0, 20),
      String(data.phone).slice(0, 30),
      String(data.lang || "uz").slice(0, 4)
    ];

    const nextRow = sheet.getLastRow() + 1;

    // Yangi qator uchun formatlarni kafolatlaymiz
    sheet.getRange(nextRow, COL_DATE_ISSUED).setNumberFormat("dd.MM.yyyy");
    sheet.getRange(nextRow, COL_RESULT).setNumberFormat("@");
    sheet.getRange(nextRow, COL_PHONE).setNumberFormat("@");

    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);

    return jsonResponse({ ok: true, row: nextRow });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/** "36" → 36, "36-maktab" → matn holida qoladi */
function toNumberOrText(value) {
  const str = String(value).trim();
  return /^\d+$/.test(str) ? Number(str) : str.slice(0, 40);
}

/** Sana 2026-yilga tegishli va kelajakda emasligini tekshiradi */
function isValidCertDate(value) {
  const str = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  if (Number(str.slice(0, 4)) !== CERT_YEAR) return false;
  return str <= Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/** "2026-01-15" → Date (mahalliy tush payti, zona siljishini oldini oladi) */
function parseIsoDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!m) return String(value).slice(0, 20);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

/**
 * GET endpoint:
 *   ?action=ping                      - health-check
 *   ?action=data&key=...              - dashboard uchun barcha arizalar (JSON)
 *   ?action=data&key=...&callback=fn  - xuddi shu, JSONP ko'rinishida
 *
 * JSONP kerak, chunki Apps Script CORS preflight'ni qo'llab-quvvatlamaydi;
 * dashboard avval oddiy fetch'ni sinaydi, u ishlamasa JSONP'ga o'tadi.
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || "ping";
  const callback = params.callback;

  if (action === "ping") {
    return reply({ ok: true, service: "Baliqchi gifted-youth registry", time: new Date().toISOString() }, callback);
  }

  if (action !== "data") {
    return reply({ ok: false, error: "Unknown action: " + action }, callback);
  }

  if (ACCESS_KEY && params.key !== ACCESS_KEY) {
    return reply({ ok: false, error: "unauthorized" }, callback);
  }

  try {
    return reply({ ok: true, updatedAt: new Date().toISOString(), rows: readRows() }, callback);
  } catch (err) {
    return reply({ ok: false, error: String(err) }, callback);
  }
}

/** "Arizalar" sahifasini obyektlar ro'yxatiga aylantiradi */
function readRows() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
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

/**
 * Apps Script editorida qo'lda test qilish uchun:
 *   1. funksiyalar ro'yxatidan `testPost` ni tanlang
 *   2. Run tugmasini bosing
 *   3. Sheetda yangi qator paydo bo'lishi kerak
 */
function testPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        school: "36",
        grade: "10",
        fish: "Raxmonaliyev Abubakir Komiljon o'g'li",
        language: "Ingliz tili",
        certType: "CEFR",
        certDate: "2026-02-14",
        result: "B2",
        phone: "+998 95 477 08 11",
        lang: "uz"
      })
    }
  };
  const res = doPost(fakeEvent);
  Logger.log(res.getContent());
}
