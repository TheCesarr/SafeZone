# Görev Listesi: SafeZone (Yerli ve Güvenli Sosyal Hub)

Bu proje, Türkiye'de Discord ve Roblox gibi platformların yasaklanmasının yarattığı boşluğu doldurmayı, genç nüfus için düşük gecikmeli, yasalara uygun bir sesli ve yazılı sohbet uygulaması sunmayı amaçlamaktadır.

## Faz 1: Pazar Uyumu & Araştırma
- [x] Discord/Roblox yasaklarının hukuki sebeplerini (KVKK, içerik denetimi) analiz et.
- [x] "Güvenli Liman" özellik setini belirle (Kimlik doğrulama, yerel sunucular).
- [x] Rakipleri (Teamspeak, Guilded, yerli girişimler) ve TR durumlarını araştır.

## Faz 2: Teknik Mimari (Swift & Unity)
- [x] Sistem Mimarisini Tasarla
    - [x] Gerçek zamanlı iletişim protokolü seçimi (WebRTC vs özel UDP).
    - [x] Yerel barındırmaya uygun Backend seçimi (Python/Go).
- [x] iOS İstemcisi (Swift) MVP Özelliklerini Tanımla
    - [x] Kimlik Doğrulama akışı (Telefon/SMS odaklı).
    - [x] "Squad" (Lobby) oluşturma arayüzü.
    - [x] Ses kanalı UI/UX tasarımı.

## Faz 3: MVP Geliştirme (iOS İstemcisi)
- [x] iOS Projesini Başlat (SwiftUI).
- [x] Temel Kimlik Doğrulama Sistemi (Arayüz Taslağı).
- [x] Ses Kontrollü "Lobi" arayüzünü oluştur.
- [ ] Gerçek Backend'e Bağla.

## Faz 3.5: MVP Backend (Python/FastAPI)
- [x] Python Projesini Başlat (`SafeZone-Server`).
- [x] Temel HTTP Sunucusu Kur (FastAPI).
- [x] WebSocket El Sıkışmasını Uygula (Metin Sohbeti).
- [x] Güvenli Ses için SSL/HTTPS Etkinleştir.
- [x] Dinamik Oda Oluşturmayı Destekle.

## Faz 3.6: PC İstemcisi (Web/React)
- [x] Web Paneli Oluştur (React/Vite).
- [x] "Şifremi Unuttum" özelliği (4 haneli PIN ile)
- [x] Ses Kontrolleri (Sustur, Sağırlaştır)
    - [x] Temel Arayüz Butonları (Yerel Mantık)
    - [x] Durumun diğer kullanıcılarla senkronizasyonu (WebSocket İkonları)
- [x] Kullanıcı Bazlı Ses Kontrolü (Mesh Ağı Düzenlemesi)
    - [x] WebRTC'yi Map<UUID, PeerConnection> kullanacak şekilde düzenle
    - [x] Hedefli Sinyalleşme Uygulaması
    - [x] Kullanıcı Listesine Ses Ayarı Ekleme
- [x] Dinamik Odaları Uygula (Lobi Sistemi).
- [x] Arayüz Cilası (Minimalist Durum & Kullanıcı Sayıları).
- [x] Masaüstü Uygulaması Olarak Paketle (Electron - Windows/Mac).
- [x] Uzaktan Bağlantı Uygula (SSH Tünelleme).
- [x] Küresel Çevrimiçi Sayacı (Lobi + Odalar).

## Faz 4: İş Mantığı & Gelir Modeli
- [ ] Discord Nitro yerine "Premium" model tasarla (Yerel fiyatlandırma).
- [ ] "Ebeveyn Paneli" konseptini taslağa dök (Düzenleyiciler için satış noktası).
- [x] Kullanıcı Kimlik Doğrulama (SQLite ile Giriş/Kayıt) & Otomatik Giriş.
- [ ] Gelişmiş Ses Kontrolleri:
    - [x] Kendini Sustur/Aç (Mikrofon anahtarı).
    - [x] Sağırlaştır/Duy (Gelen tüm sesleri kapat).
    - [x] Uzak Kullanıcı Ses Kontrolü / Susturma (Kişiye özel ses ayarı).
    - [x] Yapay Zeka Gürültü Engelleme (Krisp benzeri).
- [x] Gerçek Zamanlı Ping/Gecikme Göstergesi (Renk + Sayı, örn. "🟢 5ms").
- [x] Son Arayüz/UX Cilası:
    - [x] Modern cam (glassmorphism) tasarım iyileştirmeleri.

