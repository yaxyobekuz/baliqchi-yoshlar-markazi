# Baliqchi tumani - Iqtidorli yoshlar ro'yxati

Davlat loyihasi uchun statik landing page. Forma to'ldirilganda ma'lumotlar
to'g'ridan-to'g'ri **Google Sheets** ga (Google Apps Script Web App orqali) tushadi.

3 tilli: O'zbek / Русский / English.

## Tuzilma

```
form/
├── index.html                # Asosiy sahifa (landing + forma, 3 tilli)
├── register.html             # Ikki tabli ro'yxatga olish (markaz + yosh)
├── dashboard.html            # Statistika paneli (ichki foydalanish)
├── assets/
│   ├── translations.js       # 3 tilli matnlar
│   ├── style.css             # Animatsiyalar va qo'shimcha stillar
│   ├── script.js             # i18n, scroll-reveal, forma yuborish
│   ├── register.js           # register.html: tablar, to'garaklar, logotip
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
6. `register.html` ham kerak bo'lsa, `setupRegisterSheets` ni ishga tushiring -
   "Yoshlar" va "Markazlar" sahifalari yaratiladi.
7. Test qilish uchun `testApplicationPost`, `testYouthPost` va `testCenterPost`
   funksiyalarini ishga tushiring - har biri o'z sahifasiga qator yozadi.

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

## Ro'yxatga olish sahifasi (`register.html`)

Header + main + footer. Mainda ikkita forma, tab orqali almashadi
(klaviatura: ←/→, Home/End; tanlov URL hashida: `#markaz` / `#yosh`).

### 1-tab - "O'quv markazni kiritish" → `Markazlar` sahifasi

| Maydon | Tip | Talab |
|---|---|---|
| O'quv markaz nomi | text | min 2 belgi |
| Logotipi | file | ixtiyoriy · PNG/JPG/SVG · 5 MB gacha |
| Umumiy hodimlari soni | number | 1 - 2000 |
| To'garaklar nomi + o'quvchi soni | qo'shiladigan qatorlar | kamida 1 ta, nomlar takrorlanmaydi |
| Ijtimoiy reyestrdagi oila farzandlari | number | 0 dan |

Logotip yuborishdan oldin brauzerda 512px gacha kichraytiriladi, so'ng Apps Script
uni **Drive** dagi `Baliqchi - markaz logotiplari` papkasiga saqlab, havolasini
jadvalga yozadi.

> ⚠️ **Drive ruxsati.** Logotip kodi qo'shilgandan keyin skript qayta
> avtorizatsiyadan o'tishi shart, aks holda Logotip katagiga
> `You do not have permission to call DriveApp...` deb yoziladi. Yechim:
> 1. Apps Script muharririda `authorizeDrive` funksiyasini tanlab **Run** bosing
>    → **Review permissions → Advanced → Go to project (unsafe) → Allow**;
> 2. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.
>
> Ikkinchi qadamsiz web-app eski ruxsat bilan ishlashda davom etadi.
> Ruxsatlar `apps-script/appsscript.json` da e'lon qilingan: skript faqat
> **o'zi yaratgan** fayllarga kira oladi (`drive.file`), butun Drive'ga emas.

### 2-tab - "Iqtidorli yoshni ro'yxatdan o'tkazish" → `Yoshlar` sahifasi

`index.html` dagi forma bilan bir xil tartibdagi 8 maydon, oxirida qo'shimcha
**"O'quv markazni tanlash"** maydoni. Yozuvlar alohida (`Yoshlar`) jadvalga tushadi. Uning variantlari
`Markazlar` sahifasidagi nomlardan JSONP orqali olinadi
(`?action=centers`, kalit talab qilinmaydi); ro'yxatga "Markazga a'zo emas"
varianti ham qo'shiladi.

`register.html` mustaqil: `assets/register.js` dan boshqa hech narsaga bog'liq
emas. Qoidalar (maktab 1-61, sinf 5-11, 2026 sanasi, natija ro'yxatlari) shu
faylning boshida - `index.html` dagi `assets/script.js` da ham o'z nusxasi bor,
shart o'zgarsa ikkalasini ham yangilang.

## Sahifalar va jadvallar

Har bir sahifa mustaqil - o'z so'rovi, o'z jadvali. Bitta Apps Script
deployment uchchalasiga xizmat qiladi, POST'dagi `type` maydoni yo'naltiradi.

| Sahifa | POST `type` | Sheets sahifasi | O'rnatish funksiyasi |
|---|---|---|---|
| `index.html` | yo'q | `Arizalar` | `setupSheet` |
| `register.html` 2-tab | `youth` | `Yoshlar` | `setupRegisterSheets` |
| `register.html` 1-tab | `center` | `Markazlar` | `setupRegisterSheets` |

`dashboard.html` **faqat `Arizalar`** dan o'qiydi (`?action=data`), ya'ni
`index.html` formasining natijalarini ko'rsatadi.

### Ustunlar

**`Arizalar`** (index.html):
`Vaqt | Maktab raqami | Sinfi | O'quvchining ismi-sharifi | Xorijiy til nomi | Sertifikat turi | Sertifikat berilgan sana | Sertifikat natijasi | Telefon raqami | Sayt tili`

**`Yoshlar`** (register.html 2-tab) - yuqoridagi + `O'quv markazi`:
`… | Telefon raqami | O'quv markazi | Sayt tili`

**`Markazlar`** (register.html 1-tab):
`Vaqt | O'quv markaz nomi | Logotip | Xodimlar soni | To'garaklar soni | To'garaklar (nom va o'quvchi soni) | Jami o'quvchilar | Ijtimoiy reyestrdagi oila farzandlari`

> ⚠️ `setupSheet` va `setupRegisterSheets` o'z sahifalarini **tozalaydi**.
> `setupSheet` faqat `Arizalar` ga, `setupRegisterSheets` faqat `Yoshlar` va
> `Markazlar` ga tegadi - bir-biriga ta'sir qilmaydi.

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
   ✏️ → New version), aks holda yangi `doGet` ishlamaydi. Bu `register.html`
   dagi markazlar ro'yxati uchun ham kerak.
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
| Logotip katagida `You do not have permission to call DriveApp...` | Skript Drive kodi qo'shilishidan oldin avtorizatsiya qilingan | `authorizeDrive` ni Run qiling, so'ng deploymentni **New version** bilan qayta chiqaring |
| Ustun sarlavhalari ma'lumotga mos kelmayapti | Sahifa qo'lda, boshqa ustunlar bilan yaratilgan | `setupRegisterSheets` ni ishga tushiring yoki sarlavha qatorini kod tartibiga keltiring (ustun soni va tartibi muhim, nomini xohlagancha o'zgartirsa bo'ladi) |

## Litsenziya

Davlat loyihasi - Baliqchi tumani hokimligi (2025).
