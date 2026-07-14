# Sabah Özet Telegram Botu — Araştırma Notları ve Tek Parça Master Prompt

> Araştırma tarihi: 13 Temmuz 2026  
> Hedef: Her sabah saat 08:00'de İstanbul saatine göre teknoloji haberları, hava durumu, günlük referans döviz kurları ve seçili Reddit topluluklarından dikkat dağıtmayan kısa bir Türkçe özet hazırlayıp Telegram'a gönderen otomasyon.

---

## 1. Ben bu proje için ne seçtim?

Bu proje için önerilen mimari:

- **Node.js 24 LTS**
- **TypeScript**
- **GitHub Actions**
- **Telegram Bot API**
- **OpenAI Responses API + Structured Outputs**
- **Open-Meteo Weather Forecast API**
- **Frankfurter v2 Exchange Rates API**
- **RSS/Atom**
- **Reddit'in RSS destekli listing endpoint'leri**
- **Zod**
- **rss-parser**
- **Vitest**
- **ESLint + Prettier**

Neden bu kombinasyon?

1. Node.js 24 şu anda LTS hattında ve production uygulamaları için LTS sürümleri tercih edilmelidir.
2. Node.js'in yerleşik `fetch()` desteği basit HTTP çağrıları için ekstra HTTP istemci bağımlılığını gereksiz kılar.
3. Telegram Bot API doğrudan HTTP tabanlıdır; yalnızca sabah mesajı göndermek için ağır bir Telegram framework'ü gerekmiyor.
4. Open-Meteo anahtar istemeden hava tahmini sağlayabiliyor.
5. Frankfurter anahtar istemeden merkez bankası kaynaklı günlük döviz verisi sağlıyor.
6. Reddit'in resmi API dokümantasyonunda `hot`, `new` ve sıralama endpoint'leri için RSS desteği belirtiliyor.
7. OpenAI Responses API ve Structured Outputs kullanarak AI çıktısını Zod şemasına bağlamak, serbest metin JSON parse hatalarını azaltır.
8. GitHub Actions, IANA timezone destekli scheduled workflow çalıştırabiliyor.

---

## 2. Çok önemli gerçekler ve hata yapmamak için notlar

### GitHub Actions saati hakkında

Workflow şu şekilde ayarlanabilir:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: "0 8 * * *"
      timezone: "Europe/Istanbul"
```

Bu, workflow'u İstanbul saatine göre 08:00 için planlar.

Fakat GitHub resmi dokümantasyonu scheduled workflow'ların yoğunluk dönemlerinde gecikebileceğini, özellikle saat başlarında gecikme riskinin bulunduğunu söylüyor.

Bu nedenle README içinde açıkça şunu belirt:

> "GitHub Actions planlaması 08:00 hedeflidir ancak tam dakika garantisi vermez. Daha düşük gecikme riski için cron değeri `7 8 * * *` yapılarak 08:07 kullanılabilir."

Kullanıcının ana talebi 08:00 olduğu için varsayılan workflow **08:00** kalacak.

### Döviz kuru hakkında

Frankfurter verisini **"anlık canlı piyasa kuru"** diye gösterme.

Frankfurter günlük exchange rate verisi sağlar ve çok sayıda merkez bankası kaynağından veri toplar.

Telegram mesajında başlık:

```text
💱 Günlük referans kurlar
```

olmalı.

Her kuru kaynak tarihiyle beraber göster:

```text
USD/TRY: 00,00
EUR/TRY: 00,00
Kaynak tarihi: 2026-07-13
```

Frankfurter **v2 API** kullanılacak.

Eski v1 response yapısını varsayma.

Zod ile gelen v2 payload'ını doğrula.

Örnek çağrılar:

```text
https://api.frankfurter.dev/v2/rates?base=USD&quotes=TRY
https://api.frankfurter.dev/v2/rates?base=EUR&quotes=TRY
```

### Telegram mesaj uzunluğu hakkında

Telegram `sendMessage` metni entity parsing sonrası 1–4096 karakter sınırına sahiptir.

Bu nedenle:

- Mesajı mümkün olduğunca kısa tut.
- Render edilen HTML 3900 karakteri aşarsa güvenli section sınırlarından böl.
- HTML tag'inin ortasından kesme.
- Birden fazla Telegram mesajı gönder.
- İlk parçaya ana başlık koy.
- Sonraki parçalara `(2/3)`, `(3/3)` gibi küçük parça bilgisi ekle.

### Telegram HTML güvenliği hakkında

`parse_mode: "HTML"` kullan.

RSS, Reddit veya AI'dan gelen hiçbir metni raw HTML olarak Telegram'a basma.

Aşağıdaki karakterleri escape eden merkezi helper yaz:

- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`

Link `href` değerlerini de güvenli hale getir.

Source URL'leri AI'a yeniden ürettirme.

Linkleri uygulamanın kendi normalize edilmiş source item objesinden al.

### AI'nin yapacağı ve yapmayacağı şey

AI şunları yapacak:

- Haber başlıkları ve RSS açıklamalarını Türkçe özetlemek.
- Reddit başlıkları ve mevcut feed açıklamalarını Türkçe özetlemek.
- En önemli birkaç içeriği seçmek.
- "Bugünün ana fikri" cümlesini üretmek.

AI şunları **yapmayacak**:

- Hava sıcaklığı üretmek.
- Döviz kuru üretmek.
- Tarih üretmek.
- URL üretmek.
- Kaynak adı uydurmak.
- Kaynakta olmayan ayrıntı eklemek.

Hava, kur, tarih ve URL verileri kod tarafından deterministik biçimde yazılacak.

---

## 3. Gereken anahtarlar ve bilgiler nereden alınacak?

### A. Telegram bot token

Resmi Telegram yöntemi:

1. Telegram'da `@BotFather` hesabını aç.
2. `/newbot` komutunu gönder.
3. Bot görünen adını belirle.
4. Bot username belirle.
5. BotFather'ın verdiği token'ı kaydet.

Token örneği `.env` veya GitHub Secret içinde tutulacak.

Değişken adı:

```text
TELEGRAM_BOT_TOKEN
```

