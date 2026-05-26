
const SPREADSHEET_ID = "11llr8WBRzh3vDbAhHXp7cxIzcSNi3MSIGMDXDbUhVJo";
const SHEET_NAME = "Arizalar";

const HEADERS = [
  "Vaqt",
  "F.I.Sh",
  "Telefon",
  "Maktab / Sinf",
  "Imtihon turi",
  "Natija / Ball",
  "Til"
];

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
  sheet.setColumnWidths(1, HEADERS.length, 160);
  sheet.setColumnWidth(2, 240); // F.I.Sh kengroq

  // Telefon ustuni (C) — Plain text format, "+998..." formula deb talqin qilinmasligi uchun
  sheet.getRange("C2:C").setNumberFormat("@");
}

/**
 * Front-end POST: JSON yuboradi { fish, phone, school, exam, score, lang, timestamp }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "No payload" });
    }

    const data = JSON.parse(e.postData.contents);

    if (!data.fish || !data.phone || !data.exam || !data.score) {
      return jsonResponse({ ok: false, error: "Missing fields" });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }

    const row = [
      data.timestamp ? new Date(data.timestamp) : new Date(),
      String(data.fish).slice(0, 200),
      String(data.phone).slice(0, 30),
      String(data.school).slice(0, 120),
      String(data.exam).slice(0, 30),
      String(data.score).slice(0, 30),
      String(data.lang || "uz").slice(0, 4)
    ];

    const nextRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(nextRow, 1, 1, row.length);
    // Telefon (3-ustun) — formula sifatida talqin qilinmasligi uchun Plain text
    sheet.getRange(nextRow, 3).setNumberFormat("@");
    range.setValues([row]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/**
 * Brauzerda URL ochilganda oddiy javob (health-check uchun).
 */
function doGet() {
  return jsonResponse({
    ok: true,
    service: "Baliqchi gifted-youth registry",
    time: new Date().toISOString()
  });
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
        fish: "Test Foydalanuvchi Testovich",
        phone: "+998 90 123 45 67",
        school: "21-maktab, 11-sinf",
        exam: "IELTS",
        score: "7.5",
        lang: "uz"
      })
    }
  };
  const res = doPost(fakeEvent);
  Logger.log(res.getContent());
}
