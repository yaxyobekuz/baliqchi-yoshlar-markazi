# Baliqchi tumani - Iqtidorli yoshlar ro'yxati

Davlat loyihasi uchun statik landing page. Forma to'ldirilganda ma'lumotlar
to'g'ridan-to'g'ri **Google Sheets** ga (Google Apps Script Web App orqali) tushadi.

3 tilli: O'zbek / Русский / English.

## Tuzilma

```
form/
├── index.html                # Asosiy sahifa
├── assets/
│   ├── translations.js       # 3 tilli matnlar
│   ├── style.css             # Animatsiyalar va qo'shimcha stillar
│   └── script.js             # i18n, scroll-reveal, forma yuborish
└── apps-script/
    └── Code.gs               # Google Apps Script (backend)
```

## 1-qadam - Google Sheet yaratish

1. <https://sheets.google.com> ga kiring va yangi spreadsheet yarating.
2. Nomini bering, masalan: **Baliqchi - Iqtidorli yoshlar 2025**.
3. URL'dan ID nusxalang:
   `https://docs.google.com/spreadsheets/d/`**`<<<BU_QISMI>>>`**`/edit`

## 2-qadam - Apps Script o'rnatish

1. Spreadsheet ichida **Extensions → Apps Script**.
2. Standart `Code.gs` faylini tozalang va `apps-script/Code.gs` mazmunini paste qiling.
3. Yuqorida `SPREADSHEET_ID` konstantasiga 1-qadamdagi ID ni qo'ying.
4. **Save** (💾) bosing.
5. Funksiyalar ro'yxatidan `setupSheet` ni tanlab **Run** bosing - birinchi marta
   ruxsatlar so'raydi: **Authorize → Advanced → Go to project (unsafe) → Allow**.
   Bu spreadsheetda "Arizalar" sahifasi va sarlavhalar paydo qiladi.
6. Test qilish uchun `testPost` funksiyasini ham bir marta ishga tushiring -
   "Arizalar" sahifasida test qator paydo bo'lishi kerak.

## 3-qadam - Web App sifatida deploy qilish

1. Apps Script editorida o'ng yuqorida: **Deploy → New deployment**.
2. ⚙️ tugmasidan **Web app** ni tanlang.
3. Sozlamalar:
   - **Description:** `Baliqchi gifted-youth registry v1`
   - **Execute as:** `Me (sizning hisobingiz)`
   - **Who has access:** **`Anyone`** (muhim - bu autentifikatsiyasiz POST qabul qilish uchun kerak)
4. **Deploy** bosing → birinchi marta yana ruxsat so'rashi mumkin.
5. **Web app URL** ni nusxalang (shaklda:
   `https://script.google.com/macros/s/AKfyc.../exec`).

## 4-qadam - Frontend bilan ulash

`assets/script.js` faylida birinchi qatorni o'zgartiring:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfyc.../exec";
```

## 5-qadam - Ishga tushirish

Loyiha sof statik - hech qanday build kerak emas.

**Lokal test:**

```powershell
# Eng oddiy variant - fayl ustiga ikki marta bosing
start index.html

# Yoki kichik server (Node bor bo'lsa)
npx serve .
```

**Hosting:**

- **GitHub Pages** - repoga yuklang, Settings → Pages → main branch.
- **Netlify / Vercel** - drag-and-drop yoki repodan deploy.
- **Davlat serveriga** - `index.html` va `assets/` papkasini www-rootga qo'ying.

## Forma maydonlari

| Maydon | Tip | Talab |
|---|---|---|
| F.I.Sh | text | min 5 ta belgi |
| Telefon | tel | maska `+998 __ ___ __ __` |
| Maktab / Sinf | text | majburiy |
| Imtihon turi | select | IELTS / TOEFL / C2 / C1 / B2 / B1 / Goethe / HSK / Boshqa |
| Natija / Ball | text | masalan `7.5` yoki `B2` |

## Sheetdagi ustunlar

`Vaqt | F.I.Sh | Telefon | Maktab / Sinf | Imtihon turi | Natija / Ball | Til`

## Yangi versiya chiqarish

Apps Script kodini o'zgartirgan har safar:

1. **Deploy → Manage deployments**.
2. Mavjud deploymentni tanlab ✏️ (Edit) bosing.
3. **Version: New version** → **Deploy**.

URL o'zgarmaydi - `script.js` ni o'zgartirish shart emas.

## Tez-tez uchraydigan muammolar

| Muammo | Sabab | Yechim |
|---|---|---|
| Sheetda yangi qator chiqmayapti | Deploy "Anyone" emas | 3-qadamni qayta bajaring |
| Brauzer konsolida CORS xato | Apps Script CORS preflight yubormaydi | Kod allaqachon `mode: 'no-cors'` ishlatadi - bu normal, javobni o'qib bo'lmaydi lekin yozish ishlaydi |
| Forma yuborilgach hech narsa bo'lmayapti | `APPS_SCRIPT_URL` o'rnatilmagan | `assets/script.js` ning 1-qatorini tekshiring |
| `setupSheet` xato qaytaryapti | `SPREADSHEET_ID` noto'g'ri | URL'dan IDni qayta nusxalang |

## Litsenziya

Davlat loyihasi - Baliqchi tumani hokimligi (2025).