Token'ı source code içine yazma.

### B. Telegram chat ID

Proje içinde bir setup komutu yaz:

```bash
npm run setup:telegram
```

Bu komut:

1. `TELEGRAM_BOT_TOKEN` var mı kontrol etsin.
2. Kullanıcıya Telegram'da bota `/start` göndermesini söylesin.
3. Telegram Bot API `getUpdates` metodunu çağırsın.
4. Gelen update'lerde bulunan chat adaylarını yazdırsın.
5. Her aday için:
   - chat id
   - chat type
   - username
   - first name/title
   gösterilsin.
6. Token hiçbir log'a basılmasın.

Kullanıcı çıkan ID'yi:

```text
TELEGRAM_CHAT_ID
```

olarak kullanacak.

GitHub'da bunu secret yerine repository variable olarak saklamak mümkündür.

### C. OpenAI API key

OpenAI Platform içindeki API Keys alanından project API key oluştur.

Secret key tam hali oluşturulduğu anda gösterilir; kaybedilirse yeni key oluşturmak gerekebilir.

Değişken:

```text
OPENAI_API_KEY
```

Bunu GitHub Actions Secret olarak sakla.

Kod içinde hardcode etme.

### D. GitHub repository secrets ve variables

GitHub repository:

```text
Settings
→ Secrets and variables
→ Actions
```

Secrets:

```text
OPENAI_API_KEY
TELEGRAM_BOT_TOKEN
```

Variables:

```text
TELEGRAM_CHAT_ID
OPENAI_MODEL
```

`OPENAI_MODEL` tanımlı değilse uygulama default olarak:

```text
gpt-5.6-luna
```

kullansın.

OpenAI'nin güncel model yönlendirmesine göre GPT-5.6 Luna maliyet hassasiyetli/high-volume işler için optimize edilmiş modeldir. Bu proje kısa, net özetleme işi yaptığı için uygun default seçimdir.

---

## 4. Varsayılan RSS kaynakları

Kaynaklar uygulama içinde kolay düzenlenebilir bir config dosyasında olsun.

Varsayılanlar:

```text
TechCrunch
https://techcrunch.com/feed/

Ars Technica
https://arstechnica.com/feed/

GitHub Changelog
https://github.blog/changelog/feed/
```

Kaynak yapısı:

```ts
type RssSource = {
  id: string;
  name: string;
  url: string;
  maxItems: number;
};
```

Varsayılan `maxItems`:

```text
4
```

Kurallar:

- Son 36 saat içindeki içerikleri önceliklendir.
- Feed tarihi eksikse item'i tamamen çöpe atma.
- Bir feed başarısız olursa diğer feed'ler çalışmaya devam etsin.
- Aynı canonical URL iki kaynakta varsa tek içerik kabul et.
- URL yoksa normalize edilmiş başlıkla duplicate kontrolü yap.
- Başlıkları trim et.
- HTML açıklamalarından tag'leri temizle.
- Description/contentSnippet değerini en fazla 1500 karaktere kes.
- AI'a tam makale scraping yaptırma.
- Paywall bypass etme.
- RSS içeriği ve mevcut feed metadata'sı ile çalış.

---

## 5. Varsayılan Reddit kaynakları

Varsayılan subreddit'ler:

```text
r/programming
r/technology
r/selfhosted
```

RSS URL'leri:

```text
https://www.reddit.com/r/programming/hot.rss?limit=5
https://www.reddit.com/r/technology/hot.rss?limit=5
https://www.reddit.com/r/selfhosted/hot.rss?limit=5
```

Reddit'in resmi API dokümantasyonu subreddit `hot` listing endpoint'i için RSS desteğini belirtir.

Reddit request'lerinde açıklayıcı bir User-Agent kullan:

```text
MorningBriefBot/1.0
```

Mümkünse repository/config içinden bot adını versiyonla üret.

Kurallar:

- Her subreddit'ten en fazla 5 kayıt çek.
- AI'a gönderilecek toplam Reddit item sayısı en fazla 9 olsun.
- Aynı link veya aynı normalize başlık duplicate ise ele.
- Reddit içeriği başarısız olursa tüm raporu iptal etme.
- Reddit bölümü yoksa Telegram mesajında:
  `Bugün Reddit kaynaklarından yeterli veri alınamadı.`
  yaz.
- RSS endpoint'leri ileride erişim davranışını değiştirirse hata mesajı açıklayıcı olsun.
- Reddit Data API'ye OAuth migration gerektiren bir durum oluşursa README'de bunun future migration point olduğunu not et.
- Reddit kullanımında gereksiz yüksek frekanslı polling yapma; bu proje günde bir çalışıyor.

---

## 6. İstanbul hava durumu

Default location:

```text
name: İstanbul
latitude: 41.0082
longitude: 28.9784
timezone: Europe/Istanbul
```

Open-Meteo Forecast API kullan.

İstenen veriler:

Current:

```text
temperature_2m
apparent_temperature
weather_code
wind_speed_10m
```

Daily:

```text
temperature_2m_max
temperature_2m_min
precipitation_probability_max
```

`forecast_days=1`

Timezone:

```text
Europe/Istanbul
```

Hava kodları için merkezi `weatherCodeToTurkish()` helper yaz.

Mesaj örneği:

```text
🌤 İstanbul
Şu an 24°C, hissedilen 25°C.
Bugün 20–29°C. Yağış ihtimali %20.
Rüzgâr 14 km/sa.
```

Kısa günlük öneri deterministik rule ile üretilebilir:

- yağış ihtimali >= 50 → `Şemsiye almak mantıklı.`
- max sıcaklık >= 32 → `Öğle saatlerinde sıcaklığa dikkat.`
- current wind >= 35 → `Kuvvetli rüzgâra dikkat.`
- min sıcaklık <= 5 → `Sabah için kalın giyinmek iyi olabilir.`

Bu tavsiyeyi AI'a üretme zorunluluğu yok.

Birden fazla koşul varsa en önemli en fazla 1 kısa öneri göster.

---

## 7. OpenAI özetleme tasarımı

Resmi `openai` JavaScript/TypeScript SDK'sını kullan.

