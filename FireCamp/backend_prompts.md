# Campfire — Backend Pipeline Quality Improvement Prompts

> **INSTRUKSI PENGGUNAAN:**
> File ini berisi 4 prompt eksekusi untuk meningkatkan kualitas Recon Pipeline.
> Kerjakan **satu prompt per sesi**, verifikasi hasilnya sebelum lanjut ke berikutnya.
> Urutan harus diikuti karena setiap prompt bergantung pada hasil prompt sebelumnya.
>
> **Sebelum memulai:** Baca `architecture.md` dan `specs.md` versi terbaru sebagai referensi.
> **Setelah setiap prompt:** Jalankan `cd backend && python -m pytest` atau minimal `python -c "from app.main import app"` untuk verifikasi tidak ada import error.

---

## PROMPT 1 — Lane A: QueryAngle Taxonomy + Evidence-Preserving Distillation

**Tujuan:** Mengganti query generation yang generik dengan 6-angle taxonomy wajib, memperbaiki Step 3 agar semua query dieksekusi (bukan hanya 1-2), dan memperbaiki distillation chain agar URL citation tidak hilang.

**Baca dulu sebelum mengerjakan:**
- `backend/app/services/lane_a_service.py` — seluruh file
- `backend/app/models/schemas.py` — bagian PainPoint dan CompanyProfile

**Tugas spesifik:**

**1a. Perbaiki `QuerySet` schema di `lane_a_service.py`:**

Ganti schema `QuerySet` yang ada dengan versi baru yang memiliki 6 angle wajib:

```python
class QuerySet(BaseModel):
    reputation_queries: list[str] = Field(
        description="1-2 query untuk reputasi: glassdoor, forum, review pelanggan, keluhan",
        max_length=2,
    )
    tech_stack_queries: list[str] = Field(
        description="1-2 query untuk tech stack: job postings, builtwith, stackshare",
        max_length=2,
    )
    regulatory_queries: list[str] = Field(
        description="1-2 query regulasi dan compliance yang relevan untuk industri perusahaan",
        max_length=2,
    )
    competitive_queries: list[str] = Field(
        description="1-2 query kompetitor: '{company} vs', '{company} alternative', halaman perbandingan",
        max_length=2,
    )
    financial_queries: list[str] = Field(
        description="1-2 query sinyal finansial: funding, revenue, crunchbase, laporan keuangan",
        max_length=2,
    )
    customer_voice_queries: list[str] = Field(
        description="1-2 query suara pelanggan: g2.com, capterra, testimonial, case study",
        max_length=2,
    )
```

**1b. Perbaiki prompt `_step2_generate_queries()`:**

Ganti sistem prompt yang ada dengan prompt yang lebih spesifik dan taktis. Sistem prompt baru harus:
- Menjelaskan bahwa setiap angle adalah **wajib** — bukan opsional
- Menyertakan contoh query konkret per angle agar LLM tidak membuat query generik
- Menyebut nama perusahaan dan domain secara eksplisit dalam instruksi agar query tidak abstrak

Contoh isi sistem prompt baru:
```
Kamu adalah peneliti B2B yang bertugas mengumpulkan sales intelligence untuk tim outbound.
Kamu HARUS membuat query pencarian untuk SEMUA 6 angle berikut — tidak boleh ada yang kosong:

REPUTATION: Cari di glassdoor.com, forum, review — contoh: 'glassdoor "{company}" review', '{company} keluhan masalah'
TECH_STACK: Cari job postings dan tool yang digunakan — contoh: '{company} site:linkedin.com/jobs', '{company} builtwith'
REGULATORY: Cari tekanan regulasi untuk industri mereka — contoh: 'OJK regulasi {industry} 2025', '{company} compliance'
COMPETITIVE: Cari perbandingan dengan kompetitor — contoh: '{company} vs', '{company} alternative', '{company} competitor'
FINANCIAL: Cari sinyal finansial — contoh: '{company} funding', 'site:crunchbase.com {company}', '{company} revenue'
CUSTOMER_VOICE: Cari review pelanggan — contoh: 'site:g2.com {company}', '{company} testimonial case study'

Perusahaan target: {company_name} (domain: {domain})
Gap yang perlu diisi: {gaps_text}
```

**1c. Perbaiki `_step3_parallel_search()` — eksekusi semua 6 angle:**

Saat ini Step 3 hanya mengeksekusi 2 query. Ubah agar semua 6 angle dieksekusi secara paralel:

