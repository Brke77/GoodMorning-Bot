# Resmî Kaynaklar ve URL Envanteri

Bu dosya, Sabah Özet Telegram Botu'nun tasarımını doğrulamak ve çalışma zamanında veri almak için kullanılan resmî/authoritative bağlantıları tek yerde kaydeder. Son gözden geçirme tarihi: **14 Temmuz 2026**.

“Doğruladığı konu” sütunu bağlantının projedeki hangi kararı veya davranışı desteklediğini açıklar. API endpoint'leri kodun doğrudan çağırdığı adreslerdir; dokümantasyon bağlantıları çalışma zamanı çağrısı değildir.

## OpenAI

| URL                                                                             | Tür                  | Doğruladığı konu                                                                                                                   |
| ------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| <https://developers.openai.com/api/docs/quickstart>                             | Resmî dokümantasyon  | OpenAI API project key ile sunucu tarafı temel kullanım                                                                            |
| <https://github.com/openai/openai-node>                                         | Resmî SDK deposu     | `openai` JavaScript/TypeScript SDK'sı, Responses API istemci kullanımı ve retry/timeout yapılandırması                             |
| <https://developers.openai.com/api/docs/guides/structured-outputs>              | Resmî dokümantasyon  | Structured Outputs ile şemaya bağlı çıktı üretme                                                                                   |
| <https://developers.openai.com/api/docs/models>                                 | Resmî model kataloğu | Güncel model ID'leri ve model seçimi                                                                                               |
| <https://developers.openai.com/api/docs/models/gpt-5.6-luna>                    | Resmî model sayfası  | Varsayılan `gpt-5.6-luna` model ID'si, Responses API ve Structured Outputs desteği; maliyet hassasiyetli/high-volume konumlandırma |
| <https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key> | Resmî yardım         | API key'in nereden oluşturulacağı/bulunacağı                                                                                       |
| <https://developers.openai.com/api/docs/guides/production-best-practices>       | Resmî dokümantasyon  | Anahtar güvenliği ve production kullanım ilkeleri                                                                                  |

## Telegram

| URL                                                                | Tür                     | Doğruladığı konu                                                                                            |
| ------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| <https://core.telegram.org/bots/tutorial>                          | Resmî tutorial          | `@BotFather`, `/newbot`, bot kullanıcı adı ve token edinme akışı                                            |
| <https://core.telegram.org/bots/api>                               | Resmî Bot API referansı | Bot API'nin HTTP tabanlı genel sözleşmesi ve response içindeki `ok` alanı                                   |
| <https://core.telegram.org/bots/api#getupdates>                    | Resmî method referansı  | `npm run setup:telegram` komutunun chat adaylarını bulmak için kullandığı `getUpdates` ve webhook çakışması |
| <https://core.telegram.org/bots/api#sendmessage>                   | Resmî method referansı  | `sendMessage`, 1–4096 karakter sınırı, `parse_mode: HTML` ve mesaj gönderme alanları                        |
| <https://api.telegram.org/bot%3CTELEGRAM_BOT_TOKEN%3E/getUpdates>  | Endpoint şablonu        | Setup komutunun çağrı şekli; gerçek token URL'ye yerleştirilir fakat asla loglanmaz                         |
| <https://api.telegram.org/bot%3CTELEGRAM_BOT_TOKEN%3E/sendMessage> | Endpoint şablonu        | Telegram teslimat çağrısının şekli; gerçek token source veya log içinde tutulmaz                            |

## GitHub Actions

| URL                                                                                  | Tür                        | Doğruladığı konu                                                                                                                              |
| ------------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| <https://docs.github.com/actions/using-workflows/events-that-trigger-workflows>      | Resmî dokümantasyon        | `schedule` ve `workflow_dispatch`, timezone kullanımı, schedule'ın default branch'ten çalışması ve yüksek yükte gecikme/best-effort davranışı |
| <https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions> | Resmî dokümantasyon        | Workflow YAML yapısı, jobs, permissions, concurrency ve timeout alanları                                                                      |
| <https://docs.github.com/actions/security-guides/using-secrets-in-github-actions>    | Resmî dokümantasyon        | `secrets.OPENAI_API_KEY` ve `secrets.TELEGRAM_BOT_TOKEN` kullanımı                                                                            |
| <https://docs.github.com/actions/learn-github-actions/variables>                     | Resmî dokümantasyon        | `vars.TELEGRAM_CHAT_ID` ve `vars.OPENAI_MODEL` repository variables kullanımı                                                                 |
| <https://github.com/actions/checkout>                                                | Resmî GitHub action deposu | `actions/checkout@v6` kullanımı ve read-only checkout ihtiyacı                                                                                |
| <https://github.com/actions/setup-node>                                              | Resmî GitHub action deposu | `actions/setup-node@v6`, Node 24 ve npm cache yapılandırması                                                                                  |

## Hava — Open-Meteo

| URL                                      | Tür                       | Doğruladığı konu                                                                                                          |
| ---------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| <https://open-meteo.com/en/docs>         | Resmî API dokümantasyonu  | Forecast API alanları: current/daily değişkenleri, `forecast_days` ve IANA timezone                                       |
| <https://api.open-meteo.com/v1/forecast> | Çalışma zamanı endpoint'i | İstanbul için sıcaklık, hissedilen sıcaklık, WMO weather code, rüzgâr, min/max ve yağış olasılığı çağrısının taban adresi |

Kod koordinatları `41.0082, 28.9784`, timezone değeri `Europe/Istanbul`dır. Query parametreleri `src/services/weather.service.ts` tarafından URL-encode edilerek eklenir.