Responses API kullan.

Serbest JSON text üretip `JSON.parse()` yapma.

Şu yaklaşımı kullan:

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const response = await openai.responses.parse({
  model,
  input: [...],
  text: {
    format: zodTextFormat(MorningDigestSchema, "morning_digest"),
  },
});

const digest = response.output_parsed;
```

Zod schema root'u object olsun.

Schema örneği:

```ts
const HighlightSchema = z.object({
  itemId: z.string(),
  summary: z.string(),
  importance: z.enum(["high", "medium"]),
});

const RedditHighlightSchema = z.object({
  itemId: z.string(),
  summary: z.string(),
});

const MorningDigestSchema = z.object({
  technologySummary: z.string(),
  techHighlights: z.array(HighlightSchema),
  redditSummary: z.string(),
  redditHighlights: z.array(RedditHighlightSchema),
  dailyTakeaway: z.string(),
});
```

Structured Outputs strict schema ile çalışırken property'leri gereksiz yere `.optional()` yapma.

Gerçekten boş olabilen değer gerekiyorsa nullable veya boş array/string stratejisini bilinçli kullan.

### OpenAI system instruction

Özetleyiciye aşağıdaki davranışı ver:

```text
Sen Türkçe günlük teknoloji briefing editörüsün.

Görevin yalnızca sana verilen kaynak kayıtlarını özetlemektir.

Kurallar:
- Kaynakta olmayan hiçbir ayrıntıyı ekleme.
- URL üretme veya düzeltmeye çalışma.
- Hava, döviz, tarih veya fiyat üretme.
- Spekülasyonu gerçek gibi yazma.
- Kaynak metni belirsizse belirsizliği koru.
- Reklam dili kullanma.
- Abartılı clickbait dili kullanma.
- Türkçe doğal ve kısa yaz.
- Aynı gelişmeyi tekrar eden kayıtları tek temada birleştir.
- technologySummary 3-4 kısa cümle olsun.
- techHighlights en fazla 4 kayıt seçsin.
- Her tech highlight summary 1 kısa cümle olsun.
- redditSummary 3-4 kısa cümle olsun.
- redditHighlights en fazla 3 kayıt seçsin.
- Her Reddit highlight summary 1 kısa cümle olsun.
- dailyTakeaway 1-2 kısa cümle olsun.
- Sadece input içindeki itemId değerlerini döndür.
- Bir itemId uydurma.
- Önceliği yeni, anlamlı ve teknoloji açısından etkili gelişmelere ver.
```

### OpenAI input format

AI'a ham object dump gönderme.

Açık etiketli text üret:

```text
TECH ITEMS

[tech-001]
Source: TechCrunch
Title: ...
PublishedAt: ...
Description: ...

[tech-002]
Source: Ars Technica
Title: ...
PublishedAt: ...
Description: ...

REDDIT ITEMS

[reddit-001]
Source: r/programming
Title: ...
PublishedAt: ...
Description: ...
```

Her item için uygulama içinde güvenilir bir ID üret.

AI response döndüğünde:

1. `output_parsed` null mı kontrol et.
2. Dönen her `itemId` gerçekten input item map içinde var mı doğrula.
3. Uydurulmuş itemId varsa drop et ve warning log yaz.
4. Link ve source bilgilerini AI çıktısından değil kendi item map'inden al.
5. OpenAI çağrısı tamamen başarısız olursa fallback rapor oluştur.

### AI fallback

OpenAI çalışmazsa bot tamamen susmamalı.

Fallback rapor:

- Hava durumunu göster.
- Referans kurları göster.
- Teknoloji bölümünde en yeni 5 haberin sadece temizlenmiş başlığını ve source link'ini göster.
- Reddit bölümünde en fazla 3 başlık ve link göster.
- Şu notu ekle:

```text
ℹ️ AI özeti bugün oluşturulamadı; kaynak başlıkları gösteriliyor.
```

Sonra Telegram'a raporu gönder.

OpenAI hatası yüzünden process'i doğrudan `exit(1)` ile bitirme; fallback kullanılabiliyorsa raporu gönder.

---

## 8. Telegram mesaj formatı

Önerilen format:

```text
☀️ Günaydın, broski

📅 13 Temmuz 2026 Pazartesi

🌤 İstanbul
Şu an 24°C, hissedilen 25°C.
Bugün 20–29°C. Yağış ihtimali %20.
Şemsiye almak mantıklı.

💱 Günlük referans kurlar
USD/TRY: 00,00
EUR/TRY: 00,00
Kaynak tarihi: 2026-07-13

📰 Teknoloji özeti
3-4 cümlelik dikkat dağıtmayan özet.

Öne çıkanlar:
• Başlık — tek cümlelik Türkçe özet
  TechCrunch · Kaynağı aç

• Başlık — tek cümlelik Türkçe özet
  GitHub Changelog · Kaynağı aç

🔥 Reddit radarı
3-4 cümlelik kısa genel özet.

• r/programming — tek cümlelik özet
  Konuyu aç

• r/selfhosted — tek cümlelik özet
  Konuyu aç

🧠 Bugünün ana fikri
1-2 kısa cümle.
```

Gerçek mesaj `parse_mode: "HTML"` kullanarak render edilsin.

Örnek HTML mantığı:

```html
<b>☀️ Günaydın, broski</b>

<b>🌤 İstanbul</b>
...

<b>📰 Teknoloji özeti</b>
...

