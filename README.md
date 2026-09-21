# GKTRK AI / Astrum — Kurulum

## 1) Hugging Face Space'i güncelle
`app_SPACEYE_YUKLE.py` dosyasını aç, içeriğini kopyala.
Space'inde (Gokturk97/Astrumdemo) **Files > app.py**'yi düzenle, tüm içeriği bu yeni kodla değiştir, commit et.
Space yeniden başlayacak (1-2 dk sürer). Değişen şey: artık `/gradio_api/call/chat` adında sabit bir API
endpoint'i var, ve model arama/dosya/kod araçlarından hangisini kullandığını da döndürüyor.

## 2) Cloudflare Pages'e deploy et
1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → **Upload assets** (git bağlamadan direkt dosya yükleme)
2. Bu klasördeki **index.html** ve **functions/** klasörünü birlikte yükle (ikisi de aynı kökte olmalı)
3. Deploy et → sana `gktrk-ai.pages.dev` gibi bir adres verecek

Not: `functions/api/chat.js` otomatik olarak `/api/chat` adresinde bir sunucu fonksiyonu olarak çalışır,
ekstra bir ayar gerekmez.

## 3) Test et
Siteyi aç, bir mesaj gönder. İlk mesaj ZeroGPU'nun "uyanması" nedeniyle 10-30 saniye sürebilir, sonrakiler hızlı olur.

## Mimari (özet)
- **Frontend** (index.html): Sohbet arayüzü, model seçici, ayarlar, Agent modu
- **Cloudflare Pages Function** (functions/api/chat.js): Tarayıcı ile HF Space arasında gerçek API proxy'si
- **HF Space** (app.py): Gerçek model (Astrum N1 mini), web arama, dosya oluşturma
- **Sandbox**: Agent modunda model kod yazarsa, Pyodide ile **tarayıcının içinde**, gerçekten çalıştırılır
  (Cloudflare Pages Functions ücretsiz planda rastgele kod çalıştıramaz — bu yüzden sandbox tarayıcı tarafında,
  tamamen ücretsiz ve güvenli şekilde çözüldü)

## Sınırlamalar / bilinmesi gerekenler
- Oturum mesaj limiti (15) sunucu tarafında sabit, frontend sadece gösteriyor
- Model seçicide şu an sadece Astrum N1 mini aktif; N1.1 ve Q1 CodeQ "yakında" olarak görünüyor,
  ileride gerçek olunca `index.html` içindeki `model-opt disabled` satırlarını aktif hale getir
- Gradio'nun REST API formatı sürüm değişikliğiyle küçük farklılıklar gösterebilir; ilk denemede
  `/api/chat` hata dönerse, tarayıcı konsolunda gelen ham hatayı kontrol et
