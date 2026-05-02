# 04 — Demo Script: 7 Menit
> Gunakan ini HANYA setelah pain terkonfirmasi dari bagian 2 dan 3 interview.
> Jangan demo kalau belum ada pain yang jelas — demo terlalu dini = feature dumping.

---

## Persiapan Sebelum Demo (Lakukan sebelum meeting)

**Tab yang harus sudah terbuka:**
- [ ] Campfire login (sudah masuk, sudah di Research Library)
- [ ] Tab baru kosong (untuk input URL nanti)
- [ ] Jika demo produk mereka: sudah ada produk di katalog yang relevan dengan industri mereka

**Yang harus kamu tahu sebelum demo:**
- Nama perusahaan yang akan dipakai untuk demo (idealnya: kompetitor mereka, atau perusahaan besar di industri mereka yang mereka kenal)
- Pain point utama yang mereka ceritakan di bagian interview tadi

**Yang TIDAK boleh terbuka:**
- Tab dengan fitur pricing (jangan terlalu cepat masuk ke harga)
- Mock mode (pastikan `NEXT_PUBLIC_USE_MOCK=false`)

---

## Template Konteks (Fill-in sesuai percakapan mereka)

Sebelum mulai demo, isi mental template ini berdasarkan apa yang mereka ceritakan:

```
Pain yang mereka sebutkan: ___________________________
Contoh spesifik yang mereka berikan: ___________________________
Bottleneck utama mereka: ___________________________
Nama perusahaan target yang mereka sebutkan (jika ada): ___________________________
```

---

## BAGIAN 1: Bridge dari Pain ke Demo (30 detik)

> "Tadi kamu bilang [PAIN YANG MEREKA SEBUTKAN — pakai kata-kata mereka sendiri]. Itu persis masalah yang Campfire dirancang untuk solve. Boleh saya tunjukkan bagaimana cara kerjanya dalam 5-7 menit?"

*Tunggu konfirmasi dulu sebelum lanjut.*

> "Saya akan pakai [NAMA PERUSAHAAN — pilih yang mereka kenal atau relevant dengan industri mereka] sebagai contoh — perusahaan yang kamu familiar, jadi kamu bisa langsung rasakan hasilnya."

**JANGAN:** "Campfire itu bisa melakukan banyak hal, pertama-tama..." — ini adalah awal dari feature dumping.

---

## BAGIAN 2: Recon — Tunjukkan Riset yang Selesai dalam Hitungan Detik (2 menit)

**Setup:** Buka halaman Recon. Input URL perusahaan demo.

> "Ini halaman utama Campfire. Saya input URL perusahaan target..."

*Pilih mode Free untuk demo — lebih cepat, hasilnya tetap representatif.*

> "Saya klik 'Generate'. Sekarang Campfire sedang membaca website mereka, mencari berita terbaru, mencari kontak yang relevan dari LinkedIn — semuanya paralel."

*Sementara loading (8-15 detik), jangan diam — bridge ke pain mereka:*

> "Kalau kamu lakukan ini manual — buka LinkedIn, cari kontak, baca website, cari berita terkini — itu berapa menit? [Biarkan mereka jawab]"

*Saat hasil muncul, zoom out sebentar dan tunjukkan gambaran besar dulu:*

> "Ini hasilnya. [NAMA PERUSAHAAN] sudah dianalisis dari beberapa sudut."

**Sorot 3 hal yang paling relevan dengan pain mereka:**

*Jika pain-nya adalah "tidak tahu mau omong apa":*
> "Lihat bagian Pain Points di sini — ini bukan analisis yang dibuat-buat. Setiap pain point ada sumbernya, bisa diklik. Ini dari [sebutkan sumber dari salah satu pain point yang muncul]."

*Jika pain-nya adalah "tidak tahu siapa yang harus di-contact":*
> "Ini Kontak PIC — Campfire sudah temukan [nama kontak], [jabatan]. Dan di sini ada briefing singkat tentang kenapa orang ini relevan dan bagaimana cara terbaik untuk approach mereka."

*Jika pain-nya adalah "email tidak relevan":*
> "Lihat bagian Executive Insight dan Market Dynamics ini — ini yang nanti akan jadi bahan utama email. Bukan kata-kata generik, tapi konteks spesifik bisnis mereka."

**JANGAN:** Jelaskan semua bagian dari halaman Recon. Pilih 2-3 yang paling relevan dengan pain mereka.

---

## BAGIAN 3: Match + Craft — Dari Pain ke Email (2 menit)

**Setup:** Klik "Lanjut ke Match". Asumsikan katalog produk sudah terisi.

> "Sekarang Campfire akan mencocokkan pain point yang baru ditemukan tadi dengan produk di katalog saya."

*Saat matching berjalan:*

> "Campfire melihat semua pain point [NAMA PERUSAHAAN] dan membandingkannya dengan setiap produk di katalog — bukan keyword matching, tapi AI yang memahami konteks."

*Saat hasil muncul, tunjukkan match score dan reasoning:*

