import { BookOpen } from "lucide-react"

const PIPELINE_STEPS = [
  {
    step: 1,
    name: "Recon",
    desc: "Masukkan URL perusahaan target. Campfire menganalisis pain point, kontak PIC, berita terkini, dan posisi kompetitor secara otomatis.",
  },
  {
    step: 2,
    name: "Match",
    desc: "Campfire mencocokkan pain point target dengan produk dari katalog kamu. Pilih produk dengan relevansi tertinggi.",
  },
  {
    step: 3,
    name: "Craft",
    desc: "AI menyusun 3 email campaign berdasarkan konteks bisnis target dan produk yang dipilih. Proses memakan waktu 30–60 detik.",
  },
  {
    step: 4,
    name: "Polish",
    desc: "Edit subject dan isi email sesuai kebutuhan. Gunakan tombol 'Salin Email' untuk menyalin ke clipboard.",
  },
  {
    step: 5,
    name: "Launch",
    desc: "Jadwalkan pengiriman email ke PIC target. Cek ulang alamat dan jadwal sebelum mengaktifkan campaign.",
  },
  {
    step: 6,
    name: "Pulse",
    desc: "Pantau open rate, click rate, dan reply rate secara real-time setelah campaign aktif.",
  },
]

const FAQ = [
  {
    q: "Kenapa kontak PIC tidak muncul di hasil Recon?",
    a: "Campfire mencari kontak dari data publik. Jika kontak tidak ditemukan, coba gunakan Pro Mode yang melakukan pencarian lebih dalam. Beberapa perusahaan kecil memang tidak memiliki data kontak publik yang cukup.",
  },
  {
    q: "Berapa lama proses Recon berlangsung?",
    a: "Free Mode selesai dalam 15–30 detik. Pro Mode membutuhkan 45–90 detik karena melakukan analisis lebih mendalam dengan lebih banyak sumber data.",
  },
  {
    q: "Apakah email dikirim langsung atau bisa dijadwalkan?",
    a: "Kamu bisa memilih pengiriman langsung atau menjadwalkan ke tanggal dan jam tertentu di halaman Launch. Semua email dikirim melalui akun email yang terdaftar di Pengaturan.",
  },
  {
    q: "Berapa email yang dikirim per campaign?",
    a: "Setiap campaign menghasilkan 3 email (Email 1, 2, 3) yang ditujukan ke 1 PIC target. Kamu bisa mengedit masing-masing email sebelum pengiriman.",
  },
  {
    q: "Bagaimana cara memulai ulang riset untuk perusahaan yang sama?",
    a: "Buka Research Library, temukan profil perusahaan, lalu klik 'Recon Ulang'. URL akan otomatis terisi dan kamu bisa langsung generate profil baru.",
  },
]

export default function GuidePage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-10 border-b pb-6">
        <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0 mt-0.5">
          <BookOpen className="w-4 h-4 text-brand" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panduan Campfire</h1>
          <p className="text-muted-foreground mt-1 text-[14.5px] font-medium">
            Semua yang perlu kamu tahu untuk mulai.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Section 1 — Apa itu Campfire */}
        <details className="group border border-border/60 rounded-2xl overflow-hidden" open>
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-semibold text-[14.5px] hover:bg-muted/50 transition-colors select-none">
            Apa itu Campfire?
            <span className="text-muted-foreground text-lg transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="px-5 pb-5 space-y-3 text-[14px] text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
            <p>
              Campfire adalah platform outreach B2B yang mengotomatisasi seluruh proses — dari riset
              perusahaan target hingga pengiriman email campaign. Cukup satu URL perusahaan untuk memulai.
            </p>
            <p>
              Campfire dirancang untuk tim sales dan marketing yang ingin menjalankan outreach secara
              terstruktur: riset mendalam, pencocokan produk, email yang dipersonalisasi, dan analytics —
              semua dalam satu pipeline.
            </p>
          </div>
        </details>

        {/* Section 2 — Happy Path */}
        <details className="group border border-border/60 rounded-2xl overflow-hidden" open>
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-semibold text-[14.5px] hover:bg-muted/50 transition-colors select-none">
            Alur Kerja — 6 Langkah
            <span className="text-muted-foreground text-lg transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="px-5 pb-5 border-t border-border/40 pt-4">
            <div className="space-y-4">
              {PIPELINE_STEPS.map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-brand text-white text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div>
                    <p className="font-semibold text-[14px] text-foreground">{s.name}</p>
                    <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        {/* Section 3 — FAQ */}
        <details className="group border border-border/60 rounded-2xl overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-semibold text-[14.5px] hover:bg-muted/50 transition-colors select-none">
            FAQ
            <span className="text-muted-foreground text-lg transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="px-5 pb-5 border-t border-border/40 pt-4">
            <div className="space-y-5">
              {FAQ.map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="font-semibold text-[14px] text-foreground">{item.q}</p>
                  <p className="text-[13.5px] text-muted-foreground leading-relaxed">{item.a}</p>
                  {i < FAQ.length - 1 && <div className="border-b border-border/40 pt-2" />}
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