```python
async def _step3_parallel_search(query_set: QuerySet) -> dict[str, list[dict]]:
    """
    Jalankan semua 6 angle query secara paralel.
    Return dict: angle_name -> list[search_result]
    """
    angle_queries = {
        "reputation":     query_set.reputation_queries[0] if query_set.reputation_queries else "",
        "tech_stack":     query_set.tech_stack_queries[0] if query_set.tech_stack_queries else "",
        "regulatory":     query_set.regulatory_queries[0] if query_set.regulatory_queries else "",
        "competitive":    query_set.competitive_queries[0] if query_set.competitive_queries else "",
        "financial":      query_set.financial_queries[0] if query_set.financial_queries else "",
        "customer_voice": query_set.customer_voice_queries[0] if query_set.customer_voice_queries else "",
    }
    
    # Filter angle yang querynya kosong
    valid_angles = {k: v for k, v in angle_queries.items() if v}
    
    tasks = [
        tavily_service.search(q, search_depth="basic", topic="general", max_results=4)
        for q in valid_angles.values()
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    angle_results: dict[str, list[dict]] = {}
    for angle_name, result in zip(valid_angles.keys(), results):
        if isinstance(result, Exception):
            logger.warning("[lane_a] Step3 angle=%s FAILED: %s", angle_name, result)
            angle_results[angle_name] = []
        else:
            angle_results[angle_name] = result.get("results", [])
    
    return angle_results
```

**1d. Perbaiki `DistilledInsights` — tambahkan `source_url` per fakta:**

Ganti schema `DistilledInsights`:
```python
class EvidenceFact(BaseModel):
    fact: str = Field(description="Fakta atau temuan spesifik")
    url: str = Field(description="URL sumber fakta ini. String kosong jika tidak tersedia.")
    title: str = Field(description="Judul halaman/artikel sumber. String kosong jika tidak tersedia.")

class DistilledInsights(BaseModel):
    evidence_facts: list[EvidenceFact] = Field(
        description="Daftar fakta dengan URL sumber masing-masing. WAJIB sertakan URL jika ada."
    )
    named_entities: list[str] = Field(
        description="Nama-nama penting: orang, perusahaan mitra, produk, investor, tools"
    )
    pain_signals: list[EvidenceFact] = Field(
        description="Sinyal masalah bisnis yang teridentifikasi — dengan URL buktinya"
    )
    summary_paragraph: str = Field(
        description="Paragraf ringkasan 3-5 kalimat dari semua hasil di angle ini"
    )
```

**1e. Perbaiki `_step6_combine()` — sertakan `homepage_content` dan evidence dengan URL:**

Fungsi `_step6_combine()` saat ini menerima `homepage_content` tapi TIDAK menyertakannya dalam output string. Perbaiki agar:
1. `homepage_content` (3000 chars) disertakan sebagai section `--- KONTEN HOMEPAGE ASLI ---`
2. `evidence_facts` dan `pain_signals` disertakan dengan format `[URL: ...] Fakta: ...` agar URL citation tidak hilang
3. Return dua hal: `summary_str` (untuk konteks) dan `evidence_list` (list[dict] berisi fact+url+title — untuk synthesize_profile)

**1f. Update `run_lane_a_advanced()` signature:**

Ubah return type dari `str` menjadi `tuple[str, list[dict]]` — (summary, evidence_list).

Update `recon.py` di `_run_lane_a()` agar menerima tuple dan meneruskan keduanya ke `synthesize_profile()`.

**Verifikasi setelah selesai:**
- `python -c "from app.services.lane_a_service import run_lane_a_advanced"` tidak error
- Log Step3 harus menampilkan `angle=reputation OK`, `angle=tech_stack OK`, dll (6 baris)
- Log Step4 harus menampilkan `evidence_facts` dengan URL yang tidak kosong (untuk hasil yang memang ada URL-nya)

---

## PROMPT 2 — Lane B: Temporal Validation + Tiered Query + Outreach Brief

**Tujuan:** Menghilangkan false positives dari mantan karyawan, menambahkan tiered query strategy, dan mengubah `reasoning` dari 1 kalimat justifikasi menjadi 4-komponen outreach brief.

**Baca dulu sebelum mengerjakan:**
- `backend/app/services/lane_b_service.py` — seluruh file
- `backend/app/services/openai_service.py` — fungsi `score_contacts()`
- `backend/app/models/schemas.py` — class `PicContact`

**Tugas spesifik:**

**2a. Tambahkan fungsi `_has_past_employment_signals()` di `lane_b_service.py`:**

```python
def _has_past_employment_signals(item: dict[str, Any]) -> bool:
    """
    Deteksi apakah kontak ini adalah MANTAN karyawan berdasarkan snippet Google.
    Return True jika ada sinyal past employment → kontak harus di-REJECT.
    
    Pattern yang di-cek:
    - Tahun range dengan dash: "2018–2022", "2019 - 2023", "Jan 2020 - Mar 2023"
    - Kata kunci past tense: formerly, ex-, alumni, previously, "used to"
    - Pola LinkedIn: "... at Company (2019 - Present)" adalah CURRENT — jangan reject
    """
    combined = (item.get("title", "") + " " + item.get("snippet", "")).lower()
    
    # Pattern tahun range yang sudah berakhir: "2018–2022", "2019 - 2021"
    # Cek apakah ada range tahun yang end year-nya bukan "present"
    import re
    year_range = re.findall(r'(20\d{2})\s*[-–]\s*(20\d{2})', combined)
    for start, end in year_range:
        if int(end) < 2024:  # Range yang sudah berakhir sebelum 2024
            return True
    
    # Kata kunci past tense
    past_keywords = [
        "formerly", "ex-", " alumni", "previously at", "used to work",
        "mantan", "sebelumnya di", "dulu di", "pernah di"
    ]
    return any(kw in combined for kw in past_keywords)
```