> "Ini hasilnya. [NAMA PRODUK] mendapat score [X]%. Dan lihat reasoning-nya — ini spesifik ke [NAMA PERUSAHAAN], bukan template. AI menjelaskan kenapa produk ini relevan dengan masalah yang tadi ditemukan."

*Pilih produk teratas, klik "Lanjutkan ke Craft":*

> "Sekarang kita generate email campaign-nya. Saya klik Generate."

*Sementara loading (~30 detik):*

> "Campfire sedang menulis 3 email — bukan template, tapi sequence yang menggunakan insight yang tadi kita temukan. Email pertama untuk buka percakapan, email kedua untuk business case, email ketiga untuk push ke komitmen."

*Saat email muncul, baca sebentar email pertama:*

> "Lihat email pertama ini — subject line-nya [baca subject]. Dan opening line-nya langsung masuk ke [insight spesifik dari perusahaan]. Ini bukan email 'Dear Sir/Madam, Kami dari perusahaan X...'"

> "Dan ini semuanya dalam Bahasa Indonesia yang natural."

**JANGAN:** Baca semua 3 email. Tunjukkan 1 email saja — yang paling impressive.

---

## BAGIAN 4: Polish + Launch — Tunjukkan Kontrol di Tangan User (1.5 menit)

**Setup:** Klik "Lanjut ke Polish".

> "Kamu tidak terjebak dengan apa yang AI generate. Di sini kamu bisa edit subject, ubah isi email, dan ganti tone kalau mau. Misalnya kalau target kamu lebih suka komunikasi yang direct..."

*Klik tone "Direct" — tunjukkan bahwa AI rewrite tone-nya:*

> "AI akan rewrite sambil mempertahankan konteks dan argumentasinya — hanya tone-nya yang berubah."

*Klik "Lanjut ke Launch":*

> "Setelah semua email diapprove, di sini kamu set kapan masing-masing email dikirim. Bisa pakai jadwal otomatis yang sudah AI rekomendasikan — Hari 1, Hari 4, Hari 10 — atau atur manual."

> "Setelah aktif, sistem akan kirim otomatis tepat waktu via email kamu sendiri. Tidak perlu ingat untuk klik send."

**JANGAN:** Masuk ke Pulse sekarang kecuali mereka tanya. Pulse lebih relevan untuk percakapan follow-up setelah mereka sudah punya campaign berjalan.

---

## BAGIAN 5: Pertanyaan Penutup Demo (1 menit)

> "Itu gambaran lengkapnya — dari URL perusahaan target sampai email terjadwal, dalam waktu [X menit]. Tadi kamu bilang [PAIN YANG MEREKA SEBUTKAN DI AWAL] — apakah apa yang kamu lihat tadi bisa solve masalah itu?"

*Tunggu jawaban mereka. Jangan langsung fill the silence.*

*Jika mereka bilang "ya" atau positif:*
> "Bagian mana yang paling relevan dengan situasi kamu?"

*Jika mereka bilang "ada beberapa hal yang belum match":*
> "Apa yang masih kurang? Saya ingin tahu dengan jujur."

*Jika mereka bertanya tentang fitur spesifik yang belum ada:*
> Gunakan panduan di [05-objection-handling.md](05-objection-handling.md) untuk respons honest.

---

## Hal yang TIDAK Boleh Dilakukan Saat Demo

| ❌ Jangan | ✅ Sebaiknya |
|---|---|
| Tunjukkan semua 6 tahap pipeline secara berurutan | Pilih 3-4 tahap yang paling relevan dengan pain mereka |
| Jelaskan semua field di halaman Recon | Zoom ke 2-3 field yang paling impressive |
| Demo dengan data dummy yang tidak mereka kenal | Pakai nama perusahaan yang mereka tahu |
| Bicara tentang fitur sebelum tanya konfirmasi pain | Bridge selalu dari pain ke fitur |
| Defensif kalau ada yang tidak berfungsi | "Ini masih early access, thanks for catching that" |
| Terlalu banyak bicara saat loading berjalan | Isi silence dengan pertanyaan tentang mereka |

---

## Troubleshooting Saat Demo

**Recon loading lama (>20 detik):**
> "Kadang tergantung website target — kalau website-nya besar, riset lebih dalam. Biasanya selesai dalam 15-30 detik."

**Kontak yang muncul tidak akurat:**
> "Campfire cari kontak dari Google dan LinkedIn public. Untuk perusahaan yang privacy-conscious, kadang kontak memang lebih sulit ditemukan — itu mengapa ada opsi untuk edit manual."

**Pain point terasa generik:**
> "Untuk perusahaan yang informasinya lebih terbatas online, hasilnya memang bisa lebih umum. Untuk target yang kamu prioritaskan, biasanya ada lebih banyak data — coba kita test dengan [nama perusahaan lain yang lebih relevan untuk mereka]."

**Email yang dihasilkan terasa kurang natural:**
> "Di halaman Polish kamu bisa edit apapun — ini starting point, bukan final draft. Tapi kalau ada pola yang konsisten kurang natural, saya ingin tahu — itu feedback yang berguna."