## Faz 4.2: Sohbet Kalıcılığı (Persistence) - YENİ
- [x] Özel Mesaj Geçmişini Kaydetme (SQLite).
- [x] Sunucu Odası Sohbet Geçmişini Kaydetme (DB + HTTP Fetch).
- [x] Bağlantı Kesilip Geri Gelince Geçmişi Yükleme.
- [x] Ses Kanalındayken Metin Kanalı Gezme (Dual WebSocket).
- [x] Sunucular Arası Mesaj İzolasyonu (Cross-Server Leak Fix).
- [x] Kanal Yönetimi (Oluştur/Sil/Yeniden Adlandır).
- [x] Ses Aktivitesi Göstergesi (Konuşan Kişiye Yeşil Çerçeve).

## Faz 4.5: Discord-Benzeri Sunucu Yapısı (Kullanıcı İsteği)
- [x] Veritabanı Şeması Güncellemesi (Sunucular & Kanallar)
    - [x] `servers` tablosu (create, join logic).
    - [x] `channels` tablosu (ses kanalları).
    - [x] `server_members` tablosu (üyelik takibi).
- [x] Backend API
    - [x] `/server/create` (Sunucu oluştur).
    - [x] `/server/join` (Davet kodu ile katıl).
    - [x] `/server/list` (Kullanıcının sunucularını listele).
- [x] Frontend UI (App.jsx Refactor)
    - [x] Sol taraf: Sunucu Listesi (Yuvarlak ikonlar).
    - [x] Yan taraf: Kanal Listesi.
    - [x] Sağ taraf: Chat/Görüntü.
- [x] Davet Sistemi (Invite Link mantığı).
- [x] Ayarlar Menüsü:
    - [x] Ses: Giriş/Çıkış Cihazı Seçimi, Gürültü Engelleme Anahtarı.
    - [x] Profil: İsim/Avatar Değiştir (Resim Yükleme özellikli), UI Fixleri (Sidebar Avatar, Upload Button).
    - [x] Uygulama: Tema Renkleri (Açık/Koyu), Dil (TR), Başlangıçta Çalıştır (Placeholder).
- [x] Ekran Paylaşımı (WebRTC Video Akışı).
- [x] Özel Mesajlaşma (Birebir Sohbet).
- [x] Arkadaşlık Sistemi (İstek Gönder/Kabul Et).

## Faz 4.6: Discord Eksikleri Analizi (Gap Analysis)
- [ ] **Rol ve Yetki Sistemi:**
    - [ ] Rol Oluşturma (Admin, Mod, Üye).
    - [ ] Rol Renkleri ve Üye Listesinde Gruplama.
    - [ ] Kanallara Rol Bazlı Erişim (Kilitli Odalar).
- [ ] **Zengin Sohbet Deneyimi:**
    - [x] Dosya Gönderimi (Resim/Dosya Paylaşımı).
    - [x] Mesaj Düzenleme ve Silme.
    - [x] Link Önizlemeleri (Embeds).
    - [x] "Yazıyor..." Göstergesi.
    - [ ] Markdown Desteği (Kullanıcı İsteğiyle Ertelendi).
    - [ ] Emojiler ve Reaksiyonlar (Kullanıcı İsteğiyle Ertelendi).
- [ ] **Gelişmiş UX ve Bildirimler:**
    - [x] Bildirim Sesleri (Katılma/Ayrılma, Mesaj, Etkileşim).
    - [ ] Klavye Kısayolları (Push-to-Talk).
    - [ ] Kullanıcı Durumları (Boşta, Rahatsız Etmeyin).
    - [ ] Profil Kartları (Kullanıcıya tıklayınca detay).

## Faz 4.7: Frontend Refactoring (App.jsx Modülerleşmesi) - TAMAMLANDI
- [x] Bileşenleri Ayırma (Extract Components):
    - [x] Sol Menü: `src/components/ServerSidebar.jsx`.
    - [x] Sohbet Alanı: `src/components/ChatArea.jsx`.
    - [x] Kanal Listesi: `src/components/ChannelList.jsx`.
    - [x] Ses Odası: `src/components/VoiceRoom.jsx`.
    - [x] Kullanıcı & Ses Kontrolleri: `src/components/UserFooter.jsx`.
- [x] Codebase Temizliği (Imports & Unused Code).

## Faz 5: Altyapı & Büyüme (Gelecek)
- [x] Düşük gecikme için Türkiye lokasyonlu VDS Kirala (Rabisu/Keyubu - <10ms ping).
- [x] Backend & Web Sunucusunu VDS'e Taşı.
- [x] Dağıtım İş Akışını Kur (GitHub'a Aktarım Hazırlandı).
- [x] VDS için Kritik Düzeltmeler (Ses Yarış Durumu & Çift Mesaj).
- [ ] Alan Adı (Domain) & SSL (Let's Encrypt) Kurulumu (Production için).