**2b. Tambahkan `_try_extract_team_page()` — sumber kebenaran current employees:**

```python
async def _try_extract_team_page(url: str) -> list[str]:
    """
    Coba ekstrak nama eksekutif dari halaman /about atau /team perusahaan.
    Return list nama (lowercase) sebagai ground truth untuk validasi.
    Jika gagal, return list kosong — tidak ada fallback berbahaya.
    """
    from app.services import tavily_service
    
    candidate_paths = ["/about", "/team", "/management", "/direksi", "/about-us", "/leadership"]
    base_url = url.rstrip("/")
    
    try_urls = [f"{base_url}{path}" for path in candidate_paths[:3]]
    
    try:
        resp = await tavily_service.extract(try_urls)
        results = resp.get("results", [])
        
        all_names: list[str] = []
        for result in results:
            content = result.get("raw_content", "")[:2000]
            # Ekstrak nama dengan heuristic: baris yang berisi kata seperti "CEO", "Director", "Manager"
            import re
            lines = content.splitlines()
            for line in lines:
                line = line.strip()
                if any(title in line for title in ["CEO", "CTO", "COO", "CMO", "Director", "VP", "Head", "Manager", "Founder"]):
                    # Ambil bagian sebelum jabatan sebagai nama kandidat
                    words = line.split()
                    if 2 <= len(words) <= 5:  # Kemungkinan nama orang
                        all_names.append(line.lower())
        
        return all_names
    except Exception:
        return []
```

**2c. Ubah `search_contacts_serper()` menjadi tiered strategy:**

Ganti satu query tunggal dengan 3 tier query yang dijalankan bertahap:

```python
# Tier 1: C-suite dan Founder — decision makers utama
tier1_query = (
    f'site:linkedin.com/in "{company_name}" '
    '("CEO" OR "CTO" OR "COO" OR "CMO" OR "Founder" OR "President" OR "Chief")'
)

# Tier 2: VP dan Director — influencer dan champion
tier2_query = (
    f'site:linkedin.com/in "{company_name}" '
    '("VP" OR "Vice President" OR "Director" OR "Head of" OR "GM" OR "General Manager")'
)

# Tier 3: Manager dan Lead — hanya digunakan jika Tier 1+2 kurang dari 2 kontak
tier3_query = (
    f'site:linkedin.com/in "{company_name}" '
    '("Manager" OR "Lead" OR "Senior Manager" OR "Senior Lead")'
)
```

Logic:
1. Jalankan Tier 1 dulu
2. Jika hasil valid < 2, tambahkan Tier 2
3. Jika total valid masih < 2, tambahkan Tier 3

**2d. Update alur validasi di `search_contacts_serper()`:**

Urutkan validasi:
1. `_has_past_employment_signals()` → jika True, skip (hard reject, log sebagai "PAST_EMPLOYEE")
2. `_validate_contact_relevance()` yang sudah ada
3. `_build_raw_contact()`

Naikkan batas `prospectScore >= 55` (dari 30) di post-filter.

**2e. Update `score_contacts()` di `openai_service.py` — reasoning 4 komponen:**

Ubah sistem prompt `score_contacts()` agar menghasilkan `reasoning` dalam format 4 komponen:

```python
system_prompt = (
    "Kamu adalah AI yang menilai relevansi kontak B2B untuk tim sales. "
    "Balas HANYA dalam format JSON array. "
    f"Perusahaan target: {company_name or company_context}.\n\n"
    
    "ATURAN VALIDASI KETAT:\n"
    "- Jika kontak TIDAK bekerja di perusahaan target, beri prospectScore = 0.\n"
    "- Hanya kontak yang terbukti CURRENT bekerja di sana boleh score > 0.\n\n"
    
    "Kriteria scoring (0-100):\n"
    "  80-100: C-suite, VP, Founder — budget authority penuh\n"
    "  55-79:  Director, Head of, GM — influencer kuat / champion\n"
    "  0-54:   Manager/Lead tanpa authority jelas, atau tidak relevan\n\n"
    
    "Untuk setiap kontak, tambahkan field 'prospectScore' (integer) dan "
    "'reasoning' (string PERSIS 4 kalimat dengan format berikut — JANGAN kurang dari 4):\n"
    "Kalimat 1 dimulai dengan '[MANDATE]' — apa yang kemungkinan sedang dikerjakan orang ini saat ini berdasarkan jabatannya.\n"
    "Kalimat 2 dimulai dengan '[PAIN OWNERSHIP]' — kategori pain mana yang dia miliki dan kenapa.\n"
    "Kalimat 3 dimulai dengan '[HOOK]' — satu kalimat opening conversation yang tepat dan spesifik.\n"
    "Kalimat 4 dimulai dengan '[RECENCY]' — apakah ada sinyal bahwa dia masih bekerja di sana saat ini.\n"
    "Semua kalimat dalam Bahasa Indonesia."
)
```

