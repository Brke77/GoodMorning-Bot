# Sabah Özet Telegram Botu

Her sabah İstanbul saatine göre teknoloji haberlerini, İstanbul hava durumunu, günlük USD/TRY ve EUR/TRY referans kurlarını ve seçili Reddit topluluklarını toplayıp kısa bir Türkçe Telegram özeti üretir. Proje bir web uygulaması değildir; frontend, veritabanı ve kalıcı veri saklama katmanı yoktur.

Varsayılan otomasyon saati `Europe/Istanbul` zaman diliminde **08:00**'dir. GitHub Actions planlaması best-effort çalışır; tam dakika garantisi yoktur. Ayrıntılar [GitHub Actions kurulumu](#github-actions-kurulumu) bölümündedir.

## Ne toplar, ne üretir?

| Bölüm                | Kaynak                                                           | Rapordaki anlamı                                                                                        |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| İstanbul hava durumu | Open-Meteo Forecast API                                          | Güncel sıcaklık, hissedilen sıcaklık, günlük min/max, yağış olasılığı, rüzgâr ve kod tabanlı kısa öneri |
| USD/TRY ve EUR/TRY   | Frankfurter v2                                                   | **Günlük referans kur**; canlı veya gün içi piyasa fiyatı değildir ve kaynak tarihiyle gösterilir       |
| Teknoloji            | TechCrunch, Ars Technica ve GitHub Changelog RSS/Atom akışları   | Başlıklar ve feed açıklamaları normalize edilip özetlenir                                               |
| Reddit               | `r/programming`, `r/technology`, `r/selfhosted` hot RSS akışları | Başlıklar ve feed içinde gelen açıklamalar özetlenir                                                    |
| Türkçe özet          | OpenAI Responses API + Structured Outputs                        | Teknoloji/Reddit özeti, seçili öne çıkanlar ve “Bugünün ana fikri”                                      |
| Teslimat             | Telegram Bot API                                                 | HTML olarak, link önizlemeleri kapalı ve gerekirse güvenli parçalara bölünmüş mesajlar                  |

Tüm resmî dokümantasyon ve kullanılan endpoint envanteri [docs/RESMI_KAYNAKLAR.md](docs/RESMI_KAYNAKLAR.md) dosyasındadır.

## Veri ve AI sınırları

AI yalnızca uygulamanın verdiği teknoloji ve Reddit kayıtlarını özetler ve bunlardan kısa bir ana fikir çıkarır. Şunları **üretmez**:

- hava sıcaklığı, hava kodu veya hava önerisinin sayısal girdileri;
- döviz kuru veya kur tarihi;
- rapor tarihi;
- URL ya da kaynak adı;
- kaynakta bulunmayan ayrıntı.

Hava, kur ve tarih kod tarafından deterministik biçimde yazılır. AI yalnızca uygulamanın verdiği `itemId` değerlerini döndürebilir; bilinmeyen veya uydurulmuş ID'ler atılır. Linkler ve kaynak adları AI çıktısından değil uygulamanın kendi kaynak haritasından alınır. RSS, Reddit ve AI metinleri güvenilmeyen girdi kabul edilir, Telegram HTML'ine eklenmeden önce escape edilir.

`OPENAI_API_KEY` yoksa veya OpenAI çağrısı başarısız olursa bot susmaz. Hava ve kur bölümlerini koruyup en yeni en fazla 5 teknoloji ve 3 Reddit başlığını linkleriyle gönderir ve şu notu ekler:

> ℹ️ AI özeti bugün oluşturulamadı; kaynak başlıkları gösteriliyor.

Normal kurulumda `OPENAI_API_KEY` eklenmelidir; anahtarsız çalışma yalnızca bu fallback davranışını sağlar, AI özeti sağlamaz.

Uygulama tam makale scraping yapmaz, paywall aşmaz ve feed açıklamasını AI'a en fazla 1500 karakter olarak verir. Teknoloji içeriklerinde son 36 saat önceliklendirilir; bu aralık boşsa raporun tamamen boş kalmaması için en yeni mevcut kayıtlar kullanılabilir.

## Mimari ve çalışma akışı

Uygulama Node.js 24 LTS, TypeScript, native `fetch`, Zod, `rss-parser` ve resmî OpenAI JavaScript SDK'sı üzerine kuruludur.

