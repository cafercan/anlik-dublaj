# Değişiklik Günlüğü

Bu projedeki önemli değişiklikler burada listelenir. Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/) esas alınarak hazırlanmıştır ve sürümler [Semantic Versioning](https://semver.org/lang/tr/) kurallarına uyar.

## [1.2.0] - 2026-10-18

### Eklendi

- Hedef dil seçimi: Türkçe dışında 19 dile daha çeviri.
- `Alt+Shift+D` klavye kısayolu ile çeviriyi açıp kapatma.
- Sessizlik algılama: video durduğunda veya sessizken API'ye ses gönderilmez, kota harcanmaz.
- Yeni simge ve README ekran görüntüleri.
- İngilizce README (`README.en.md`).
- ESLint, Prettier, birim testleri ve GitHub Actions (CI ve otomatik sürüm yayınlama).

### Değişti

- Ayarlar sayfası kaldırıldı; tüm ayarlar artık popup'ta.

### Kaldırıldı

- Kullanılmayan konuşma hızı ve ses seçimi ayarları.

## [1.1.1] - 2026-10-18

### Güvenlik

- API anahtarı artık web sayfalarında çalışan betiklere gönderilmiyor.
- Sekmeden gelen ayar değişiklikleri ses ve altyazı ayarlarıyla sınırlandı.

## [1.1.0] - 2026-10-18

### Eklendi

- İlk genel sürüm: Gemini Live Translate API ile sekme sesinin gerçek zamanlı Türkçe'ye çevrilmesi.

[1.2.0]: https://github.com/cafercan/anlik-dublaj/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/cafercan/anlik-dublaj/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/cafercan/anlik-dublaj/releases/tag/v1.1.0