**Verifikasi setelah selesai:**
- Test dengan perusahaan yang namanya umum (e.g., PT Maju Bersama) — pastikan tidak ada kontak aneh yang lolos
- Log harus menampilkan `REJECTED: PAST_EMPLOYEE` untuk kontak dengan tahun range
- Field `reasoning` di output harus mengandung `[MANDATE]`, `[PAIN OWNERSHIP]`, `[HOOK]`, `[RECENCY]`

---

## PROMPT 3 — Lane C: NewsSignal Architecture + Synthesis Coupling

**Tujuan:** Mengganti industri fallback yang tidak relevan dengan contextual signal search, mengekstrak `NewsSignal` dari setiap artikel, dan memastikan news benar-benar mempengaruhi pain point generation di synthesis.

**Baca dulu sebelum mengerjakan:**
- `backend/app/services/lane_c_service.py` — seluruh file
- `backend/app/services/openai_service.py` — fungsi `synthesize_profile()`
- `backend/app/models/schemas.py` — class `NewsItem`
- `backend/app/api/routers/recon.py` — fungsi `run_recon_pipeline()`

**Tugas spesifik:**

**3a. Tambahkan `NewsSignal` schema ke `schemas.py`:**

```python
class NewsSignal(BaseModel):
    """Sinyal pain bisnis yang diekstrak dari satu artikel berita."""
    event_summary: str     # Apa yang terjadi (1 kalimat ringkas)
    implied_challenge: str # Implikasi bisnis untuk perusahaan target (1 kalimat)
    pain_category: str     # "Marketing" | "Operations" | "Technology" | "Growth"
    source_url: str        # URL artikel asal
    signal_type: str       # "direct" | "regulatory" | "competitive" | "technology"
```

Tambahkan `signal_type: Optional[str] = None` ke class `NewsItem` yang sudah ada.

**3b. Tambahkan fungsi `_extract_news_signals()` di `lane_c_service.py`:**

```python
async def _extract_news_signals(
    news_items: list[dict[str, Any]],
    company_name: str,
    jina_contents: list[str],
) -> list[dict[str, Any]]:
    """
    Jalankan GPT-4o-mini per artikel untuk mengekstrak pain signal terstruktur.
    Return list NewsSignal-compatible dicts.
    """
    from openai import AsyncOpenAI
    from app.core.config import settings
    
    if not news_items:
        return []
    
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    
    async def _extract_one(item: dict, jina_text: str) -> dict | None:
        title = item.get("title", "")
        snippet = item.get("snippet", item.get("description", ""))
        url = item.get("link", "")
        signal_type = item.get("_signal_type", "direct")  # internal tag
        
        content_for_prompt = jina_text[:1200] if jina_text else snippet
        
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=300,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Kamu adalah analis B2B. Dari artikel berita ini, ekstrak sinyal bisnis "
                            "yang relevan untuk tim sales yang menargetkan perusahaan tersebut. "
                            "Balas JSON: {event_summary, implied_challenge, pain_category, signal_type} "
                            "pain_category harus salah satu dari: Marketing, Operations, Technology, Growth. "
                            "signal_type harus salah satu dari: direct, regulatory, competitive, technology."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Perusahaan target: {company_name}\n"
                            f"Judul artikel: {title}\n"
                            f"Konten: {content_for_prompt}"
                        ),
                    },
                ],
            )
            import json
            parsed = json.loads(response.choices[0].message.content or "{}")
            return {
                "event_summary": parsed.get("event_summary", ""),
                "implied_challenge": parsed.get("implied_challenge", ""),
                "pain_category": parsed.get("pain_category", "Operations"),
                "source_url": url,
                "signal_type": parsed.get("signal_type", signal_type),
            }
        except Exception as exc:
            logger.warning("[lane_c] _extract_one FAILED: %s", exc)
            return None
    
    signals = await asyncio.gather(
        *[_extract_one(item, jina_contents[i] if i < len(jina_contents) else "") 
          for i, item in enumerate(news_items[:3])],  # Maksimal 3 artikel untuk NewsSignal
        return_exceptions=True,
    )
    
    return [s for s in signals if s is not None and not isinstance(s, Exception)]
```

**3c. Ganti Strategy 5 dan 6 dengan Contextual Signal Search:**

Hapus strategy 5 (generic industry trend) dan strategy 6 (generic "bisnis Indonesia"). Ganti dengan:

