// Tone-specific email body variants for Polish stage
// 3 emails × 4 tones = 12 variants

export type ToneType = "profesional" | "friendly" | "direct" | "storytelling"

interface EmailVariant {
  subject: string
  body: string
}

export const toneVariants: Record<ToneType, EmailVariant[]> = {
  profesional: [
    {
      subject: "Bagaimana Kreasi Digital bisa tingkatkan email conversion 3x dalam 60 hari",
      body: "Halo [Nama],\n\nSelamat atas closing Seri B yang luar biasa — Rp 120 miliar adalah pencapaian besar untuk Kreasi Digital.\n\nEkspansi ke Sumatera dan Kalimantan tentunya membutuhkan marketing engine yang scalable. Satu bottleneck yang sering muncul di fase ekspansi adalah efisiensi email campaign — conversion rate yang optimal menjadi krusial ketika volume prospek meningkat.\n\nCampaignAI Pro dari tim kami telah membantu 3 perusahaan e-commerce skala serupa meningkatkan conversion rate rata-rata 2.8x dalam 60 hari pertama, tanpa menambah headcount marketing.\n\nApakah 15 menit minggu ini bisa kita jadwalkan?\n\nSalam,\n[Nama Sales] | Campfire",
    },
    {
      subject: "15 jam per minggu untuk laporan manual — ada cara yang jauh lebih baik",
      body: "Halo [Nama],\n\nIngin memastikan email sebelumnya sampai dengan baik.\n\nSatu hal yang ingin saya highlight: 15+ jam per minggu untuk manual reporting setara dengan 780 jam produktif per tahun — waktu yang bisa sepenuhnya dialihkan ke aktivitas yang menghasilkan revenue langsung.\n\nInsightDash mengotomasi seluruh proses reporting dari semua channel marketing. Setup 2 jam, dan tim tidak perlu menyentuh spreadsheet untuk laporan rutin lagi.\n\nSaya lampirkan case study singkat dari perusahaan e-commerce serupa yang menghemat 12 jam per minggu sejak hari pertama implementasi.\n\nTertarik untuk demo 20 menit?\n\nSalam,\n[Nama Sales] | Campfire",
    },
    {
      subject: "Satu pertanyaan terakhir tentang churn B2B Kreasi Digital",
      body: "Halo [Nama],\n\nSaya tidak ingin mengganggu lebih lama jika timing-nya belum tepat saat ini.\n\nNamun sebelum saya tutup follow-up ini — apakah churn B2B yang naik 18% QoQ sudah ada action plan konkretnya?\n\nRetainIQ memberikan early warning 45-60 hari sebelum pelanggan berisiko churn, cukup waktu untuk intervensi efektif sebelum kontrak berakhir. Untuk bisnis dengan B2B client yang significant, menyelamatkan 2-3 akun per bulan sudah lebih dari cukup untuk cover biaya platform.\n\nJika timing belum tepat, tidak masalah. Boleh saya follow up di Q3 ketika ekspansi regional sudah berjalan?\n\nSalam,\n[Nama Sales] | Campfire",
    },
  ],

  friendly: [
    {
      subject: "Congrats Seri B! Ngobrol soal scaling marketing Kreasi Digital?",
      body: "Hey [Nama]!\n\nBaru baca berita Seri B-nya — serius keren banget, Rp 120 miliar! Ekpansi ke Sumatera dan Kalimantan kedengarannya super exciting.\n\nAku nulis karena tim kami baru bantu beberapa e-commerce di fase ekspansi serupa, dan satu hal yang sering bikin mereka stuck itu email conversion rate. Bayangin kamu bisa 3x conversion tanpa tambah orang — itu yang CampaignAI Pro lakukan untuk mereka dalam 60 hari pertama.\n\nGak ada pressure sama sekali, cuma pengen ngobrol santai 15 menit — siapa tahu ada yang relevan buat roadmap Kreasi Digital.\n\nKapan ada waktu?\n\nSalam hangat,\n[Nama Sales] | Campfire",
    },
    {
      subject: "Masih 15 jam seminggu buat bikin laporan? Kita bisa bantu nih!",
      body: "Hey [Nama],\n\nNgefollow up dari email sebelumnya — semoga kamu baik-baik aja ya!\n\nAku mau share sesuatu yang bikin tim kita excited banget: 15 jam seminggu untuk laporan manual itu setara 780 jam per tahun yang hilang begitu aja. Lumayan banget kalau bisa dipake buat hal yang lebih bermakna kan?\n\nInsightDash bisa otomatis semua itu — setup cuma 2 jam dan laporan dari semua channel langsung kekumpul sendiri. Ada klien kita yang bilang ini \"life-changing\" untuk tim marketing mereka haha.\n\nMau lihat demo singkat 20 menit? Aku bisa flexible sama jadwal kamu kok.\n\nSalam,\n[Nama Sales] | Campfire",
    },
    {
      subject: "Last check-in soal churn B2B — boleh kan? 😊",
      body: "Hey [Nama],\n\nIni email terakhir dari aku, gak mau spam inbox kamu terus!\n\nCuma mau mastiin — soal churn B2B yang naik 18% itu sudah ada plan-nya belum? Karena kalau belum, RetainIQ bisa kasih early warning 45-60 hari sebelum pelanggan mau churn. Jadi ada waktu buat ngobrol dan cari solusi sebelum terlambat.\n\nKalau sekarang belum pas waktunya, totally fine! Boleh aku reconnect pas Q3 waktu ekspansi regionalnya udah jalan?\n\nApapun jawabannya, sukses terus buat Kreasi Digital ya!\n\nWarm regards,\n[Nama Sales] | Campfire",
    },
  ],

  direct: [
    {
      subject: "Email conversion Kreasi Digital 1.2% — ini bisa 3x dalam 60 hari",
      body: "Halo [Nama],\n\nLangsung ke intinya:\n\nEmail conversion rate Kreasi Digital 1.2% — 3x di bawah rata-rata industri 3.5%.\n\nCampaignAI Pro fix masalah ini. Rata-rata 2.8x peningkatan dalam 60 hari. Tidak butuh tambah headcount.\n\n3 perusahaan e-commerce skala serupa sudah buktikan ini.\n\nBisa kita jadwalkan 15 menit minggu ini?\n\n[Nama Sales] | Campfire",
    },
    {
      subject: "780 jam produktif/tahun hilang karena manual reporting — ini solusinya",
      body: "Halo [Nama],\n\n15 jam/minggu manual reporting = 780 jam/tahun terbuang.\n\nInsightDash eliminasi ini sepenuhnya:\n- Setup 2 jam\n- Auto-report dari semua channel\n- Tidak perlu sentuh spreadsheet lagi\n\nKlien e-commerce kami hemat 12 jam/minggu sejak hari pertama.\n\nWant a 20-minute demo?\n\n[Nama Sales] | Campfire",
    },
    {
      subject: "Churn B2B +18% QoQ. Sudah ada action plan?",
      body: "Halo [Nama],\n\nEmail terakhir dari saya.\n\nChurn B2B Kreasi Digital naik 18% QoQ. Ini risiko revenue serius.\n\nRetainIQ: early warning 45-60 hari sebelum churn. Cukup waktu untuk intervensi.\n\nSatu pertanyaan: sudah ada plan konkret untuk ini?\n\nJika belum — 15 menit call, saya tunjukkan caranya.\n\n[Nama Sales] | Campfire",
    },
  ],

  storytelling: [
    {
      subject: "Setelah Seri B, startup ini hampir gagal scale — karena satu bottleneck ini",
      body: "Halo [Nama],\n\nAda cerita menarik yang ingin saya bagikan.\n\nTahun lalu, kami bekerja dengan sebuah e-commerce di Jakarta yang baru saja closing pendanaan besar — mirip dengan Kreasi Digital sekarang. Mereka excited, tim bertambah, ekspansi ke kota baru dimulai.\n\nTapi ada satu masalah yang terus menghantui: email campaign mereka hanya convert di angka 1.1%. Setiap blast ke ribuan prospek, hasilnya mengecewakan. Tim marketing frustrasi. Budget terbuang.\n\nEnam puluh hari setelah mereka implement CampaignAI Pro, conversion rate mereka naik ke 3.2%.\n\nMomennya persis seperti Kreasi Digital sekarang — post-funding, pre-ekspansi — adalah waktu terbaik untuk fix bottleneck ini sebelum volume bertambah.\n\nBoleh kita ngobrol 15 menit?\n\nSalam,\n[Nama Sales] | Campfire",
    },
    {
      subject: "Seorang Head of Marketing bilang ini adalah '780 jam hidupnya yang hilang'",
      body: "Halo [Nama],\n\nSeorang Head of Marketing pernah bercerita kepada saya:\n\n\"Setiap Jumat sore saya dan dua orang tim saya duduk selama 5 jam membuat laporan mingguan dari spreadsheet yang berbeda-beda. Kami melakukan ini selama 3 tahun. Itu 780 jam hidup kami yang hilang — dan kami bahkan tidak tahu apakah laporannya dibaca.\"\n\nDua minggu setelah mereka pakai InsightDash, Jumat sore mereka berubah total. Laporan otomatis terkirim ke inbox semua stakeholder sebelum jam 9 pagi. Tim marketing akhirnya punya waktu untuk strategi.\n\nDi Kreasi Digital dengan 15+ jam manual reporting per minggu — cerita ini terasa familiar?\n\nSaya punya case study lengkapnya. 20 menit demo?\n\nSalam,\n[Nama Sales] | Campfire",
    },
    {
      subject: "B2B churn yang diam-diam menggerogoti — sebelum terlambat",
      body: "Halo [Nama],\n\nIzinkan saya menutup rangkaian email ini dengan sebuah gambaran.\n\nBayangkan: Kreasi Digital berhasil ekspansi ke Sumatera dan Kalimantan. Pelanggan baru masuk. Revenue naik. Semua tampak baik.\n\nTapi di balik layar, 18% B2B client per kuartal diam-diam mempertimbangkan untuk pergi — dan tidak ada yang mendeteksinya sampai mereka benar-benar tidak memperpanjang kontrak.\n\nItulah skenario yang coba dicegah RetainIQ. Bukan dengan menunggu churn terjadi, tapi dengan membaca sinyal 45-60 hari sebelumnya — cukup waktu untuk satu percakapan yang menyelamatkan akun.\n\nJika timing-nya belum tepat, saya mengerti sepenuhnya. Tapi jika ada 15 menit untuk mencegah skenario itu — saya ada.\n\nSalam,\n[Nama Sales] | Campfire",
    },
  ],
}
