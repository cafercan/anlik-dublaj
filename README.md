# Anlık Dublaj

Tarayıcıda izlediğin videoları **gerçek zamanlı olarak Türkçe dinlemeni** sağlayan bir Chrome eklentisi.

Sekmedeki ses, Google'ın [Gemini Live Translate API](https://ai.google.dev/gemini-api/docs/live-api/live-translate)'sine akıtılır. Gelen Türkçe ses anında çalınır. Orijinal ses arkada kısık olarak duyulmaya devam eder, böylece belgesel dublajı gibi bir deneyim elde edersin.

## Özellikler

- 🎧 **Sesten sese çeviri:** Altyazı gerekmez. Konuşmayı model doğrudan dinler ve Türkçe seslendirir.
- 🌍 **Her sitede çalışır:** YouTube, eğitim platformları ve ses çıkaran her sekmede kullanılabilir.
- 🎚️ **Ayrı ses kontrolü:** Orijinal sesi ve Türkçe sesi bağımsız olarak ayarlayabilirsin.
- 💬 **Canlı altyazı:** Video üzerinde sürüklenebilir bir kutuda orijinal konuşma ve Türkçe çevirisi gösterilir.
- 🔄 **Otomatik yeniden bağlanma:** Uzun videolarda oturum yenilense de çeviri kesintisiz devam eder.

## Kurulum

1. [Releases](../../releases/latest) sayfasından `anlik-dublaj-vX.Y.Z.zip` dosyasını indir ve bir klasöre çıkar.
   > Klasörü sonradan silme veya taşıma. Chrome eklentiyi bu klasörden çalıştırır.
2. Chrome'da `chrome://extensions` adresini aç ve sağ üstten **Geliştirici modu**nu etkinleştir.
3. **Paketlenmemiş öğe yükle** butonuna tıkla. İçinde `manifest.json` bulunan klasörü seç.
4. [Google AI Studio](https://aistudio.google.com/api-keys)'dan bir API anahtarı oluştur.
5. Eklenti simgesine tıkla. Anahtarı yapıştırıp **Kaydet & Doğrula**'ya bas.

## Kullanım

1. Videonun oynadığı sekmeyi aç.
2. Eklenti simgesine tıkla ve çeviri anahtarını aç.
3. Ses seviyelerini popup'tan veya video üzerindeki kutudan ayarla.
4. Kapatmak için anahtarı kapat veya kutudaki ✕ butonuna bas.

## Bilinmesi Gerekenler

- Eklenti `gemini-3.5-live-translate-preview` modelini kullanır. Model önizleme aşamasındadır. Kullanım, kendi API anahtarının kota ve ücretlendirmesine tabidir.
- API anahtarın yalnızca tarayıcında (`chrome.storage.sync`) saklanır. Sadece Google'ın API'sine gönderilir.
- Aynı anda tek bir sekme çevrilebilir.
- Yoğun arka plan müziği veya çok konuşmacılı sahnelerde çeviri kalitesi düşebilir.

## Nasıl Çalışır?

```
Sekme sesi ──tabCapture──▶ Offscreen belge ──16 kHz PCM──▶ Gemini Live API (WebSocket)
                              │                                     │
                              ▼                                     ▼
                   Orijinal ses (kısık)              24 kHz Türkçe ses + transkript
                                                                    │
                                    Hoparlör ◀──────────────────────┤
                                    Video üzerindeki kutu ◀─────────┘
```

| Klasör | Görev |
| --- | --- |
| `popup/` | Açma/kapama, ses ayarları, API anahtarı. Sekme yakalama iznini alır. |
| `background/` | Durum yönetimi. Offscreen belgeyi yönetir ve transkriptleri sekmeye iletir. |
| `offscreen/` | Ses yakalama, PCM dönüştürme, WebSocket akışı ve Türkçe sesin çalınması. |
| `content/` | Video üzerindeki altyazı ve ses kontrol kutusu. |
| `options/` | Ayrıntılı ayarlar sayfası. |

## Lisans

[MIT](LICENSE)

Bu proje Google ile bağlantılı değildir. "Gemini" ve "Google", Google LLC'nin ticari markalarıdır.
