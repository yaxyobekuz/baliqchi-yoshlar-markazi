# Baliqchi tumani - Iqtidorli yoshlar ro'yxati

Davlat loyihasi uchun statik landing page. Forma to'ldirilganda ma'lumotlar
to'g'ridan-to'g'ri **Google Sheets** ga (Google Apps Script Web App orqali) tushadi.

3 tilli: O'zbek / Русский / English.

## Tuzilma

```
form/
├── index.html                # Asosiy sahifa (forma)
├── dashboard.html            # Statistika paneli (ichki foydalanish)
├── assets/
│   ├── translations.js       # 3 tilli matnlar
│   ├── style.css             # Animatsiyalar va qo'shimcha stillar
│   ├── script.js             # i18n, scroll-reveal, forma yuborish
│   ├── dashboard.css         # Panel dizayn tokenlari (yorug'/qorong'i)
│   └── dashboard.js          # Ma'lumot olish, filtrlar, SVG grafiklar
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

Maydonlar aynan quyidagi tartibda:

| # | Maydon | Tip | Talab |
|---|---|---|---|
| 1 | Maktab raqami | select | `1` - `61` (`script.js` dagi `SCHOOL_MAX`) |
| 2 | Sinfi | select | `5` - `11` (`GRADE_MIN` / `GRADE_MAX`) |
| 3 | O'quvchining ismi-sharifi | text | min 5 ta belgi |
| 4 | Xorijiy til nomi | select | Ingliz / Nemis / Fransuz / Koreys / Yapon / Xitoy / Arab / Turk / Rus / Boshqa |
| 5 | Sertifikat turi | select | CEFR (Milliy sertifikat) / IELTS / SAT |
| 6 | Sertifikat berilgan sana | date | faqat **2026-yil**, bugungi kundan oshmasin |
| 7 | Sertifikat natijasi | select / number | turga bog'liq (pastda) |
| 8 | Telefon raqami | tel | maska `+998 __ ___ __ __`, 9 ta raqam |

### Sertifikat natijasi - turga bog'liq

7-maydon 5-maydonga qarab o'zgaradi:

| Sertifikat turi | Natija maydoni | Variantlar |
|---|---|---|
| CEFR | select | `B2`, `C1`, `C2` |
| IELTS | select | `5.5` ... `9.0` (0.5 qadam) |
| SAT | number | `1400` - `1600` (10 qadam) |

Qabul shartlari: **CEFR B2+**, **IELTS 5.5 (B2)+**, **SAT 1400+**,
sertifikat **2026-yilda** berilgan bo'lishi shart.

Sanani frontend (`CERT_YEAR` - `assets/script.js`) ham, backend
(`CERT_YEAR` / `isValidCertDate` - `apps-script/Code.gs`) ham tekshiradi.
Yilni o'zgartirsangiz, ikkala joyda ham yangilang.
Ro'yxatni o'zgartirish uchun `assets/script.js` dagi `RESULT_OPTIONS` ni tahrirlang.

## Sheetdagi ustunlar

`Vaqt | Maktab raqami | Sinfi | O'quvchining ismi-sharifi | Xorijiy til nomi | Sertifikat turi | Sertifikat berilgan sana | Sertifikat natijasi | Telefon raqami | Sayt tili`

> ⚠️ Ustunlar o'zgargani uchun Apps Script kodini yangilagandan so'ng
> `setupSheet` ni **qayta ishga tushirish** kerak (eski sarlavhalar tozalanadi).
> Ichida eski arizalar bo'lsa, avval ularni boshqa sahifaga nusxalab oling -
> `setupSheet` sahifani butunlay tozalaydi.

## Statistika paneli (`dashboard.html`)

Yig'ilgan arizalar bo'yicha ichki panel. Tashqi kutubxona ishlatmaydi -
grafiklar SVG'da qo'lda chiziladi, shuning uchun offlayn ham ishlaydi.

### Ichida nima bor

| Blok | Shakli | Izoh |
|---|---|---|
| Jami arizalar | hero raqam | Davr oralig'i bilan |
| Maktablar / 7 kun / yuqori daraja | stat kartalar | Yuqori daraja = C1, C2, IELTS 7.0+, SAT 1500+ |
| Arizalar dinamikasi | maydon + chiziq | 70 kundan uzun davr haftalarga yig'iladi |
| Sertifikat turlari | gorizontal stacked bar | 3 segment, 2px yuza bo'shlig'i |
| Xorijiy tillar | gorizontal bar | Birinchi 7 ta + "Boshqa" |
| Sinflar kesimida | ustunlar | |
| Eng faol maktablar | gorizontal bar | Birinchi 10 ta |
| Natijalar taqsimoti | 3 ta kichik grafik | Shkalalar har xil - CEFR/IELTS/SAT alohida |
| Arizalar ro'yxati | jadval | Saralash, sahifalash, CSV eksport |

Qo'shimcha: filtrlar (davr, sertifikat, til, sinf, maktab, qidiruv) hamma
grafikni bir vaqtda qayta hisoblaydi; har bir grafikning **"Jadval"**
ko'rinishi bor; yorug'/qorong'i mavzu; telefon raqamlari standart holda
yashirilgan; har 2 daqiqada jim yangilanadi.

### Ulash

1. `apps-script/Code.gs` dagi `ACCESS_KEY` ni o'zgartiring (standart: `baliqchi-2026`).
2. Apps Script'ni **qayta deploy qiling** (Deploy → Manage deployments →
   ✏️ → New version), aks holda yangi `doGet` ishlamaydi.
3. `dashboard.html` ni oching va o'sha kalitni kiriting - u brauzerda saqlanadi.

Tekshirish: `<WEB_APP_URL>?action=data&key=baliqchi-2026` - brauzerda JSON chiqishi kerak.

Kalitsiz ko'rish uchun kirish ekranida **"Demo ma'lumotlar bilan ko'rish"**
tugmasi bor - panel o'ylab topilgan 184 ta yozuv bilan to'liq ishlaydi.

> ⚠️ **Panelni ochiq internetda joylashtirmang.** U ismlar va telefon
> raqamlarini ko'rsatadi, `ACCESS_KEY` esa brauzerdagi so'rovda ko'rinadi -
> bu tasodifiy kirishdan to'sadi, lekin haqiqiy himoya emas. Panelni
> lokal oching yoki Web App'ni "Anyone with Google account" rejimiga o'tkazing.

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