```python
# Strategy 5: Contextual Signals — 3 query bertarget
# Hanya dijalankan jika company news tidak ditemukan di strategy 1-4

async def _try_contextual_signals(
    company_name: str,
    domain: str,
    named_entities: list[str],  # Dari Lane A r1_insights.named_entities
    industry_hint: str,
) -> list[dict[str, Any]]:
    """
    Cari sinyal kontekstual yang mempengaruhi perusahaan target secara tidak langsung.
    BUKAN generic industry news — harus ada koneksi ke situasi spesifik target.
    """
    industry = _detect_industry(industry_hint)
    
    queries = []
    
    # Regulatory signal: OJK/Kominfo + industri spesifik
    if industry:
        queries.append(
            (f"OJK OR Kominfo regulasi {industry} 2025 2026", "regulatory")
        )
    
    # Competitive signal: kompetitor yang ditemukan Lane A
    if named_entities:
        # Ambil entitas yang kemungkinan kompetitor (bukan nama orang)
        competitor_hint = named_entities[0] if named_entities else ""
        if competitor_hint and len(competitor_hint) > 3:
            queries.append(
                (f'"{competitor_hint}" ekspansi OR "market share" OR peluncuran 2025', "competitive")
            )
    
    # Technology signal: dari industri
    tech_signals = {
        "SaaS": "transformasi digital enterprise Indonesia AI automation 2025",
        "fintech": "open banking API Indonesia regulasi data 2025",
        "e-commerce": "social commerce quick commerce Indonesia trend 2025",
        "perbankan": "digital banking Indonesia core banking modernisasi",
        "logistik": "supply chain disruption Indonesia last mile 2025",
    }
    if industry and industry in tech_signals:
        queries.append((tech_signals[industry], "technology"))
    
    if not queries:
        return []  # Tidak ada contextual signal yang bisa dibuat — return kosong, jangan fallback generic
    
    articles: list[dict[str, Any]] = []
    for query, signal_type in queries[:2]:  # Maksimal 2 contextual query
        results = await _try_serper_news(query, f"contextual_{signal_type}")
        for r in results[:2]:
            r["_signal_type"] = signal_type  # Tag internal untuk NewsSignal extraction
        articles.extend(results[:2])
        if articles:
            break
    
    return articles
```

**3d. Update `run_lane_c_news()` — return dua objek:**

Ubah return type menjadi `tuple[list[dict], list[dict]]` — (news_items, pain_signals_from_news).

```python
async def run_lane_c_news(
    company_name: str,
    *,
    domain: str = "",
    industry_hint: str = "",
    named_entities: list[str] | None = None,  # BARU: dari Lane A
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Return:
        (news_items, pain_signals_from_news)
        news_items: untuk di-inject ke profile.news
        pain_signals_from_news: untuk masuk ke synthesis prompt sebagai evidence
    """
    # ... (logic yang sama sampai langkah enrich) ...
    
    # Setelah enrich dengan Jina:
    # Jalankan NewsSignal extraction
    jina_contents = [...]  # Kumpulkan semua hasil Jina dari _enrich_with_jina
    pain_signals = await _extract_news_signals(unique_articles[:3], company_name, jina_contents)
    
    # Tandai signal_type di news_items untuk UI badge
    for item, article in zip(news_items, unique_articles):
        item["signalType"] = article.get("_signal_type", "direct")
    
    return news_items, pain_signals
```

**3e. Update `recon.py` — terima tuple dari Lane C:**

```python
lane_a_result, scored_contacts, lane_c_result = await asyncio.gather(
    _run_lane_a(canonical_url, company_name, domain, mode),
    _run_lane_b(domain, company_name, company_context),
    _run_lane_c(company_name, domain, industry_hint),
)

lane_a_summary, lane_a_evidence = lane_a_result   # tuple dari PROMPT 1
parsed_news, pain_signals_from_news = lane_c_result  # tuple dari PROMPT 3
```

**3f. Update `synthesize_profile()` di `openai_service.py` — tambahkan input baru:**

Tambahkan 2 parameter baru:
```python
async def synthesize_profile(
    lane_a_summary: str,
    scored_contacts: list[dict[str, Any]],
    company_url: str,
    mode: ReconMode,
    extracted_news: list[dict[str, Any]] | None = None,
    lane_a_evidence: list[dict[str, Any]] | None = None,       # BARU
    pain_signals_from_news: list[dict[str, Any]] | None = None, # BARU
) -> CompanyProfile:
```

Di `user_prompt`, tambahkan dua section baru:

```python
evidence_json = json.dumps(lane_a_evidence or [], ensure_ascii=False)
news_signals_json = json.dumps(pain_signals_from_news or [], ensure_ascii=False)

user_prompt = (
    f"URL perusahaan: {company_url}\n\n"
    f"=== RINGKASAN RISET (Lane A) ===\n{lane_a_summary}\n\n"
    f"=== EVIDENCE DENGAN URL CITATION (Lane A) ===\n"
    f"Ini adalah fakta DENGAN URL sumber. GUNAKAN URL ini untuk mengisi sourceUrl di painPoints.\n"
    f"{evidence_json}\n\n"
    f"=== KONTAK PIC (Lane B) ===\n{contacts_json}\n\n"
    f"=== PAIN SIGNALS DARI BERITA (Lane C) ===\n"
    f"Ini adalah implikasi bisnis yang diekstrak dari berita. Gunakan untuk memperkuat painPoints.\n"
    f"{news_signals_json}\n\n"
    f"=== [BERITA_LANE_C] (untuk konteks saja — akan di-inject ke news secara terpisah) ===\n{news_json}\n\n"
    "Sintesis seluruh data di atas menjadi profil perusahaan lengkap."
)
```