```text
src/config/       Environment doğrulama, kaynaklar ve sabitler
src/domain/       Dış veri şemaları ile uygulama tipleri
src/services/     Open-Meteo, Frankfurter, RSS, Reddit, OpenAI ve Telegram sınırları
src/report/       AI/fallback raporu ve güvenli Telegram HTML render işlemleri
src/utils/        Retry, normalizasyon, tarih, HTML, log ve hava kodu yardımcıları
src/app.ts        Veri toplama → özet → render → gönderim orkestrasyonu
src/index.ts      CLI giriş noktası
src/setup-telegram.ts
                  getUpdates ile chat ID keşfi
tests/            Deterministik birim testleri
```

Her çalışmada sırasıyla şunlar olur:

1. Environment değerleri Zod ile doğrulanır.
2. Hava, kurlar, teknoloji feed'leri ve Reddit feed'leri paralel toplanır.
3. Feed kayıtları temizlenir, canonical URL/normalize başlık üzerinden tekrarlar kaldırılır ve tarihe göre sıralanır.
4. Mevcutsa OpenAI Responses API, Zod tabanlı Structured Outputs ile çağrılır.
5. Modelin döndürdüğü item ID'leri kaynak haritasına karşı doğrulanır; OpenAI yoksa veya hata verirse fallback hazırlanır.
6. Telegram HTML'i güvenli biçimde render edilir. 3900 karakterlik soft limit aşılırsa bölüm/blok sınırlarından parçalanır; HTML etiketi ortadan kesilmez.
7. Dry-run modunda parçalar terminale yazılır. Gerçek modda parçalar sırayla Telegram'a gönderilir.

Ağ isteklerinin genel varsayılanı deneme başına 12 saniye timeout ve en fazla 3 denemedir. Ağ hataları, timeout, `429`, `500`, `502`, `503` ve `504` için backoff dizisi yaklaşık 500/1000/2000 ms şeklinde büyür; ancak toplam 3 denemede son denemeden sonra uyku olmadığı için fiilen yalnızca ilk iki retry öncesinde yaklaşık 500 ve 1000 ms bekleme uygulanır. Jitter ve sınırlı `Retry-After` desteği de vardır. Tek bir RSS/Reddit kaynağı, hava veya kur hatası raporun tamamını iptal etmez. Telegram gönderim hatası ise işi başarısız yapar.

## Gereksinimler

- Git
- **Node.js 24 LTS** (`package.json` yalnızca `>=24 <25` kabul eder)
- Node.js ile gelen npm
- Telegram hesabı
- Normal AI özetli kullanım için OpenAI API erişimi ve kullanılabilir bakiye/kota
- GitHub Actions ile otomasyon isteniyorsa bir GitHub deposu

Depoda `.nvmrc` değeri `24` olduğu için `nvm` kullanan sistemlerde:

```bash
nvm install 24
nvm use 24
node --version
```

`node --version` çıktısı `v24...` ile başlamalıdır.

## Yerel kurulum

### 1. Depoyu alın ve bağımlılıkları kurun

GitHub'da deponun **Code → HTTPS** adresini kopyalayın ve aşağıdaki `REPO_URL` yerine koyun:

```bash
git clone REPO_URL morning-brief-bot
cd morning-brief-bot
npm ci
```

Bu klasör zaten bilgisayarınızdaysa yalnızca klasöre girip `npm ci` çalıştırın.

Environment dosyasını oluşturun:

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

### 2. BotFather ile Telegram botunu oluşturun

1. Telegram'da doğrulanmış `@BotFather` hesabını açın.
2. `/newbot` gönderin.
3. Görünen bot adını yazın.
4. BotFather'ın istediği, `bot` ile biten benzersiz kullanıcı adını yazın.
5. BotFather'ın verdiği token'ı kopyalayın; sohbetlerde veya repoda paylaşmayın.
6. `.env` içinde `TELEGRAM_BOT_TOKEN=` satırına token'ı ekleyin.

Örnek yapı (değerleri kendiniz doldurun):

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna

TELEGRAM_BOT_TOKEN=BotFather_token_degeri
TELEGRAM_CHAT_ID=