<a href="SOURCE_URL">Kaynağı aç</a>
```

`disable_web_page_preview` veya güncel Bot API eşdeğer link preview ayarı kullanılarak çok sayıda preview oluşması engellensin.

Telegram Bot API response `ok !== true` ise hata fırlat.

HTTP status başarılı olsa bile Telegram JSON body'sindeki `ok` alanını kontrol et.

---

## 9. Proje yapısı

Aşağıdaki yapıya yakın temiz bir repo üret:

```text
morning-brief-bot/
├─ .github/
│  └─ workflows/
│     └─ morning-brief.yml
├─ src/
│  ├─ config/
│  │  ├─ env.ts
│  │  └─ sources.ts
│  ├─ domain/
│  │  ├─ types.ts
│  │  └─ schemas.ts
│  ├─ services/
│  │  ├─ rss.service.ts
│  │  ├─ reddit.service.ts
│  │  ├─ weather.service.ts
│  │  ├─ fx.service.ts
│  │  ├─ openai.service.ts
│  │  └─ telegram.service.ts
│  ├─ utils/
│  │  ├─ fetch-with-retry.ts
│  │  ├─ html.ts
│  │  ├─ normalize.ts
│  │  ├─ date.ts
│  │  ├─ logger.ts
│  │  └─ weather-code.ts
│  ├─ report/
│  │  ├─ build-report.ts
│  │  ├─ fallback-report.ts
│  │  └─ render-telegram.ts
│  ├─ setup-telegram.ts
│  └─ index.ts
├─ tests/
│  ├─ normalize.test.ts
│  ├─ weather-code.test.ts
│  ├─ render-telegram.test.ts
│  ├─ telegram-chunk.test.ts
│  └─ fx.test.ts
├─ .env.example
├─ .gitignore
├─ eslint.config.js
├─ package.json
├─ package-lock.json
├─ prettier.config.js
├─ tsconfig.json
└─ README.md
```

Dosya isimleri mantıklı gerekçeyle küçük değişebilir ama tek bir devasa `index.ts` içinde bütün sistemi yazma.

---

## 10. Network ve hata toleransı

Merkezi `fetchWithRetry()` helper yaz.

Default:

```text
timeout: 12 seconds
max attempts: 3
```

Retry yapılacak durumlar:

- network error
- request timeout
- HTTP 429
- HTTP 500
- HTTP 502
- HTTP 503
- HTTP 504

Retry yapılmaması gereken tipik durumlar:

- 400
- 401
- 403
- 404

Backoff:

```text
attempt 1 → yaklaşık 500 ms
attempt 2 → yaklaşık 1000 ms
attempt 3 → yaklaşık 2000 ms
```

Jitter ekle.

`AbortSignal.timeout()` veya kontrollü AbortController kullan.

Secret değerlerini error log'a koyma.

RSS ve Reddit kaynaklarını `Promise.allSettled()` benzeri partial success yaklaşımıyla çek.

Bir kaynak hatası tüm raporu iptal etmesin.

Weather veya FX başarısızsa ilgili section:

```text
Veri şu anda alınamadı.
```

desin.

Ama Telegram gönderimi başarısızsa process başarısız kabul edilsin.

---

## 11. Environment validation

Zod ile env validation yap.

Required:

```text
OPENAI_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Ancak `--dry-run` modunda:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

zorunlu olmasın.

OpenAI key yoksa dry-run sırasında fallback behavior test edilebilsin.

Optional:

```text
OPENAI_MODEL=gpt-5.6-luna
LOG_LEVEL=info
DRY_RUN=false
```

`.env.example`:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

LOG_LEVEL=info
DRY_RUN=false
```

`.env` mutlaka `.gitignore` içinde olsun.

---

## 12. npm script'leri

En az:

```json
{
  "scripts": {
    "dev": "tsx src/index.ts --dry-run",
    "send": "tsx src/index.ts",
    "dry-run": "tsx src/index.ts --dry-run",
    "setup:telegram": "tsx src/setup-telegram.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint .",
    "format": "prettier --write .",
    "check": "npm run typecheck && npm run lint && npm test"
  }
}
```

Exact tooling syntax kullanılan package sürümüne göre doğru şekilde düzenlenebilir.

`npm run check` yeşil olmalı.

---

## 13. Dry-run davranışı

```bash
npm run dry-run
```

çalışınca:

- API verilerini çek.
- Mümkünse OpenAI özeti oluştur.
- Telegram mesajını render et.
- Telegram'a gönderme.
- Terminale final Telegram text'i yaz.
- Mesaj kaç parçaya bölündüyse her parçayı ayrı göster.
- Secret yazdırma.

CLI flag:

```text
--dry-run
```

env `DRY_RUN=true` değerinden öncelikli olabilir.

---

## 14. GitHub Actions workflow

`.github/workflows/morning-brief.yml`

Gereksinimler:

```yaml
name: Morning Brief

on:
  workflow_dispatch:
  schedule:
    - cron: "0 8 * * *"
      timezone: "Europe/Istanbul"

permissions:
  contents: read

concurrency:
  group: morning-brief
  cancel-in-progress: false

jobs:
  send:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      - run: npm run typecheck

      - run: npm test

      - run: npm run send
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ vars.TELEGRAM_CHAT_ID }}
          OPENAI_MODEL: ${{ vars.OPENAI_MODEL }}
```

Eğer `OPENAI_MODEL` GitHub variable tanımlı değilse uygulamanın kendi default'u devreye girmeli.

Workflow'a gereksiz write permission verme.

README içinde:

- workflow file default branch üzerinde olmalı
- schedule tam dakika garantili değildir
- Actions sekmesinden `workflow_dispatch` ile manuel test yapılabilir

notlarını açıkça yaz.

---

## 15. Test edilmesi gereken şeyler

### Unit tests

#### Duplicate normalization

Aşağıdakiler aynı title kabul edilebilmeli:

```text
OpenAI launches new model
OpenAI launches new model!
  OpenAI launches new model
