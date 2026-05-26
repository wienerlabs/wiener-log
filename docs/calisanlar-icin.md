# WienerLog: çalışan için 5 dakikalık giriş

> Manuel timesheet / standup yazmayı bıraktık. Sistem **zaten yaptığın
> şeyleri** (commit, PR, Claude Code oturumu) izler ve günün sonunda
> sana "bunları mı yaptın?" diye sorar. Sen yalnızca **evet / düzelt
> / hayır** dersin. Sprint planı, zaman tahmini, weekly stats, retro
> notları otomatik üretilir.

## 30 saniyelik özet

| Önceki dünya | WienerLog ile |
| --- | --- |
| Her sabah 15 dk standup yaz | `wlog daily` → 5-15 hazır öneri |
| Jira'ya / Linear'a manuel task gir | Hiçbir şey girmezsin |
| Sprint sonu retro + timesheet | Veriler zaten içeride |
| "Bu iş 3 saat sürer" gözünden tahmin | Calibration motoru senin geçmişine bakıp ±%30 doğrulukla söyler |
| PR açıklamasını sıfırdan yaz | LLM commit history'den taslak çıkarır |

## Bir günün akışı

### Sabah (2 dakika)

```
$ wlog daily
Proposals for 2026-05-27 (10):
1. abc12345  Refactored auth middleware (3.2h)
2. def67890  Added rate-limiter to /api/login (1.5h)
3. 4f3e2d1c  Investigated SSE memory leak (0.7h)
   ...
```

Her satırı bir bakışta değerlendir:

| Durum | Komut |
| --- | --- |
| Doğru | `wlog ack abc12345` |
| Doğru ama başlık/body düzeltilmeli | `wlog ack def67890 --edit` (sana `$EDITOR` açılır) |
| Yanlış öneri | `wlog ack 4f3e2d1c --reject --reason "izinliydim"` |

`--edit` ve `--reject --reason` çıktıları **kalibrasyon motoruna** geri
beslenir; sistem ertesi haftaya doğru öneriler üretmek için bunlardan
öğrenir.

### Gün içinde (sıfır dakika)

Sen normal işine devam edersin. Sistem arka planda:

- `post-commit` hook'u her commit'i daemon'a iletir.
- `post-merge` hook'u her merge'ü kaydeder.
- `pre-push` hook'u remote'a push'u işaretler.
- Claude Code oturumların `~/.claude/projects/` üzerinden takip edilir.
- Açtığın PR'lar GitHub webhook'undan akar.

Bunların hiçbiri için bir şey yapmana gerek yok.

### Akşam (opsiyonel, 1 dakika)

```
$ wlog stats
Last 30 days, kh0ra:
  Tasks acked:       42
  Tasks edited:      11   (calibration MAPE 23%)
  Tasks rejected:     3
  Acceptance rate:   95%

$ wlog plan --days 5
Upcoming sprint capacity (kh0ra):
  Estimated hours: 31h  (based on 4-week rolling median)
  Buffer:           7h
```

## Ne izleniyor / neler izlenmiyor

| İzleniyor (metadata) | İzlenmiyor (içerik) |
| --- | --- |
| Commit SHA, repo URL, branch, zaman damgası | Kodun **içeriği**, diff, dosya içerikleri |
| PR numarası, başlık, opened/merged sinyali | PR yorumlarının full metni |
| Claude Code oturum ID + süre | Claude Code'a yazdığın sohbet metni |
| `git push` zamanı | Terminal geçmişin, browser history, dotfile'ların |

LLM çağrıları **senin makinende koşmaz**. Hetzner sunucusunda
kurucunun Anthropic + OpenAI key'iyle koşar. Senin faturanı
patlatma riski yok.

Postgres yalnızca read-replica üzerinden senin için açılır. Yani
`wlog ls`, `wlog show`, `wlog daily` çalışır ama task tablosunda
DML yapamazsın. Ack/edit/reject sadece kendi workspace'inin
satırlarını günceller.

## Kurulum

```bash
curl -fsSL https://wlog.wienerlabs.io/install.sh \
  | WLOG_USER=<github-handle> \
    WLOG_EMAIL=<email@wienerlabs.io> \
    WLOG_SERVER=wlog.wienerlabs.io \
    bash
```

Bu script:

1. macOS / Linux algılar
2. `/usr/local/bin/wlog` binary'sini indirir
3. `~/.config/wlog/wlog.toml` yazar
4. macOS'ta launchd unit'i, Linux'ta systemd-user unit'i kurar
5. Daemon'u başlatır
6. `wlog status` ile her şeyin yeşil olduğunu doğrular

Her gözlenmesini istediğin repo'da bir kez:

```bash
cd ~/projeler/falan-repo
wlog hooks install
```

Tam kurulum + uninstall + troubleshooting:
[docs/onboarding.md](./onboarding.md).

## Sık sorulan sorular

**Beni mi izliyor, kodumu mu okuyor?**  
Sadece metadata. Yukarıdaki tabloda hangi alanların shipped edildiği
listelenmiş. Şüphen varsa daemon'u kendi makinende durdur:
```bash
launchctl bootout gui/$(id -u)/io.wienerlabs.wlog-daemon   # macOS
systemctl --user stop wlog-daemon.service                  # Linux
```

**Yanlış öneri gelirse ne olur?**  
`wlog ack <id> --reject --reason "..."` ile reddet. Sistem bu
sinyali kullanır; haftalar geçtikçe öneriler hızla doğrulaşır.

**Editor açtıramıyorum / `wlog ack --edit` neyi açar?**  
`$EDITOR` env var'ına bakar. Set değilse `vim` dener. Kendi tercihin
için `export EDITOR=code -w` (VS Code) ya da `export EDITOR=nano`.

**Yarın izinliyim, daemon'u kapatmalı mıyım?**  
Gerek yok. Hiç commit atmazsan hiç event üretilmez. Yine de
istersen yukarıdaki bootout / stop komutları işine yarar.

**LLM hatası alıyor / `wlog daily` boş geliyor.**  
Bazı sabahlar kurucunun cost ceiling'i tetiklenmiş olabilir
(`circuit breaker`). Bir saat sonra tekrar dene. Israrcıysa
`#wlog` kanalına yaz.

**Verimi sürekli ölçüyor musun?**  
Hayır. Calibration metrikleri (acceptance rate, MAPE) hata payını
küçültmek için var, KPI olarak kullanılmıyor. İnsan-değerlendirmesi
yapılmıyor; sayı sadece sistemin kendini hizalaması içindir.

**Veriyi silmek istiyorum.**  
Şirketten ayrılırken kurucuya yaz, workspace'in tamamen düşürülür
(`docs/control-plane.md > Suspending an employee` referansı).

## Yardım

- Repo: `wienerlabs/wienerlog`
- Slack: `#wlog`
- Hata raporu: GitHub issue + `bug` label

Hoşgeldin.