LOG_LEVEL=info
DRY_RUN=false
REDDIT_USER_AGENT=MorningBriefBot/1.0
```

Token'ı kaynak koda yazmayın. `.env` git tarafından yok sayılır; yine de commit öncesi `git diff --cached` ile kontrol edin.

### 3. Telegram chat ID'yi bulun

1. Telegram'da yeni botun sohbetini açın.
2. Bota `/start` gönderin.
3. Proje klasöründe çalıştırın:

```bash
npm run setup:telegram
```

Komut `getUpdates` ile bulunan sohbet adaylarının chat ID, tür, kullanıcı adı ve görünen adını gösterir; token'ı loglamaz. Kendi sohbetinizin ID'sini `.env` dosyasına ekleyin:

```dotenv
TELEGRAM_CHAT_ID=123456789
```

Grup/süper grup ID'leri negatif olabilir; eksi işaretini koruyun. Hiç aday yoksa önce `/start` mesajının gönderildiğini doğrulayın ve komutu tekrar çalıştırın.

### 4. OpenAI API anahtarını ekleyin

1. OpenAI Platform'da kullandığınız project için bir API key oluşturun.
2. Anahtarın tam değerini güvenli bir parola yöneticisine kaydedin; daha sonra tekrar tam gösterilmeyebilir.
3. `.env` dosyasına ekleyin:

```dotenv
OPENAI_API_KEY=OpenAI_project_api_key_degeri
```

Normal kurulumun AI özeti üretebilmesi için bu değer gerekir. Kod anahtarı zorunlu doğrulama alanı yapmaz: boş bırakılırsa dry-run ve gerçek Telegram gönderimi fallback başlıklarıyla devam edebilir.

Varsayılan model `gpt-5.6-luna`dır. Erişiminiz olan başka uyumlu bir model için:

```dotenv
OPENAI_MODEL=gpt-5.6-luna
```

### 5. Kontrol edin ve çalıştırın

Önce statik kontrolleri ve testleri çalıştırın:

```bash
npm run check
```

Telegram'a göndermeden gerçek kaynakları çekip oluşan HTML parçalarını terminalde görün:

```bash
npm run dry-run
```

Dry-run için Telegram token/chat ID gerekmez. OpenAI anahtarı yoksa fallback görülür. Ağ erişimi olmayan bir ortamda ilgili bölümler “veri alınamadı” mesajıyla üretilebilir.

Gerçek gönderim:

```bash
npm run send
```

Gerçek gönderimde `TELEGRAM_BOT_TOKEN` ve `TELEGRAM_CHAT_ID` zorunludur. `OPENAI_API_KEY` önerilen normal kurulum parçasıdır; yokluğunda gönderim fallback olarak devam eder.

## Environment değişkenleri

| Değişken             | Yerel varsayılan      | Ne zaman gerekli?                               | Açıklama                                                           |
| -------------------- | --------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `OPENAI_API_KEY`     | boş                   | Normal AI özetli kurulumda                      | OpenAI project API key; yoksa fallback                             |
| `OPENAI_MODEL`       | `gpt-5.6-luna`        | İsteğe bağlı                                    | Responses API model ID'si                                          |
| `TELEGRAM_BOT_TOKEN` | boş                   | Gerçek gönderimde ve `setup:telegram` komutunda | BotFather token'ı                                                  |
| `TELEGRAM_CHAT_ID`   | boş                   | Gerçek gönderimde                               | Hedef özel sohbet/grup ID'si                                       |
| `LOG_LEVEL`          | `info`                | İsteğe bağlı                                    | `debug`, `info`, `warn` veya `error`                               |
| `DRY_RUN`            | `false`               | İsteğe bağlı                                    | `true` ise Telegram'a göndermez; CLI `--dry-run` da aynı modu açar |
| `REDDIT_USER_AGENT`  | `MorningBriefBot/1.0` | İsteğe bağlı                                    | Reddit/RSS isteklerinde açıklayıcı User-Agent                      |

Boş `OPENAI_MODEL`, `LOG_LEVEL` ve `REDDIT_USER_AGENT` değerleri uygulama varsayılanına döner. Secret veya tüm environment dump'ı loglanmaz.

## npm komutları

| Komut                    | İşlev                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `npm run dev`            | `src/index.ts --dry-run`; geliştirme amaçlı tek dry-run                                 |
| `npm run dry-run`        | Kaynakları çeker, raporu render eder ve parçaları terminale basar; Telegram'a göndermez |
| `npm run send`           | Raporu üretir ve Telegram'a gönderir                                                    |
| `npm run setup:telegram` | `getUpdates` üzerinden chat ID adaylarını listeler                                      |
| `npm run typecheck`      | TypeScript strict type kontrolü                                                         |
| `npm run lint`           | ESLint kontrolü                                                                         |
| `npm run test`           | Vitest birim testleri                                                                   |
| `npm run check`          | Sırayla typecheck, lint ve test                                                         |
| `npm run format`         | Prettier ile dosyaları yazarak biçimlendirir                                            |
| `npm run format:check`   | Dosya biçimini değiştirmeden Prettier kontrolü yapar                                    |

## Kaynakları ve modeli değiştirme

### RSS ve Reddit kaynakları

`src/config/sources.ts` içindeki `TECH_SOURCES` ve `REDDIT_SOURCES` dizilerini düzenleyin. Her kayıt şu alanları taşır:

```ts
{
  id: "benzersiz-kisa-id",
  name: "Mesajda görünecek ad",
  url: "https://ornek.com/feed.xml",
  maxItems: 4,
}
```

- `id` aynı dizi içinde benzersiz ve kararlı olmalıdır.
- URL doğrudan geçerli RSS/Atom akışına gitmelidir.
- Teknoloji kaynaklarında varsayılan `maxItems` 4'tür.
- Reddit kaynaklarında URL biçimi örneğin `https://www.reddit.com/r/typescript/hot.rss?limit=5` olabilir; `name` değerini `r/typescript` yapın ve `maxItems` değerini 5 veya daha düşük tutun.
- Reddit'ten AI'a giden toplam kayıt sayısı kodda `src/services/reddit.service.ts` içinde 9 ile sınırlıdır.
- Kaynak değişikliklerinden sonra `npm run check` ve `npm run dry-run` çalıştırın.