```

Normalize function:

- lowercase
- trim
- whitespace collapse
- basit punctuation normalization

uygulayabilir.

#### Weather code mapper

Bilinmeyen weather code:

```text
Bilinmeyen hava durumu
```

gibi güvenli fallback vermeli.

#### Telegram HTML escape

Input:

```text
OpenAI <test> & news
```

Output:

```text
OpenAI &lt;test&gt; &amp; news
```

#### Message chunking

- 3900 altı tek parça.
- 3900 üstü section boundary'den bölünsün.
- Hiçbir parça Telegram limitini aşmasın.
- Link/tag ortasından kesilmesin.

#### FX parsing

Frankfurter v2 response schema validation test edilsin.

USD ve EUR response'ları doğru `USD/TRY`, `EUR/TRY` label'ına bağlansın.

#### AI item id validation

AI input'ta olmayan:

```text
tech-999
```

döndürürse highlight drop edilsin.

---

## 16. README içinde bulunması gereken setup rehberi

README çok net olsun.

### Local setup

```bash
git clone ...
cd morning-brief-bot
npm ci
cp .env.example .env
```

Sonra Telegram bot token al.

`.env` içine:

```text
TELEGRAM_BOT_TOKEN=...
```

yaz.

Telegram'da bota `/start` gönder.

Çalıştır:

```bash
npm run setup:telegram
```

Chat ID'yi al.

`.env` içine:

```text
TELEGRAM_CHAT_ID=...
```

yaz.

OpenAI API key oluştur.

`.env` içine:

```text
OPENAI_API_KEY=...
```

yaz.

Kontrol:

```bash
npm run check
```

Dry run:

```bash
npm run dry-run
```

Gerçek gönderim:

```bash
npm run send
```

### GitHub Actions setup

Repository:

```text
Settings
→ Secrets and variables
→ Actions
```

Secrets:

```text
OPENAI_API_KEY
TELEGRAM_BOT_TOKEN
```

Variables:

```text
TELEGRAM_CHAT_ID
OPENAI_MODEL = gpt-5.6-luna
```

Sonra:

```text
Actions
→ Morning Brief
→ Run workflow
```

ile manuel test.

Başarılıysa günlük schedule çalışacak.

---

## 17. Resmi kaynaklar

### OpenAI

API quickstart:

https://developers.openai.com/api/docs/quickstart

Official JavaScript SDK:

https://github.com/openai/openai-node

Structured Outputs:

https://developers.openai.com/api/docs/guides/structured-outputs

Models:

https://developers.openai.com/api/docs/models

GPT-5.6 Luna:

https://developers.openai.com/api/docs/models/gpt-5.6-luna

API key help:

https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key

API key safety:

https://developers.openai.com/api/docs/guides/production-best-practices

### Telegram

Bot tutorial / BotFather:

https://core.telegram.org/bots/tutorial

Bot API:

https://core.telegram.org/bots/api

### GitHub Actions

Schedule event:

https://docs.github.com/actions/using-workflows/events-that-trigger-workflows

Workflow syntax:

https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions

Actions secrets:

https://docs.github.com/actions/security-guides/using-secrets-in-github-actions

Actions variables:

https://docs.github.com/actions/learn-github-actions/variables

### Weather

Open-Meteo Forecast API:

https://open-meteo.com/en/docs

### Exchange rates

Frankfurter v2:

https://frankfurter.dev/

### Reddit

Reddit API endpoint documentation:

https://www.reddit.com/dev/api/

Reddit Data API Terms:

https://redditinc.com/policies/data-api-terms

### RSS sources

TechCrunch feed information:

https://techcrunch.com/subscribing/

Ars Technica RSS information:

https://arstechnica.com/rss-feeds/

GitHub Changelog:

https://github.blog/changelog/

### Node.js

Node.js releases:

https://nodejs.org/en/about/previous-releases

Node.js fetch:

https://nodejs.org/learn/getting-started/fetch

---

# MASTER PROMPT — BUNU CODEX / CODING AGENT'E TEK PARÇA VER

Aşağıdaki prompt'un tamamını tek mesaj olarak coding agent'e ver.

---

## MASTER PROMPT

Sen kıdemli bir TypeScript/Node.js backend ve automation mühendisisin.

Bu görevde benden ek onay istemeden, production'a yakın kalitede çalışan bir GitHub repository oluşturacaksın.

Proje adı:

```text
morning-brief-bot
```

Ana hedef:

Her gün **Europe/Istanbul timezone'a göre saat 08:00'de** otomatik çalışan, teknoloji RSS kaynaklarını, İstanbul hava durumunu, günlük USD/TRY ve EUR/TRY referans kurlarını ve seçili Reddit topluluklarını toplayan; teknoloji ve Reddit içeriğini OpenAI API ile kısa, doğal Türkçe bir sabah briefing'ine dönüştüren ve sonucu Telegram botu üzerinden bana gönderen bir otomasyon geliştir.

Bu proje bir web uygulaması değildir.

Frontend yazma.

Database kullanma.

Docker ancak gerçekten gerekli ise kullan; bu proje için varsayılan olarak Docker ekleme.

Ağır framework kullanma.

Telegram için Telegraf gibi bir framework ancak zorunluysa kullan; yalnızca outbound mesaj göndermek için doğrudan Telegram Bot API HTTP çağrısını tercih et.

Teknoloji seçimi:

- Node.js 24 LTS
- TypeScript
- npm
- OpenAI official JavaScript SDK
- OpenAI Responses API
- OpenAI Structured Outputs
- Zod
- rss-parser
- native Node.js fetch
- Vitest
- ESLint
- Prettier
- GitHub Actions

OpenAI default model:

```text
gpt-5.6-luna
```

Model env/config ile değiştirilebilir olsun.

## Değişmez fonksiyonel gereksinimler

Uygulama her çalıştığında şu pipeline'ı izlesin:

1. Environment configuration'ı doğrula.
2. İstanbul için güncel hava verisini çek.
3. Günlük USD/TRY ve EUR/TRY referans kurlarını çek.
4. 3 teknoloji RSS/Atom kaynağını çek.
5. 3 Reddit subreddit hot RSS kaynağını çek.
6. RSS ve Reddit item'lerini normalize et.
7. Duplicate item'leri kaldır.
8. Yeni ve anlamlı item'leri seç.
9. AI input'unu kontrollü biçimde oluştur.
10. OpenAI Responses API + Structured Outputs ile Türkçe özet oluştur.
11. AI tarafından dönen item ID'lerini source map'e karşı doğrula.
12. Telegram HTML raporunu render et.
13. Telegram limitini aşarsa section sınırlarından güvenli biçimde parçala.
14. Dry-run değilse Telegram'a gönder.
15. Kritik olmayan bir veri kaynağı başarısızsa partial report göndermeye devam et.
16. OpenAI başarısızsa fallback report üret ve yine Telegram'a gönder.
17. Telegram gönderimi başarısızsa process'i error ile bitir.

## Varsayılan teknoloji RSS kaynakları

Config içinde:

```text
TechCrunch
https://techcrunch.com/feed/