Di `system_prompt`, tambahkan aturan citation yang lebih ketat:

```python
"3. PAIN POINTS — CITATION WAJIB DARI EVIDENCE:\n"
"   - sourceUrl HARUS diambil dari 'EVIDENCE DENGAN URL CITATION' atau 'PAIN SIGNALS DARI BERITA'.\n"
"   - Jika tidak ada URL yang relevan di kedua section tersebut → sourceUrl = '' dan severity = 'low'.\n"
"   - DILARANG KERAS mengisi sourceUrl dengan URL yang tidak ada dalam evidence/pain_signals.\n"
"   - Pain point yang sourceUrl-nya kosong otomatis severity-nya 'low' — bukan hallusinasi.\n\n"
```

**Verifikasi setelah selesai:**
- Response `painPoints[*].sourceUrl` harus berisi URL real dari Tavily search (bukan domain fiksi)
- Response `news[*].signalType` harus berisi nilai valid ("direct", "regulatory", "competitive", "technology")
- Log harus menampilkan `[lane_c] pain_signals extracted: N` (N > 0 untuk perusahaan yang punya berita)

---

## PROMPT 4 — Pro Mode: Agentic Confidence Gap Agent

**Tujuan:** Membuat Pro Mode benar-benar berbeda dari Free Mode — bukan hanya prompt yang berbeda, tapi pipeline penelitian yang lebih dalam dengan recursive gap-filling dan cross-validation citation.

**Baca dulu sebelum mengerjakan:**
- `backend/app/services/lane_a_service.py` — seluruh file (setelah PROMPT 1 diterapkan)
- `backend/app/services/openai_service.py` — `synthesize_profile()` (setelah PROMPT 3)
- `backend/app/models/schemas.py` — `CompanyProfile`
- `backend/app/api/routers/recon.py` — `run_recon_pipeline()`

**Tugas spesifik:**

**4a. Tambahkan `ConfidenceReport` schema di `lane_a_service.py`:**

```python
class FieldConfidence(BaseModel):
    field_name: str = Field(description="Nama field: description, painPoints, contacts, deepInsights, atau nama spesifik")
    confidence_score: int = Field(description="Score 0-100 seberapa yakin data sudah solid", ge=0, le=100)
    gap_description: str = Field(description="Penjelasan mengapa confidence rendah — apa yang tidak ditemukan")
    suggested_query: str = Field(description="Query pencarian spesifik yang akan mengisi gap ini. String kosong jika confidence >= 70.")

class ConfidenceReport(BaseModel):
    fields: list[FieldConfidence] = Field(
        description="Daftar assessment per field profile. Evaluasi minimal: description, painPoints, contacts, deepInsights."
    )
    overall_confidence: int = Field(description="Score overall 0-100", ge=0, le=100)
```

**4b. Tambahkan fungsi `_pro_confidence_evaluation()` di `lane_a_service.py`:**

```python
async def _pro_confidence_evaluation(
    initial_summary: str,
    initial_evidence: list[dict],
    company_name: str,
) -> ConfidenceReport:
    """
    FASE 2 Pro Mode: GPT-4o mengevaluasi seberapa solid data yang sudah dikumpulkan
    dan mengidentifikasi query untuk mengisi gap tertinggi.
    """
    client = _get_client()
    
    evidence_sample = json.dumps(initial_evidence[:10], ensure_ascii=False)
    
    try:
        response = await client.beta.chat.completions.parse(
            model="gpt-4o",
            max_tokens=1200,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Kamu adalah peneliti B2B yang baru saja menyelesaikan penelitian awal. "
                        "Tugasmu: evaluasi seberapa solid data yang sudah kamu kumpulkan, "
                        "dan tentukan field mana yang masih lemah dan perlu query tambahan. "
                        "Fokuslah pada gap yang PALING PENTING untuk sales intelligence: "
                        "revenue/finansial, pain points spesifik, tech stack, dan kontak eksekutif.\n\n"
                        "ATURAN: Jika kamu tidak menemukan angka spesifik (revenue, jumlah karyawan, "
                        "market share), itu adalah gap HIGH PRIORITY. "
                        "Jika pain points hanya berdasarkan asumsi (tidak ada bukti URL), itu gap HIGH PRIORITY."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Perusahaan: {company_name}\n\n"
                        f"Ringkasan penelitian:\n{initial_summary[:2000]}\n\n"
                        f"Evidence yang terkumpul (sample):\n{evidence_sample}\n\n"
                        "Evaluasi: field mana yang confidence-nya rendah? "
                        "Buat query spesifik untuk field dengan confidence < 70."
                    ),
                },
            ],
            response_format=ConfidenceReport,
        )
        return response.choices[0].message.parsed
    except Exception as exc:
        logger.warning("[lane_a] _pro_confidence_evaluation FAILED: %s", exc)
        return ConfidenceReport(
            fields=[],
            overall_confidence=50,
        )
```