Varsayılan teknoloji feed'leri TechCrunch, Ars Technica ve GitHub Changelog; varsayılan subreddit'ler `r/programming`, `r/technology` ve `r/selfhosted`dır.

### Model

Yerelde `.env` içindeki `OPENAI_MODEL` değerini değiştirin. GitHub Actions'ta repository variable olan `OPENAI_MODEL` değerini değiştirin. Variable hiç tanımlanmaz veya boş gelirse `src/config/sources.ts` içindeki `DEFAULT_OPENAI_MODEL` (`gpt-5.6-luna`) kullanılır.

Seçtiğiniz model Responses API ve Structured Outputs özelliğini desteklemeli, project hesabınızda erişilebilir olmalıdır.

### İstanbul konumu ve diğer sınırlar

Konum `src/config/sources.ts` içindeki `ISTANBUL_LOCATION` nesnesindedir. Feed boyutu sınırı (`MAX_FEED_BYTES`) ve Telegram soft limiti (`TELEGRAM_SOFT_LIMIT`) aynı dosyadadır. Bu güvenlik sınırlarını yükseltmeden önce Telegram'ın 4096 karakter sınırını ve bellek/ağ etkisini değerlendirin.

## GitHub Actions kurulumu

Workflow [`.github/workflows/morning-brief.yml`](.github/workflows/morning-brief.yml) dosyasındadır. `actions/checkout@v6`, `actions/setup-node@v6`, Node 24 ve npm cache kullanır; sırayla `npm ci`, `npm run check` ve `npm run send` çalıştırır. Yetkisi yalnızca `contents: read`dir ve aynı anda iki sabah işi başlatmamak için `morning-brief` concurrency grubunu kullanır.

### 1. Workflow'u default branch'e gönderin

Scheduled workflow yalnızca workflow dosyası deponun **default branch**'inde bulunduğunda tetiklenir. `.github/workflows/morning-brief.yml` dosyasının `main` veya deponuzda seçili diğer default branch'e push edildiğini doğrulayın.

### 2. Exact secrets ve variables değerlerini ekleyin

Depoda **Settings → Secrets and variables → Actions** sayfasını açın.

**Repository secrets** sekmesine tam olarak şunları ekleyin:

