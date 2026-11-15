# Kur’an Atlası

Kur’an-ı Kerim’in âyetleri arasındaki lafız ve mâna irtibatlarını, kaynaklı
okuma rotalarını, lafız/harf incelemelerini ve mushaf sayfalarını bir araya
getiren statik web uygulaması.

- Sûre ve âyetler arasında etkileşimli irtibat atlası.
- Lafız arama, farklı sayım tercihleri ve ebced incelemesi.
- Kaynaklı İ‘câz okuma rotaları ve Hüsrev hattında tevafuk incelemesi.
- Âyet kartları, karşılaştırma, kâri/hız seçimi ve tilavet kontrolleri.
- Altı arayüz dili, Arapça sağdan sola görünüm ve mobil düzen.
- Tarayıcıda âyet işaretleri ve okuma görünümü tercihleri.

## Yerelde çalıştırma

Python 3 ile hazır statik dosyaları sunabilirsiniz:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory public
```

Tarayıcıda `http://127.0.0.1:8080/?lang=tr` adresini açın.
Veritabanı veya API anahtarı gerekmez. Tilavet kayıtları EveryAyah’tan;
paket dışında kalan bazı mushaf sayfaları ilgili yayıncıdan yüklenir.

Docker örneği:

```sh
docker compose -f compose.example.yaml up -d --wait
```

Bu örnek yerel kullanım içindir. Üretim sunucusuna ait yapılandırmalar,
alan adı/TLS ayarları, yedekler ve işletim notları depoya dahil değildir.

## Kaynak ve derleme

- `src/base.html`: korunmuş içerik ve asıl uygulama.
- `src/atlas-experience.*`: arayüz ve okuma tercihleri.
- `src/atlas-cosmos.js`: Canvas galaksi ve nokta yerleşimi.
- `src/atlas-workbench.*`: çalışma alanları, ikonlar ve ses kontrolleri.
- `src/*copy.json`, `src/palette.json`: arayüz metinleri ve palet.
- `src/vendor/`: yerel font/sprite girdileri ve ilgili lisanslar.
- `public/`: çalıştırılabilir statik site, veri ve lisans dosyaları.
- `deployment/*.py`: taşınabilir statik derleme araçları.

Python 3 ve Node.js kuruluysa:

```sh
python3 deployment/build-experience.py
```

Çıktı `deployment/stage/` altında hazırlanır; `public/` otomatik değiştirilmez.
Derleyici âyet/kaynak veri bloklarının korunduğunu kontrol eder ve içerik
hashli varlıklar ile gzip kopyalarını üretir.

## Kaynaklar ve lisanslar

Veri, meâl, mushaf görüntüleri, font ve diğer üçüncü taraf varlıkların
lisans/atıf koşulları `public/licenses/` ve `src/vendor/` altında korunur.
Bu dosyalardaki kaynak ve kullanım koşullarını inceleyin.