Ars Technica
https://arstechnica.com/feed/

GitHub Changelog
https://github.blog/changelog/feed/
```

Her source için:

```ts
type RssSource = {
  id: string;
  name: string;
  url: string;
  maxItems: number;
};
```

Default `maxItems = 4`.

Son 36 saat içindeki item'leri önceliklendir.

36 saat içinde veri yoksa en yeni mevcut item'lerden makul sayıda kullan; raporu tamamen boş bırakma.

Feed'lerin tarihi farklı formatta olabilir.

Invalid date yüzünden process crash etmesin.

RSS item normalization sonucu yaklaşık şu type olsun:

```ts
type SourceItem = {
  id: string;
  kind: "tech" | "reddit";
  sourceId: string;
  sourceName: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string | null;
};
```

RSS HTML description/content alanlarını temizle.

Tam makale scraping yapma.

Paywall bypass etme.

AI'a maksimum 1500 karakter description gönder.

Bir feed fetch veya parse hatası verirse logla ve diğer source'larla devam et.

## Reddit kaynakları

Varsayılan:

```text
r/programming
r/technology
r/selfhosted
```

URL:

```text
https://www.reddit.com/r/programming/hot.rss?limit=5
https://www.reddit.com/r/technology/hot.rss?limit=5
https://www.reddit.com/r/selfhosted/hot.rss?limit=5
```

Her request'te açıklayıcı User-Agent kullan:

```text
MorningBriefBot/1.0
```

Toplam AI Reddit item sayısını 9 ile sınırla.

Aynı URL veya normalize edilmiş aynı title duplicate ise bir kez kullan.

Reddit tamamen başarısızsa raporun ilgili bölümünde:

```text
Bugün Reddit kaynaklarından yeterli veri alınamadı.
```

yaz.

Reddit hatası weather, FX, tech veya Telegram gönderimini durdurmasın.

## Weather

Open-Meteo Forecast API kullan.

Location config:

```ts
{
  name: "İstanbul",
  latitude: 41.0082,
  longitude: 28.9784,
  timezone: "Europe/Istanbul"
}
```

Current fields:

```text
temperature_2m
apparent_temperature
weather_code
wind_speed_10m
```

Daily fields:

```text
temperature_2m_max
temperature_2m_min
precipitation_probability_max
```

`forecast_days=1`.

Timezone `Europe/Istanbul`.

Response'u Zod ile validate et.

Weather code'u Türkçe kısa açıklamaya dönüştüren helper yaz.

Bilinmeyen kodda safe fallback kullan.

Hava section'ı kısa olsun.

Deterministic weather tip:

- precipitationProbability >= 50 → `Şemsiye almak mantıklı.`
- maxTemperature >= 32 → `Öğle saatlerinde sıcaklığa dikkat.`
- windSpeed >= 35 → `Kuvvetli rüzgâra dikkat.`
- minTemperature <= 5 → `Sabah için kalın giyinmek iyi olabilir.`

Birden fazla koşul varsa en önemli bir tanesini göster.

Weather başarısızsa:

```text
🌤 İstanbul
Hava verisi şu anda alınamadı.
```

kullan.

AI hava değerlerini üretmesin.

## Döviz

Frankfurter **v2** API kullan.

Bunu canlı/intraday market data gibi sunma.

Section adı:

```text
💱 Günlük referans kurlar
```

Çağrılar:

```text
https://api.frankfurter.dev/v2/rates?base=USD&quotes=TRY
https://api.frankfurter.dev/v2/rates?base=EUR&quotes=TRY
```

Frankfurter v2 response schema'sını Zod ile doğrula.

Eski v1 JSON shape'ını varsayma.

USD/TRY ve EUR/TRY değerlerini 2-4 decimal arasında okunabilir biçimde formatla; Türkçe locale kullan.

Source date'i göster.

İki response date farklıysa log warning yaz ve Telegram'da en eski/yeni değerleri yanlış tek tarih altında birleştirme. Her rate yanında kendi date'i gösterebilir veya güvenli bir ortak açıklama üret.

FX başarısızsa:

```text
💱 Günlük referans kurlar
Kur verisi şu anda alınamadı.
```

kullan.

AI döviz kuru üretmesin.

## OpenAI

Resmi `openai` npm package kullan.

Responses API kullan.

Structured Outputs kullan.

Şu official pattern'i temel al:

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const response = await openai.responses.parse({
  model,
  input: [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: briefingInput,
    },
  ],
  text: {
    format: zodTextFormat(MorningDigestSchema, "morning_digest"),
  },
});

const digest = response.output_parsed;
```

Root schema object olsun.

Schema:

```ts
const HighlightSchema = z.object({
  itemId: z.string(),
  summary: z.string(),
  importance: z.enum(["high", "medium"]),
});

const RedditHighlightSchema = z.object({
  itemId: z.string(),
  summary: z.string(),
});

const MorningDigestSchema = z.object({
  technologySummary: z.string(),
  techHighlights: z.array(HighlightSchema),
  redditSummary: z.string(),
  redditHighlights: z.array(RedditHighlightSchema),
  dailyTakeaway: z.string(),
});
```

Structured output schema field'lerini gereksiz `.optional()` yapma.

System instruction tam olarak bu davranışı taşısın:

```text
Sen Türkçe günlük teknoloji briefing editörüsün.

Görevin yalnızca sana verilen kaynak kayıtlarını özetlemektir.

Kurallar:
- Kaynakta olmayan hiçbir ayrıntıyı ekleme.
- URL üretme veya düzeltmeye çalışma.
- Hava, döviz, tarih veya fiyat üretme.
- Spekülasyonu gerçek gibi yazma.
- Kaynak metni belirsizse belirsizliği koru.
- Reklam dili kullanma.
- Abartılı clickbait dili kullanma.
- Türkçe doğal ve kısa yaz.
- Aynı gelişmeyi tekrar eden kayıtları tek temada birleştir.
- technologySummary 3-4 kısa cümle olsun.
- techHighlights en fazla 4 kayıt seçsin.
- Her tech highlight summary 1 kısa cümle olsun.
- redditSummary 3-4 kısa cümle olsun.
- redditHighlights en fazla 3 kayıt seçsin.
- Her Reddit highlight summary 1 kısa cümle olsun.
- dailyTakeaway 1-2 kısa cümle olsun.
- Sadece input içindeki itemId değerlerini döndür.
- Bir itemId uydurma.
- Önceliği yeni, anlamlı ve teknoloji açısından etkili gelişmelere ver.
```