## Döviz — Frankfurter v2

| URL                                                        | Tür                            | Doğruladığı konu                                                                                            |
| ---------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| <https://frankfurter.dev/>                                 | Resmî proje/API dokümantasyonu | v2 response yapısı ve merkez bankası kaynaklı günlük referans kur niteliği; verinin canlı/intraday olmadığı |
| <https://api.frankfurter.dev/v2/rates?base=USD&quotes=TRY> | Çalışma zamanı endpoint'i      | USD/TRY günlük referans kuru ve kaynak tarihi                                                               |
| <https://api.frankfurter.dev/v2/rates?base=EUR&quotes=TRY> | Çalışma zamanı endpoint'i      | EUR/TRY günlük referans kuru ve kaynak tarihi                                                               |

İki paritenin tarihi farklı dönerse uygulama yanıltıcı tek bir ortak tarih üretmez; her oran kendi tarihiyle gösterilebilir.

## Reddit

| URL                                                    | Tür                           | Doğruladığı konu                                                                    |
| ------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| <https://www.reddit.com/dev/api/>                      | Resmî API referansı           | Subreddit listing endpoint'leri, `hot` sıralaması ve RSS desteğine ilişkin referans |
| <https://redditinc.com/policies/data-api-terms>        | Resmî politika                | Veri API'si kullanım şartları ve gelecekteki OAuth migration'ın uyum sınırı         |
| <https://www.reddit.com/r/programming/hot.rss?limit=5> | Çalışma zamanı RSS endpoint'i | Varsayılan `r/programming` hot kayıtları                                            |
| <https://www.reddit.com/r/technology/hot.rss?limit=5>  | Çalışma zamanı RSS endpoint'i | Varsayılan `r/technology` hot kayıtları                                             |
| <https://www.reddit.com/r/selfhosted/hot.rss?limit=5>  | Çalışma zamanı RSS endpoint'i | Varsayılan `r/selfhosted` hot kayıtları                                             |

Reddit çağrıları varsayılan `MorningBriefBot/1.0` User-Agent'i ile günde bir kez yapılır. Public RSS erişimi GitHub-hosted runner IP'lerinde farklı davranabilir; kalıcı erişim değişikliğinde yüksek frekanslı polling yerine resmî OAuth Data API migration'ı değerlendirilmelidir.

## Teknoloji RSS/Atom kaynakları

| URL                                   | Tür                         | Doğruladığı konu                            |
| ------------------------------------- | --------------------------- | ------------------------------------------- |
| <https://techcrunch.com/subscribing/> | Yayıncının resmî sayfası    | TechCrunch feed erişimi ve abonelik bilgisi |
| <https://techcrunch.com/feed/>        | Çalışma zamanı feed'i       | Varsayılan TechCrunch teknoloji kayıtları   |
| <https://arstechnica.com/rss-feeds/>  | Yayıncının resmî sayfası    | Ars Technica RSS feed seçenekleri           |
| <https://arstechnica.com/feed/>       | Çalışma zamanı feed'i       | Varsayılan Ars Technica teknoloji kayıtları |
| <https://github.blog/changelog/>      | GitHub'ın resmî changelog'u | GitHub ürün değişikliklerinin kaynağı       |
| <https://github.blog/changelog/feed/> | Çalışma zamanı feed'i       | Varsayılan GitHub Changelog kayıtları       |

Uygulama bu feed'lerdeki title/description metadata'sıyla çalışır; tam makale scraping veya paywall bypass yapmaz.

## Node.js, npm ve kalite araçları

| URL                                              | Tür                             | Doğruladığı konu                                              |
| ------------------------------------------------ | ------------------------------- | ------------------------------------------------------------- |
| <https://nodejs.org/en/about/previous-releases>  | Node.js resmî dokümantasyonu    | Node.js 24 release/LTS hattı ve production için LTS kullanımı |
| <https://nodejs.org/learn/getting-started/fetch> | Node.js resmî dokümantasyonu    | Yerleşik `fetch()` kullanımı                                  |
| <https://docs.npmjs.com/cli/commands/npm-ci>     | npm resmî dokümantasyonu        | Lockfile tabanlı temiz ve tekrarlanabilir `npm ci` kurulumu   |
| <https://www.typescriptlang.org/docs/>           | TypeScript resmî dokümantasyonu | Strict TypeScript derleme ve typecheck temeli                 |
| <https://zod.dev/>                               | Zod resmî dokümantasyonu        | Environment ve dış API payload doğrulaması                    |
| <https://github.com/rbren/rss-parser>            | `rss-parser` kaynak deposu      | RSS/Atom parse davranışı ve paket kullanımı                   |
| <https://vitest.dev/>                            | Vitest resmî dokümantasyonu     | Birim test çalıştırıcısı                                      |
| <https://eslint.org/docs/latest/>                | ESLint resmî dokümantasyonu     | Statik lint kontrolü                                          |
| <https://prettier.io/docs/>                      | Prettier resmî dokümantasyonu   | Kod/doküman biçimlendirme                                     |

## Kaynak kullanımıyla ilgili sınırlar

- URL'ler source code içine secret içermez. Telegram token'ı endpoint şablonuna yalnız çalışma zamanında eklenir ve loglanmaz.
- OpenAI, Telegram, hava ve kur payload'ları güvenilmeden önce uygulama sınırlarında doğrulanır.
- Frankfurter çıktısı “Günlük referans kurlar” başlığıyla ve kaynak tarihiyle sunulur.
- Kaynak dokümantasyonu veya endpoint davranışı değişirse önce ilgili service ve Zod şeması, sonra testler ve bu envanter birlikte güncellenmelidir.
