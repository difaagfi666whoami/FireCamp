# Master QA E2E Testing Plan (Campfire)

Dokumen ini adalah panduan validasi *End-to-End* (E2E) untuk memastikan tidak ada *bug* antarmuka (UI/UX) maupun *bug* penyaluran data (Database). Anda bertindak sebagai Tester B2B independen. Eksekusi ini akan memastikan proyek Anda layak rilis atau *"Production-Ready"*.

> [!IMPORTANT]
> **Prasyarat (Pre-Flight Check):**
> Pastikan 3 komponen ini menyala sempurna sebelum mengklik apa pun:
> 1. `npm run dev` (Frontend/Backend)
> 2. `uvicorn app.main:app` (FastAPI)
> 3. `ngrok http 3000` (Sudah terhubung ke Webhook Resend & Secret `.env.local` sudah tersimpan).

---

## 1. FASE RECON (Eksplorasi)
**Lokal:** `http://localhost:3000/research-library` \
**Misi:** Memvalidasi aliran data Scrape dan UI *loading bar*.

- [ ] Klik **Recon Baru**.
- [ ] Masukkan URL asli perusahaan (cth: `gojek.com` atau `kreasidigital.co.id`).
- [ ] **Test Bug UI:** Ganti *Toggle Mode* antara **Free** dan **Pro**. Pastikan UI tidak pecah dan berikan variasi pemuatan (*loading steps*) yang berbeda.
- [ ] Klik **Generate Profil**.
- [ ] **Validasi:** Hasil identitas perusahaan, Pain Points, dan Berita harus rilis di layar tanpa format *null/undefined*.
- [ ] Klik **Simpan ke Database**.
- [ ] **Test Bug Router:** Web harus me-lempar Anda kembali ke `/research-library` dengan lancar tanpa layar putih (*blank screen*).

## 2. FASE MATCH (Kecocokan)
**Lokal:** `http://localhost:3000/match` \
**Misi:** Memvalidasi pemilihan produk berdasarkan kalkulasi *Match Rate*.

- [ ] Dari Library, pilih Profil perusahaan tadi, dan klik **Mulai Campaign**.
- [ ] **Test Bug UI:** Pindah Tab dari **Matching** ke **Katalog Produk**. Pastikan katalog merender baris PDF atau Layanan manual.
- [ ] Kembali ke tab **Matching**, klik **Run Matching**.
- [ ] **Validasi:** Cek *reasoning* dari persentase skor produk. Pastikan teks Bahasa Indonesianya tidak kacau/melebihi batas kota (*overflow*).
- [ ] Pilih satu Produk pemenang terbesar, klik **Lanjut ke Craft**.

## 3. FASE CRAFT & POLISH (Arsitektur AI)
**Lokal:** `http://localhost:3000/craft` & `/polish` \
**Misi:** Menguji integrasi OpenAI/Gpt-4o FastAPI ke Frontend secara asinkron.

- [ ] Tunggu proses peracikan struktur email.
- [ ] **Validasi Craft:** Tiga (3) sekuens email harus terbit lengkap dengan metode *Challenger Sale*. Klik **Lanjut ke Polish**.
- [ ] **Test Bug Polish (Rewriter):** Buka struktur "Email 1". Ubah pilihan dari *Tone Profesional* menjadi *Storytelling* atau yang lain.
- [ ] Pastikan animasi mutar (*loading*) muncul, dan teks konten berganti gaya bahasanya. *(Jika tombol macet, ini the biggest UI Bug)*.
- [ ] Aktifkan mode `isApproved` (Approve semua email) lalu **Lanjut ke Launch**.

## 4. FASE LAUNCH (Penjadwalan Kritis)
**Lokal:** `http://localhost:3000/launch` \
**Misi:** Membuktikan SQL Trigger `011_auto_initialize_analytics` benar-benar terangsang via UI.

- [ ] Ubah mode pengiriman menjadi **Manual Schedule**.
- [ ] Pada **Email 1** (Hari Ke-1), atur jam peluncurannya ke **1 hingga 2 Menit ke depan** dari jam komputer Anda saat ini.
- [ ] (Abaikan jam peluncuran Email 2 & Email 3).
- [ ] Klik tajam, **Simpan Jadwal & Aktifkan**.
- [ ] Pastikan transisi merotasi Anda langsung ke halaman `Pulse`.

## 5. FASE THE DISPATCHER (Eksekusi Waktu Nyata)
**Terminal Mac:** \
**Misi:** Simulasi Vercel Cron.

- [ ] Tunggu sampai jam Macbook Anda melewati jadwal rill tadi.
- [ ] Buka Terminal baris eksekusi, suntikkan Vercel Cron Dispatcher:
  ```bash
  curl -H "Authorization: Bearer campfire-rahasia-cron-123" http://localhost:3000/api/cron/dispatch
  ```
- [ ] **Validasi Terminal:** Wajib membalas `{"dispatched": 1}`.
- [ ] Kembali ke UI `Pulse`, tekan tombol *Refresh browser*.
- [ ] **Validasi UI:** Angka `Email Dikirim` wajib naik dari 0 menjadi 1. *(Jika 0, berarti trigger 011 SQL semalam gagal berjalan retroaktif)*.

## 6. FASE KEINTIMAN (Real Webhooks Integration)
**Target Mail (Gmail):** \
**Misi:** Membuktikan pertahanan Lapisan Cryptography Svix lewat port (Ngrok).

- [ ] Buka Inbox Gmail milik email tester Anda.
- [ ] **Test Opens:** Klik email tersebut dan baca isi emailnya selama 3 - 5 detik *(memancing Resend 1x1 Pixel Tracker)*.
- [ ] **Test Replies:** Tekan tombol **Reply/Balas** secara sah melalui antarmuka Gmail, masukkan teks "*Ini tawaran menarik. Hubungi asisten saya besok.*", dan kirim!
- [ ] Alihkan pandangan Anda ke tab *Terminal* tempat `npm run dev` berjalan.
- [ ] **Validasi Terminal Webhook:** Tunggu sekitar 5 - 15 detik, Resend Internet harus menghajar *port ngrok* Anda dan Anda harus melihat log Terminal Next.js menari riang menampilkan:
  - `[Webhook/resend] Ok: true, event: email.opened`
  - `[Webhook/inbound] Layer 2 HIT — In-Reply-To:` (Atau Layer 3 HIT).

## 7. FINAL METRICS VALIDATION
**Lokal:** `http://localhost:3000/pulse` \
**Misi:** Bukti bahwa Dasbor telah lepas dari status *Zeroed/Dummy*.

- [ ] Refresh laman Dasbor Anda secara meriah.
- [ ] **Validasi Grafik UI:**
  - `Open Rate`: **100%** (Tampilan hijau melampaui benchmark).
  - `Reply Rate`: Melonjak tajam.
  - Grafik Garis (Line Chart): Harus menggambarkan satu titik node dengan keterangan *Opens: 1*, *Replies: 1* tepat pada tanggal hari ini.

---
> [!TIP]
> **What to do if you find a bug?**
> Jika ada tombol yang tidak bisa ditekan, *blank page*, atau *Terminal server Next.js/FastAPI melempar "Error 500/400"*: Berhenti di langkah tersebut, rekam gejalanya, dan kembali laporkan secara mendetail agar saya perbaiki langsung arsitekturnya.