AI input plain text yapısı:

```text
TECH ITEMS

[tech-001]
Source: TechCrunch
Title: ...
PublishedAt: ...
Description: ...

REDDIT ITEMS

[reddit-001]
Source: r/programming
Title: ...
PublishedAt: ...
Description: ...
```

Input item ID'leri uygulama tarafından oluşturulsun.

AI response geldikten sonra her `itemId` input item map'e karşı doğrulansın.

AI'ın uydurduğu ID varsa drop et.

URL ve source adı AI response'tan alınmasın.

Uygulamanın kendi `SourceItem` map'inden resolve et.

AI çağrısına retry stratejisi uygula ama sonsuz retry yapma.

OpenAI key'i loglama.

Prompt'a veya logger'a environment dump basma.

## OpenAI fallback

OpenAI çağrısı başarısızsa ve diğer veriler mevcutsa bot tamamen susmasın.

Fallback:

```text
ℹ️ AI özeti bugün oluşturulamadı; kaynak başlıkları gösteriliyor.
```

notu ekle.

Sonra:

- en yeni 5 tech title + source + URL
- en fazla 3 Reddit title + subreddit + URL

göster.

Weather ve FX normal gösterilsin.

Fallback report da Telegram'a gönderilsin.

## Telegram

Telegram Bot API'ye native fetch ile request at.

Endpoint:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage
```

POST JSON kullan.

Request body yaklaşık:

```ts
{
  chat_id: chatId,
  text,
  parse_mode: "HTML",
  link_preview_options: {
    is_disabled: true
  }
}
```

Bot API'nin güncel payload beklentisine göre type'ları doğru uygula.

HTTP status kontrolü yap.

JSON response'ta `ok === true` kontrolü yap.

Telegram error description'ı secret içermeyecek şekilde logla.

Telegram text content limitini dikkate al.

Render hedefi 3900 karakter soft limit olsun.

Section bazlı chunking yap.

HTML tag ortasında cut yapma.

Tek bir section 3900 karakteri aşarsa güvenli paragraph/list boundary'den böl.

HTML escape helper merkezi olsun.

Escape etmeden RSS title, Reddit title, source text veya AI summary'yi Telegram HTML içine koyma.

URL'ler allowlist gerektirmiyor fakat valid `http:` veya `https:` URL olduklarını doğrula.

Invalid URL için link yerine sadece text göster.

Bot token hiçbir URL log'unda görünmesin.

## Telegram setup command

`src/setup-telegram.ts` yaz.

`npm run setup:telegram` ile çalışsın.

Davranış:

- `.env` yükle.
- `TELEGRAM_BOT_TOKEN` yoksa anlaşılır hata ver.
- Token'ı yazdırma.
- Kullanıcıya bota `/start` göndermesini söyle.
- `getUpdates` çağır.
- Update'lerden unique chat'leri çıkar.
- chat id, type, username ve display name/title göster.
- Hiç update yoksa uygulanacak adımları Türkçe yaz.
- Process token'ı hiçbir log'a koymasın.

## Telegram message tasarımı

Türkçe.

Kısa.

Dikkat dağıtıcı olmayan.

Emoji sayısı section başına yaklaşık bir tane.

Format:

```text
☀️ Günaydın, broski

📅 13 Temmuz 2026 Pazartesi

🌤 İstanbul
...

💱 Günlük referans kurlar
...

📰 Teknoloji özeti
3-4 kısa cümle.

Öne çıkanlar:
• Başlık — kısa özet
  Source · Kaynağı aç

🔥 Reddit radarı
3-4 kısa cümle.

• r/programming — kısa özet
  Konuyu aç

🧠 Bugünün ana fikri
1-2 kısa cümle.
```

Tarihi Europe/Istanbul timezone'a göre Türkçe formatla.

Hardcoded örnek tarihi kullanma.

"broski" hitabı config constant olabilir.

## Network reliability

Merkezi `fetchWithRetry` helper yaz.

Default:

```text
timeout = 12_000 ms
maxAttempts = 3
```

Retry:

- network error
- timeout
- 429
- 500
- 502
- 503
- 504

Normalde retry yapma:

- 400
- 401
- 403
- 404

Exponential backoff + jitter:

yaklaşık 500 ms, 1000 ms, 2000 ms.

`Retry-After` header mevcutsa makul biçimde dikkate al.

Infinite wait yapma.

RSS/Reddit source toplamada partial success kullan.

Tek source hatası bütün raporu iptal etmesin.

## Logging

Basit, okunabilir structured logger yaz veya küçük bir logger utility kullan.

Log event örnekleri:

```text
weather.fetch.start
weather.fetch.success
fx.fetch.success
rss.source.failed
reddit.source.success
openai.summary.success
openai.summary.fallback
telegram.send.success
telegram.send.failed
```

Loglarda:

- token yok
- API key yok
- raw env yok
- aşırı uzun RSS content yok

Final log:

```text
Morning brief completed
```

Dry run ise:

```text
Morning brief dry-run completed
```

## Environment validation

Zod kullan.

Normal send mode required:

```text
OPENAI_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Ancak OpenAI key yoksa fallback mode'a izin verecek şekilde tasarımı mantıklı kurabilirsin. Normal production setup README'de OpenAI key required olarak anlatılsın.

Dry run:

Telegram token/chat id olmadan final render görülebilsin.

Optional:

```text
OPENAI_MODEL
LOG_LEVEL
DRY_RUN
```

Default:

```text
OPENAI_MODEL=gpt-5.6-luna
LOG_LEVEL=info
DRY_RUN=false
```

`.env.example` üret.

`.env` gitignore olsun.