**4c. Tambahkan fungsi `_pro_recursive_gap_filling()` di `lane_a_service.py`:**

```python
async def _pro_recursive_gap_filling(
    confidence_report: ConfidenceReport,
    existing_evidence: list[dict],
    company_name: str,
    max_rounds: int = 2,
) -> list[dict]:
    """
    FASE 3 Pro Mode: Untuk field dengan confidence < 70, jalankan query tambahan.
    Maksimal max_rounds iterasi untuk kontrol biaya.
    Return: existing_evidence + new_evidence (gabungan)
    """
    low_confidence_fields = [
        f for f in confidence_report.fields
        if f.confidence_score < 70 and f.suggested_query
    ]
    
    if not low_confidence_fields:
        logger.info("[lane_a] pro_gap_filling: semua field confidence >= 70, skip")
        return existing_evidence
    
    new_evidence = list(existing_evidence)
    
    for round_num in range(min(max_rounds, len(low_confidence_fields))):
        field = low_confidence_fields[round_num]
        logger.info(
            "[lane_a] pro_gap_filling round=%d | field=%s confidence=%d | query=%r",
            round_num + 1, field.field_name, field.confidence_score, field.suggested_query[:60],
        )
        
        try:
            resp = await tavily_service.search(
                field.suggested_query,
                search_depth="advanced",
                topic="general",
                max_results=5,
            )
            results = resp.get("results", [])
            
            # Distil hasil baru menjadi evidence facts
            for result in results:
                new_evidence.append({
                    "fact": result.get("content", "")[:500],
                    "url": result.get("url", ""),
                    "title": result.get("title", ""),
                    "from_gap_filling": True,
                    "target_field": field.field_name,
                })
        except Exception as exc:
            logger.warning("[lane_a] pro_gap_filling round=%d FAILED: %s", round_num + 1, exc)
    
    return new_evidence
```

**4d. Tambahkan fungsi `_pro_deep_subpage_scraping()` di `lane_a_service.py`:**

```python
async def _pro_deep_subpage_scraping(url: str, company_name: str) -> list[dict]:
    """
    FASE 5 Pro Mode: Ekstrak konten dari sub-pages perusahaan.
    Sub-pages sering punya data yang tidak ada di homepage: klien, proses, tools, team.
    """
    base_url = url.rstrip("/")
    candidate_subpages = [
        f"{base_url}/about",
        f"{base_url}/team",
        f"{base_url}/clients",
        f"{base_url}/case-studies",
        f"{base_url}/blog",
    ]
    
    try:
        resp = await tavily_service.extract(candidate_subpages[:4])
        results = resp.get("results", [])
        
        subpage_evidence = []
        for result in results:
            content = result.get("raw_content", "")[:1500]
            if content and len(content) > 100:
                subpage_evidence.append({
                    "fact": content,
                    "url": result.get("url", ""),
                    "title": f"[Sub-page] {result.get('url', '').split('/')[-1] or 'page'}",
                    "from_subpage": True,
                })
        
        logger.info("[lane_a] pro_subpage_scraping | found=%d pages with content", len(subpage_evidence))
        return subpage_evidence
    except Exception as exc:
        logger.warning("[lane_a] pro_subpage_scraping FAILED (dilanjutkan): %s", exc)
        return []
```

**4e. Tambahkan fungsi `_pro_cross_validation()` di `openai_service.py`:**

```python
async def _pro_cross_validate_citations(
    pain_points: list[dict],
    evidence_list: list[dict],
) -> list[dict]:
    """
    FASE 4 Pro Mode: Validasi setiap citation pain point.
    Jika tidak ada bukti, set sourceUrl='' dan severity='low'.
    Return pain_points yang sudah divalidasi.
    """
    if not pain_points or not evidence_list:
        return pain_points
    
    client = _get_client()
    
    evidence_urls = {e.get("url", ""): e.get("fact", "") + " " + e.get("title", "") for e in evidence_list if e.get("url")}
    
    pain_json = json.dumps(pain_points, ensure_ascii=False)
    evidence_json = json.dumps(list(evidence_urls.items())[:20], ensure_ascii=False)
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=2000,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Kamu adalah fact-checker B2B. Tugasmu: untuk setiap pain point, "
                        "periksa apakah sourceUrl-nya ada dalam daftar evidence yang diberikan. "
                        "Jika sourceUrl tidak ada dalam evidence, set sourceUrl='' dan severity='low'. "
                        "Jika sourceUrl ada dan konten evidence mendukung issue tersebut, pertahankan. "
                        "Kembalikan JSON: {\"validated_pain_points\": [...]} "
                        "Jangan ubah field lain — hanya validasi sourceUrl dan severity."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Pain points yang perlu divalidasi:\n{pain_json}\n\n"
                        f"Evidence yang tersedia (URL + konten):\n{evidence_json}\n\n"
                        "Validasi setiap sourceUrl. Jika URL tidak ada dalam evidence → sourceUrl='' dan severity='low'."
                    ),
                },
            ],
        )
        
        import json
        parsed = json.loads(response.choices[0].message.content or "{}")
        validated = parsed.get("validated_pain_points", pain_points)
        logger.info("[openai] _pro_cross_validate: validated %d pain points", len(validated))
        return validated
    except Exception as exc:
        logger.warning("[openai] _pro_cross_validate FAILED (pakai original): %s", exc)
        return pain_points
```