| Secret               | Değer                                                         |
| -------------------- | ------------------------------------------------------------- |
| `OPENAI_API_KEY`     | OpenAI project API key; normal AI özetli kurulum için ekleyin |
| `TELEGRAM_BOT_TOKEN` | BotFather'ın verdiği token                                    |

**Repository variables** sekmesine tam olarak şunları ekleyin:

| Variable           | Değer                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| `TELEGRAM_CHAT_ID` | `npm run setup:telegram` ile bulduğunuz ID                                        |
| `OPENAI_MODEL`     | Önerilen değer `gpt-5.6-luna`; tanımlanmaz/boş gelirse kod varsayılanı kullanılır |

Workflow'un exact mapping'i şöyledir:

```yaml
OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
TELEGRAM_CHAT_ID: ${{ vars.TELEGRAM_CHAT_ID }}
OPENAI_MODEL: ${{ vars.OPENAI_MODEL }}
```

`TELEGRAM_BOT_TOKEN` ve `OPENAI_API_KEY` variable değil secret olmalıdır. `TELEGRAM_CHAT_ID` hassas bir token değildir ve repository variable olarak kullanılır.

### 3. Manuel test yapın

1. GitHub deposunda **Actions** sekmesini açın.
2. Sol listeden **Morning Brief** workflow'unu seçin.
3. **Run workflow** düğmesine basın.
4. Default branch'i seçip ikinci **Run workflow** düğmesiyle başlatın.
5. Çalışan job içindeki `Install dependencies`, `Validate` ve `Send morning brief` adımlarının yeşil olduğunu, Telegram mesajının geldiğini doğrulayın.

### 4. Zamanlama ve 08:07 alternatifi

Varsayılan schedule:

```yaml
schedule:
  - cron: "0 8 * * *"
    timezone: "Europe/Istanbul"
```

Bu, İstanbul yerel saatinde 08:00 hedefidir. GitHub Actions scheduled workflow'ları **best-effort** çalışır; yoğunlukta gecikebilir ve özellikle saat başlarında yük daha yüksek olabilir. Bu nedenle 08:00 tam dakika garantisi yoktur.

Daha düşük saat-başı yoğunluğu için `.github/workflows/morning-brief.yml` içinde yalnızca cron değerini 08:07'ye değiştirebilirsiniz:

```yaml
cron: "7 8 * * *"
```

Workflow dosyası default branch'te kalmalı ve Actions etkin olmalıdır. Değişiklikten sonra önce `workflow_dispatch` ile manuel test yapın.

## Reddit ve GitHub-hosted runner caveat'i

Mevcut uygulama günde bir kez Reddit'in public `hot.rss` listing endpoint'lerini ve açıklayıcı `MorningBriefBot/1.0` User-Agent'ini kullanır. Reddit erişimi IP, ağ politikası, oran sınırı veya ürün/politika değişikliği nedeniyle GitHub-hosted runner üzerinde yerel bilgisayarınızdan farklı davranabilir. Bir Reddit feed'i engellenirse diğer bölümler devam eder; tüm Reddit kaynakları başarısızsa mesajda yeterli veri alınamadığı belirtilir.

RSS erişimi gelecekte kararlı biçimde yetkilendirme gerektirirse doğru migration noktası `src/services/reddit.service.ts`/RSS toplama sınırıdır: Reddit'in resmî OAuth Data API akışına geçin, uygulama kimlik bilgilerini yeni GitHub Secrets olarak saklayın, Reddit Data API Terms'e uyun ve polling sıklığını artırmayın. Bu sürüm OAuth client secret içermez ve public RSS davranışının sonsuza kadar değişmeyeceğini garanti etmez.

## Güvenlik ve işletim notları

- `.env`, bot token'ı veya OpenAI anahtarını commit etmeyin.
- Token içeren Telegram endpoint URL'sini loglamayın veya hata raporuna yapıştırmayın.
- GitHub Actions için yalnızca `contents: read` yetkisi verilir.
- RSS/Reddit/AI metnini HTML olarak güvenilir kabul etmeyin; mevcut merkezi escape katmanını atlamayın.
- Linkleri AI çıktısından almayın; kaynak kayıt haritası üzerinden çözümlemeye devam edin.
- Frankfurter değerlerini “canlı kur” diye sunmayın; bunlar kaynak tarihi olan günlük referans kurlardır.
- `npm run dry-run` gerçek dış servislere istek yapar fakat Telegram'a göndermez.
- Telegram Bot API hatası job'u başarısız yapar; kaynak/API özet hataları mümkün olduğunda partial/fallback rapora dönüşür.