## Project structure

Yaklaşık:

```text
.github/workflows/morning-brief.yml
src/config/env.ts
src/config/sources.ts
src/domain/types.ts
src/domain/schemas.ts
src/services/rss.service.ts
src/services/reddit.service.ts
src/services/weather.service.ts
src/services/fx.service.ts
src/services/openai.service.ts
src/services/telegram.service.ts
src/utils/fetch-with-retry.ts
src/utils/html.ts
src/utils/normalize.ts
src/utils/date.ts
src/utils/logger.ts
src/utils/weather-code.ts
src/report/build-report.ts
src/report/fallback-report.ts
src/report/render-telegram.ts
src/setup-telegram.ts
src/index.ts
tests/...
.env.example
.gitignore
eslint.config.js
package.json
package-lock.json
prettier.config.js
tsconfig.json
README.md
```

Mantıklı refactor gerekirse küçük değişiklik yapabilirsin.

Ama bütün kodu tek dosyada toplama.

## npm scripts

En az:

```text
npm run dev
npm run send
npm run dry-run
npm run setup:telegram
npm run typecheck
npm run test
npm run lint
npm run format
npm run check
```

`npm run check`:

```text
typecheck + lint + tests
```

çalıştırsın.

## Tests

Vitest kullan.

En az şu testleri yaz:

1. title normalization/deduplication
2. HTML escaping
3. weather code fallback
4. Telegram chunk limit
5. Telegram chunking section boundary
6. FX v2 schema parsing
7. USD/TRY ile EUR/TRY mapping
8. AI unknown itemId filtering
9. date formatting Europe/Istanbul
10. fallback report creation

Testlerde gerçek OpenAI veya Telegram API çağrısı yapma.

Service boundaries test edilebilir olsun.

## GitHub Actions

Workflow:

```yaml
name: Morning Brief

on:
  workflow_dispatch:
  schedule:
    - cron: "0 8 * * *"
      timezone: "Europe/Istanbul"

permissions:
  contents: read

concurrency:
  group: morning-brief
  cancel-in-progress: false

jobs:
  send:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      - run: npm run typecheck

      - run: npm test

      - run: npm run send
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ vars.TELEGRAM_CHAT_ID }}
          OPENAI_MODEL: ${{ vars.OPENAI_MODEL }}
```

Kullandığın tooling için lint de scheduled job'a mantıklıysa ekleyebilirsin.

Workflow'a gereksiz write permissions verme.

README'de GitHub Actions schedule'ın best-effort olduğunu ve yoğunlukta gecikebileceğini açıkla.

Ayrıca `08:07` alternatifi için:

```text
7 8 * * *
```

örneğini yaz.

## README

README Türkçe olsun.

Şunları eksiksiz anlat:

- proje ne yapar
- mimari
- veri kaynakları
- AI'nin neyi özetlediği
- Frankfurter'ın günlük referans kur olduğu
- Node.js 24 gereksinimi
- local setup
- BotFather ile bot oluşturma
- `.env` oluşturma
- `/start` gönderme
- `npm run setup:telegram`
- OpenAI API key oluşturma
- `npm run check`
- `npm run dry-run`
- `npm run send`
- GitHub repository secrets
- GitHub repository variables
- Actions manuel run
- schedule ve timezone
- GitHub schedule gecikme notu
- source config değiştirme
- subreddit değiştirme
- RSS feed değiştirme
- model değiştirme
- common errors/troubleshooting

Troubleshooting en az:

```text
Telegram 401
Telegram chat not found
No Telegram updates found
OpenAI authentication error
OpenAI rate limit
RSS source failed
Reddit RSS failed
Weather data unavailable
FX data unavailable
GitHub Actions schedule did not run exactly at 08:00
```

Her biri için kısa çözüm yaz.

## Security

- Secret hardcode etme.
- `.env` commit etme.
- API key veya token loglama.
- Error object'i düşünmeden full serialize etme.
- Telegram endpoint URL'sini token ile beraber loglama.
- RSS içeriğini trusted HTML kabul etme.
- AI output'unu trusted HTML kabul etme.
- Linkleri uygulama source item map'inden al.
- Minimum GitHub Actions permissions kullan.

## Code quality

- TypeScript strict mode.
- `any` kullanma; gerçekten kaçınılmazsa gerekçeli ve lokal tut.
- Fonksiyonları küçük tut.
- Service boundary oluştur.
- Side effect'leri izole et.
- Zod ile external API payload validation yap.
- Meaningful names kullan.
- Türkçe kullanıcı mesajları doğal olsun.
- Kod içi teknik isimler İngilizce olabilir.
- TODO bırakma.
- Placeholder implementation bırakma.
- Fake success yazma.
- Mock data'yı production path'te kullanma.

## Uygulama bitirme davranışın

Benden ek onay isteme.

Önce repository dosyalarını oluştur.

Sonra dependencies yükle.

Sonra:

```bash
npm run check
```

çalıştır.

Hata varsa düzelt.

Tekrar çalıştır.

Check tamamen yeşil olana kadar makul biçimde düzeltmeye devam et.

Sonra:

```bash
npm run dry-run
```

çalıştır.

Network/API key olmadığı için dry-run'ın bazı dış servisleri çağırması mümkün değilse bunu dürüstçe belirt, fakat local deterministic testleri tamamla.

Final cevabında bana şunları ver:

1. Ne oluşturduğun.
2. Proje dosya ağacının kısa özeti.
3. Çalıştırdığın doğrulamalar ve sonuçları.
4. Benim oluşturup eklemem gereken exact secrets/variables listesi.
5. Telegram bot kurulumu için exact adımlar.
6. Local çalıştırmak için exact komutlar.
7. GitHub Actions'ı manuel test etmek için exact adımlar.
8. Bilinen tek önemli caveat: GitHub scheduled workflow tam dakika garantisi vermez.

Projenin amacı "vibe coding demosu" değil.

Çalışan, okunabilir, hata toleranslı ve gerçekten kullanılabilir bir sabah briefing otomasyonu üret.

Şimdi projeyi baştan sona uygula.

---

## MASTER PROMPT BİTİŞİ

