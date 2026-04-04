# Panduan Konsultasi Campfire (B2B Outreach Automation)

Dokumen ini berisi struktur pertanyaan komprehensif yang bisa kamu gunakan saat berkonsultasi dengan profesional (*Senior Backend / Fullstack Developer*). Tujuannya agar diskusi tidak melebar dan langsung menyentuh aspek-aspek paling krusial untuk melanjutkan proyekmu.

---

## 1. Konsep & Validasi Arsitektur (Concept & Idea)
*Tujuan: Memastikan apakah fondasi teknologi yang kamu rancang bisa menangani visi produk.*

* **Q1:** "Saat ini kami menggunakan _Next.js (App Router)_ untuk *Frontend* dan merencanakan _FastAPI (Python)_ untuk *Backend AI Engine*. Menurut Anda, apakah pemisahan arsitektur ini adalah pendekatan terbaik untuk aplikasi yang banyak bergantung pada AI API (seperti Claude & Tavily)?"
* **Q2:** "Untuk otomasi email, kami berencana memadukan *Supabase* (database) dengan perangkat self-hosted *n8n* dan *Resend*. Apakah kombinasi ini cukup tangguh untuk menghindari *spam filter* saat melakukan _cold outreach_ B2B berskala besar?"
* **Q3:** "Berdasarkan pengalaman Anda melihat aplikasi sejenis, apa *bottleneck* (hambatan) terbesar yang biasanya membuat aplikasi manajemen *campaign* gagal berfungsi dengan baik?"

## 2. Transisi Frontend (Fase 1) ke Database (Fase 2)
*Tujuan: Menyelesaikan isu yang sedang berjalan dan menghubungkan *UI* dengan *Database*.*

* **Q4:** "UI Fase 1 kami sudah selesai dibangun dengan arsitektur _Anti-Monolith_. Namun, saat menghubungkan ke *Supabase* di Fase 2, kami menyadari manajemen logika *SessionStorage* terdistorsi pada alur halaman _Match_ ke _Craft_. Apa praktik terbaik (_best practice_) untuk mengelola data sementara antarmuka tanpa merusak sistem navigasi lintas _milestone_?"
* **Q5:** "Di aplikasi ini, struktur *Database Supabase* sudah dilampirkan via `.sql`. Bagaimana strategi paling efisien agar Next.js kami bisa membaca/menulis data yang terhubung ke tabel relasional perusahaan (_company_), produk, dan *campaign* (RLS Policy), sambil tetap mempertahankan pemuatan yang cepat?"

## 3. Strategi Backend Python & Web Scraping (Fase 3)
*Tujuan: Membangun "otak intelijen" dari aplikasi.*

* **Q6:** "Kontrak API (`api-contract.md`) kami mengharuskan proses *multi-step* (mengambil data *LinkedIn* via *Proxycurl*, *Scraping website* via *Firecrawl*, lalu diproses oleh *Claude AI*) hanya dalam satu *endpoint*. Jika proses ini digabung memakan waktu lebih dari 5-10 detik, bagaimana strategi FastAPI yang Anda sarankan agar koneksi tidak *timeout* di sisi *Frontend*? (Apakah harus menggunakan arsitektur _Asynchronous/WebSocket/Task Queues_ seperti Celery?)"
* **Q7:** "Untuk mendapatkan skor kecocokan (*Product Match*) antara kebutuhan *client* dan katalog produk kami, apakah disarankan menggunakan perhitungan metrik mandiri di server Python *FastAPI*, atau sepenuhnya menyerahkan instruksi *Prompt Engineering* berbobot skor ke sistem *Claude API*?"

## 4. Automation & Deployment Plan (Strategi & Eksekusi Masa Depan)
*Tujuan: Merencanakan *hosting* dan pengiriman tahap produksi.*

* **Q8:** "Mengingat akan ada *Next.js*, *FastAPI*, *Supabase*, dan *n8n*, bagaimana strategi infrastruktur (*Deployment Plan*) teraman dan terjangkau yang Anda sarankan untuk *Minimum Viable Product* (MVP)? (Misal: Vercel + Railway/Render + Supabase Cloud)."
* **Q9:** "Jika saya menugaskan Anda untuk menyelesaikan integrasi Fase 2 dan membangun pondasi Fase 3 sesuai dengan _API Contract_ yang ada, bagaimana estimasi *Timeline* pekerjaan Anda, dan *milestone* mana yang akan Anda utamakan terlebih dahulu?"
* **Q10:** "Apakah ada *blindspot* (titik lemah atau celah keamanan) dari proyek saya—setelah melihat *Project Audit* dan *Specs*—yang belum saya sadari dan harus segera diperbaiki?"

---
*💡 **Tips Tambahan Saat Konsultasi:** Jangan ragu untuk menunjukkan langsung alur mode Mock (Dummy) kamu berjalan, karena itu bisa memberikan konteks paling instan tentang apa yang kamu inginkan dari fungsionalitas aplikasinya!*