## Sorun giderme — 10 yaygın durum

1. **Telegram 401 / Unauthorized**  
   `TELEGRAM_BOT_TOKEN` yanlış, iptal edilmiş veya başında/sonunda boşluk olabilir. BotFather'dan geçerli token'ı alın; yerelde `.env`, GitHub'da aynı adlı repository secret'ı güncelleyin. Token'ı log veya ekran görüntüsünde paylaşmayın.

2. **Telegram “chat not found”**  
   Bota hedef hesaptan `/start` gönderin, `npm run setup:telegram` ile ID'yi yeniden bulun ve `TELEGRAM_CHAT_ID` değerini aynen kopyalayın. Grup ID'sindeki eksi işaretini koruyun; botun gruba/kanala eklendiğini ve mesaj izni olduğunu doğrulayın.

3. **“Henüz Telegram update'i bulunamadı”**  
   Bot sohbetini açıp `/start` gönderin ve komutu yeniden çalıştırın. Bot için aktif webhook varsa Telegram `getUpdates` ile birlikte çalışmaz; mevcut entegrasyonu değerlendirip webhook'u kaldırmadan önce başka kullanımın etkilenmeyeceğini doğrulayın.

4. **OpenAI authentication error**  
   Anahtarın doğru project'ten üretildiğini, iptal edilmediğini ve `OPENAI_API_KEY` adına boşluksuz yazıldığını kontrol edin. GitHub secret'ı değiştiyse workflow'u yeniden çalıştırın. Anahtar yoksa bot AI yerine fallback başlıklarını gönderebilir.

5. **OpenAI rate limit / quota hatası**  
   Project billing, kullanım limiti ve model erişimini OpenAI Platform'da kontrol edin; gerekirse kotayı artırın veya erişiminiz olan Structured Outputs uyumlu modeli `OPENAI_MODEL` ile seçin. O günkü çağrı başarısızsa fallback mesajı gönderilmesi beklenen davranıştır.

6. **RSS source failed**  
   `src/config/sources.ts` içindeki feed URL'sini tarayıcı/curl ile kontrol edin ve hâlâ RSS/Atom XML döndürdüğünü doğrulayın. Redirect, bozuk XML veya 2 MiB sınırı hataya yol açabilir. URL'yi düzeltip `npm run dry-run` çalıştırın; diğer feed'ler bu sırada devam eder.

7. **Reddit RSS failed**  
   Önce aynı `hot.rss?limit=5` adresini ve `REDDIT_USER_AGENT` değerini kontrol edin. Yalnız GitHub-hosted runner'da oluyorsa IP/rate-limit/politika farkı olasıdır. Kalıcı erişim değişikliğinde yüksek frekanslı retry eklemek yerine resmî OAuth Data API migration'ı planlayın.

8. **Weather data unavailable**  
   Open-Meteo erişimini, `ISTANBUL_LOCATION` koordinatlarını/zaman dilimini ve job ağını kontrol edin. API şeması değişmişse `OpenMeteoResponseSchema` uyarlanmalıdır. Hava bölümü olmadan partial rapor gönderilmesi beklenir.

9. **FX data unavailable**  
   `api.frankfurter.dev/v2/rates` erişimini ve v2'nin array response yapısını kontrol edin; eski v1 response'unu varsaymayın. USD ve EUR çağrılarından biri çalışırsa diğer çift “veri alınamadı” olarak gösterilebilir; iki tarih farklıysa her oran kendi tarihiyle sunulur.

10. **GitHub Actions tam 08:00'de çalışmadı veya schedule hiç görünmedi**  
    Workflow dosyasının default branch'te, Actions'ın etkin ve cron/timezone yazımının doğru olduğunu kontrol edin. Scheduled işler best-effort olduğu için gecikme hata sayılmaz; önce manuel **Run workflow** testi yapın. Saat-başı yoğunluğunu azaltmak için `0 8 * * *` yerine `7 8 * * *` (08:07) kullanabilirsiniz.