**4f. Update `run_lane_a_advanced()` — fork Free vs Pro:**

```python
async def run_lane_a_advanced(
    url: str,
    company_name: str,
    domain: str,
    mode: ReconMode,
) -> tuple[str, list[dict]]:
    """
    Return: (summary_str, evidence_list)
    Pro Mode menambahkan FASE 2-5 di atas hasil Free Mode.
    """
    # Steps 0-6 tetap sama (Free Mode baseline)
    # ...
    
    summary, evidence_list = _step6_combine(...)
    
    if mode == ReconMode.pro:
        logger.info("[lane_a_advanced] Pro Mode: memulai FASE 2-5 agentic loop")
        
        # FASE 2: Confidence Evaluation
        confidence_report = await _pro_confidence_evaluation(summary, evidence_list, company_name)
        logger.info(
            "[lane_a_advanced] Pro FASE2: overall_confidence=%d, low_fields=%d",
            confidence_report.overall_confidence,
            sum(1 for f in confidence_report.fields if f.confidence_score < 70),
        )
        
        # FASE 3: Recursive Gap-Filling (max 2 rounds)
        evidence_list = await _pro_recursive_gap_filling(confidence_report, evidence_list, company_name)
        
        # FASE 5: Deep Sub-page Scraping
        subpage_evidence = await _pro_deep_subpage_scraping(url, company_name)
        evidence_list.extend(subpage_evidence)
        
        # Update summary dengan informasi baru
        new_facts = [e["fact"][:200] for e in evidence_list if e.get("from_gap_filling") or e.get("from_subpage")]
        if new_facts:
            summary += "\n\n--- TAMBAHAN DATA PRO MODE ---\n" + "\n".join(f"• {f}" for f in new_facts[:10])
        
        logger.info(
            "[lane_a_advanced] Pro FASE3+5 done | total_evidence=%d",
            len(evidence_list),
        )
    
    return summary, evidence_list
```

**4g. Update `synthesize_profile()` di `openai_service.py` — tambahkan cross-validation untuk Pro Mode:**

Di akhir `synthesize_profile()`, sebelum menginjeksi berita:

```python
# FASE 4 Pro Mode: Cross-validation citations
if mode == ReconMode.pro and lane_a_evidence and profile.painPoints:
    pain_dicts = [p.model_dump() for p in profile.painPoints]
    validated_dicts = await _pro_cross_validate_citations(pain_dicts, lane_a_evidence)
    # Rebuild pain points dari hasil validasi
    from app.models.schemas import PainPoint, PainCategory, PainSeverity
    validated_pain_points = []
    for p in validated_dicts:
        try:
            validated_pain_points.append(PainPoint(**p))
        except Exception:
            pass
    if validated_pain_points:
        object.__setattr__(profile, "painPoints", validated_pain_points)
        logger.info("[openai] synthesize_profile Pro: cross-validated %d pain points", len(validated_pain_points))
```

**Verifikasi setelah selesai:**
- Pro Mode harus memakan waktu lebih lama dari Free Mode (log timestamp)
- Log harus menampilkan `Pro FASE2`, `Pro FASE3`, `Pro FASE5` secara berurutan
- `painPoints[*].sourceUrl` di Pro Mode harus lebih reliable (hampir semua terisi dengan URL real)
- Total evidence di Pro Mode harus lebih banyak dari Free Mode (log `total_evidence=N` vs `total_evidence=M` dimana N > M)

---

## Checklist Pasca-Implementasi

Setelah semua 4 prompt selesai dieksekusi, lakukan verifikasi end-to-end:

```
1. Test dengan perusahaan kecil/niche (tidak banyak berita):
   - Apakah contextual signals muncul di Lane C? (bukan generic "bisnis Indonesia")
   - Apakah kontak yang muncul valid (bukan mantan karyawan)?

2. Test dengan perusahaan besar/public (banyak berita):
   - Apakah sourceUrl pain points berisi URL real (bukan hallusinasi)?
   - Apakah reasoning kontak berisi 4 komponen [MANDATE][PAIN OWNERSHIP][HOOK][RECENCY]?

3. Bandingkan Free vs Pro untuk perusahaan yang sama:
   - Pro harus memiliki lebih banyak evidence dalam log
   - Pro harus memiliki log "Pro FASE2/3/5" yang tidak ada di Free
   - Pain points Pro harus lebih spesifik (ada angka, ada bukti URL)

4. Jalankan type check: `python -m mypy backend/app/services/ --ignore-missing-imports`
```
