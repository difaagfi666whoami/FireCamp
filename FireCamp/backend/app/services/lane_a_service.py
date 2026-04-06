"""
lane_a_service.py — Advanced Custom Parallel Architecture untuk Lane A (Company Profiling).

Menggantikan single-call Tavily /research dengan pipeline 7-step iteratif
yang menggunakan asyncio.gather untuk paralelisasi optimal.

Pipeline Flow:
  Step 0 : Tavily Extract URL utama → raw content ground truth
  Step 1 : OpenAI mini → Gap Analysis dari struktur schema
  Step 2 : OpenAI mini → Generate 3 array query (General, News, Deep Targeted)
  Step 3 : [PARALEL] Tavily Search General (R1) + Tavily Search News (R2)
  Step 4 : [PARALEL] OpenAI mini distill R1 + distill R2 → wawasan entitas
  Step 5 : Tavily Search Deep Targeted (R3) — pakai entitas dari Step 4,
           limitasikan ke domain idx.co.id dan bisnis.com
  Step 6 : Gabungkan seluruh summary → return string kaya data

Semua step menggunakan Pydantic Structured Outputs untuk LLM.
Fungsi bersifat fully async dengan asyncio.gather.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.core.config import settings
from app.models.schemas import ReconMode
from app.services import tavily_service

logger = logging.getLogger(__name__)

MODEL_MINI = "gpt-4o-mini"

# Domain pencarian lokal Indonesia untuk Deep Targeted Search
DEEP_SEARCH_DOMAINS = ["idx.co.id", "bisnis.com", "kontan.co.id", "katadata.co.id"]


# ─── Pydantic Structured Output schemas untuk LLM ─────────────────────────────

class GapAnalysis(BaseModel):
    """Output Step 1: identifikasi gap informasi dari konten homepage."""
    identified_gaps: list[str] = Field(
        description="Daftar informasi kritis yang belum terjawab dari konten homepage"
    )
    known_facts: list[str] = Field(
        description="Fakta yang sudah diketahui dari homepage (nama, industri, dll.)"
    )
    priority_research_areas: list[str] = Field(
        description="Area riset prioritas: revenue model, pain points, kompetitor, berita terkini"
    )


class QuerySet(BaseModel):
    reputation_queries: list[str] = Field(
        description="1-2 query reputasi BISNIS: review klien B2B, case study, testimonial, partnership. "
                    "JANGAN glassdoor/review karyawan. Contoh: 'site:g2.com \"{company}\"', '\"{company}\" client review'",
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


# ─── Client helper ────────────────────────────────────────────────────────────

def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY belum diset di .env.local")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _format_results(results: list[dict[str, Any]], max_items: int = 8) -> str:
    """Format list hasil Tavily menjadi teks terstruktur untuk prompt."""
    return "\n\n---\n\n".join(
        f"[{i+1}] {r.get('title', 'No title')}\n"
        f"URL: {r.get('url', '')}\n"
        f"{r.get('content', r.get('raw_content', ''))[:1500]}"
        for i, r in enumerate(results[:max_items])
    )


# ─── Step 0: Tavily Extract homepage ──────────────────────────────────────────

async def _step0_extract_homepage(url: str) -> str:
    """Ekstrak konten mentah homepage untuk ground truth."""
    logger.info("[lane_a] Step0 extract | url=%r", url)
    try:
        resp = await tavily_service.extract([url])
        results = resp.get("results", [])
        if results:
            return results[0].get("raw_content", "")[:3000]
        return ""
    except Exception as exc:
        logger.warning("[lane_a] Step0 extract FAILED (dilanjutkan): %s", exc)
        return ""


# ─── Step 1: Gap Analysis ─────────────────────────────────────────────────────

async def _step1_gap_analysis(
    homepage_content: str,
    company_name: str,
) -> GapAnalysis:
    """Identifikasi gap informasi dari konten homepage menggunakan LLM mini."""
    logger.info("[lane_a] Step1 gap_analysis | company=%r", company_name)

    client = _get_client()
    depth_note = "Identifikasi gap utama untuk overview solid."

    try:
        response = await client.beta.chat.completions.parse(
            model=MODEL_MINI,
            max_tokens=800,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Kamu adalah analis riset B2B. Analisis konten homepage dan identifikasi "
                        "informasi apa yang BELUM tersedia yang penting untuk profiling perusahaan. "
                        f"{depth_note}"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Perusahaan: {company_name}\n\n"
                        f"Konten homepage:\n{homepage_content or '(tidak tersedia)'}"
                    ),
                },
            ],
            response_format=GapAnalysis,
        )
        result = response.choices[0].message.parsed
        logger.info(
            "[lane_a] Step1 OK | gaps=%d known_facts=%d",
            len(result.identified_gaps),
            len(result.known_facts),
        )
        return result
    except Exception as exc:
        logger.warning("[lane_a] Step1 gap_analysis FAILED | error=%s", exc)
        return GapAnalysis(
            identified_gaps=["Informasi bisnis umum", "Berita terkini", "Kontak eksekutif"],
            known_facts=[f"Nama perusahaan: {company_name}"],
            priority_research_areas=["Revenue model", "Pain points", "Berita funding"],
        )


# ─── Step 2: Generate Query Sets ──────────────────────────────────────────────

async def _step2_generate_queries(
    gap_analysis: GapAnalysis,
    company_name: str,
    domain: str,
) -> QuerySet:
    """Generate 3 array query berdasarkan gap analysis."""
    logger.info("[lane_a] Step2 generate_queries | company=%r", company_name)

    client = _get_client()
    gaps_text = "\n".join(f"- {g}" for g in gap_analysis.identified_gaps)
    priorities_text = "\n".join(f"- {p}" for p in gap_analysis.priority_research_areas)

    depth_note = "Query umum untuk overview yang cukup solid."

    try:
        response = await client.beta.chat.completions.parse(
            model=MODEL_MINI,
            max_tokens=600,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Kamu adalah peneliti B2B yang bertugas mengumpulkan sales intelligence untuk tim outbound.\n"
                        "Kamu HARUS membuat query pencarian untuk SEMUA 6 angle berikut — tidak boleh ada yang kosong:\n\n"
                        "REPUTATION: Cari reputasi BISNIS dari perspektif klien/partner — contoh: 'site:g2.com \"{company}\"', '\"{company}\" client review testimonial case study'. JANGAN cari glassdoor atau review karyawan — itu BUKAN pain point B2B yang berguna.\n"
                        "TECH_STACK: Cari job postings dan tool yang digunakan — contoh: '\"{company}\" site:linkedin.com/jobs', '\"{company}\" builtwith'\n"
                        "REGULATORY: Cari tekanan regulasi untuk industri mereka — contoh: 'OJK regulasi {industry} 2025', '\"{company}\" compliance'\n"
                        "COMPETITIVE: Cari perbandingan dengan kompetitor — contoh: '\"{company}\" vs', '\"{company}\" alternative', '\"{company}\" competitor'\n"
                        "FINANCIAL: Cari sinyal finansial — contoh: '\"{company}\" funding', 'site:crunchbase.com \"{company}\"', '\"{company}\" revenue'\n"
                        "CUSTOMER_VOICE: Cari review pelanggan — contoh: 'site:g2.com \"{company}\"', '\"{company}\" testimonial case study'\n"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Perusahaan target: {company_name} (domain: {domain})\n"
                        f"Gap yang perlu diisi:\n{gaps_text}\n\n"
                        f"Area prioritas riset:\n{priorities_text}\n"
                    ),
                },
            ],
            response_format=QuerySet,
        )
        result = response.choices[0].message.parsed
        logger.info(
            "[lane_a] Step2 OK | rep=%d tech=%d reg=%d comp=%d fin=%d cust=%d",
            len(result.reputation_queries),
            len(result.tech_stack_queries),
            len(result.regulatory_queries),
            len(result.competitive_queries),
            len(result.financial_queries),
            len(result.customer_voice_queries),
        )
        return result
    except Exception as exc:
        logger.warning("[lane_a] Step2 generate_queries FAILED | error=%s", exc)
        return QuerySet(
            reputation_queries=[f"'{company_name}' client review testimonial"],
            tech_stack_queries=[f"'{company_name}' site:linkedin.com/jobs"],
            regulatory_queries=[f"'{company_name}' regulasi compliance"],
            competitive_queries=[f"'{company_name}' vs competitor"],
            financial_queries=[f"'{company_name}' funding revenue"],
            customer_voice_queries=[f"'{company_name}' testimonial case study"],
        )


# ─── Step 3: Parallel Tavily Search (R1 General + R2 News) ───────────────────

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




# ─── Step 4: Parallel Distillation R1 + R2 ───────────────────────────────────

async def _step4_parallel_distill(
    angle_results: dict[str, list[dict]],
    company_name: str,
) -> dict[str, DistilledInsights]:
    """
    Distil semua 6 angle secara paralel menggunakan LLM mini + Structured Output.
    Return dict: angle_name -> DistilledInsights
    """
    logger.info("[lane_a] Step4 parallel_distill | %d angles", len(angle_results))

    client = _get_client()

    system_msg = {
        "role": "system",
        "content": (
            "Kamu adalah analis B2B yang sangat cermat. "
            "Ekstrak fakta penting, entitas bernama, dan sinyal masalah bisnis dari hasil riset. "
            "Sertakan angka dan persentase spesifik jika ditemukan. "
            "Nama entitas sangat penting untuk query lanjutan. "
            "Setiap fakta WAJIB menyertakan URL aslinya di field 'url'. Jika data ini tidak punya URL, ubah jadi string kosong."
            "\n\nATURAN PENTING: ABAIKAN sepenuhnya data yang bersifat sentimen karyawan internal "
            "(glassdoor review, work-life balance, budaya kerja, gaji, tunjangan). "
            "Fokus HANYA pada: tantangan bisnis, tekanan kompetitif, gap teknologi, "
            "kebutuhan operasional, masalah skalabilitas — hal yang bisa di-address oleh vendor B2B."
        ),
    }

    async def _distill_one(results: list[dict], angle_name: str) -> DistilledInsights:
        if not results:
            return DistilledInsights(
                evidence_facts=[], named_entities=[], pain_signals=[],
                summary_paragraph=f"Tidak ada data dari {angle_name}."
            )
        text = _format_results(results, max_items=4)
        try:
            response = await client.beta.chat.completions.parse(
                model=MODEL_MINI,
                max_tokens=1000,
                messages=[
                    system_msg,
                    {
                        "role": "user",
                        "content": (
                            f"Perusahaan: {company_name}\n"
                            f"Angle: {angle_name}\n\n"
                            f"Data riset:\n{text}"
                        ),
                    },
                ],
                response_format=DistilledInsights,
            )
            return response.choices[0].message.parsed
        except Exception as exc:
            logger.warning("[lane_a] Step4 distill %s FAILED: %s", angle_name, exc)
            return DistilledInsights(
                evidence_facts=[], named_entities=[], pain_signals=[],
                summary_paragraph=f"Distilasi {angle_name} gagal."
            )

    tasks = [
        _distill_one(results, angle)
        for angle, results in angle_results.items()
    ]
    distilled_list = await asyncio.gather(*tasks)
    
    final_insights = dict(zip(angle_results.keys(), distilled_list))
    
    total_facts = sum(len(d.evidence_facts) for d in final_insights.values())
    total_entities = sum(len(d.named_entities) for d in final_insights.values())
    
    logger.info("[lane_a] Step4 OK | total_facts=%d entities=%d", total_facts, total_entities)
    return final_insights


# ─── Step 5: Deep Targeted Search (R3) ───────────────────────────────────────

async def _step5_deep_targeted_search(
    query_set: QuerySet,
    distilled_insights: dict[str, DistilledInsights],
    company_name: str,
) -> list[dict]:
    """
    Jalankan R3 Deep Targeted Search menggunakan entitas dari Step 4.
    Search dibatasi ke domain lokal Indonesia (idx.co.id, bisnis.com, dll.)
    """
    logger.info("[lane_a] Step5 deep_targeted_search R3")

    # Gabungkan entitas dari semua hasil untuk enrichment query
    all_entities = []
    for insight in distilled_insights.values():
        all_entities.extend(insight.named_entities[:2])
    all_entities = list(set(all_entities))
    entity_hint = " ".join(all_entities[:4]) if all_entities else ""

    # Gunakan financial + competitive queries sebagai base untuk deep search
    base_candidates = query_set.financial_queries + query_set.competitive_queries
    if base_candidates:
        base_query = base_candidates[0]
    else:
        base_query = f"{company_name} analisis bisnis keuangan"

    # Tambahkan domain restriction
    domain_filter = " OR ".join(f"site:{d}" for d in DEEP_SEARCH_DOMAINS[:2])
    enriched_query = f"({base_query} {entity_hint}) ({domain_filter})".strip()

    try:
        resp = await tavily_service.search(
            enriched_query,
            search_depth="advanced",
            topic="general",
            max_results=5,
        )
        results = resp.get("results", [])
        logger.info("[lane_a] Step5 R3 OK | results=%d query=%r", len(results), enriched_query[:80])
        return results
    except Exception as exc:
        logger.warning("[lane_a] Step5 R3 FAILED (dilanjutkan tanpa R3): %s", exc)
        return []


# ─── Step 6: Combine all summaries ────────────────────────────────────────────

def _step6_combine(
    homepage_content: str,
    gap_analysis: GapAnalysis,
    distilled_insights: dict[str, DistilledInsights],
    r3_results: list[dict],
    company_name: str,
) -> tuple[str, list[dict]]:
    """
    Gabungkan seluruh ringkasan dari Step 0–5 menjadi satu string kaya data
    yang siap dikonsumsi synthesize_profile().
    """
    r3_text = _format_results(r3_results, max_items=4) if r3_results else "(tidak ada hasil)"

    known_facts = "\n".join(f"  • {f}" for f in gap_analysis.known_facts)
    
    # Kumpulkan evidence fact dari 6 angle
    all_evidence_facts = []
    pain_signals = []
    entities = []
    summary_paragraphs = []
    
    for angle, insight in distilled_insights.items():
        all_evidence_facts.extend(insight.evidence_facts)
        pain_signals.extend(insight.pain_signals)
        entities.extend(insight.named_entities)
        if insight.summary_paragraph and "gagal" not in insight.summary_paragraph:
            summary_paragraphs.append(f"[{angle.upper()}] {insight.summary_paragraph}")
            
    # Serialize evidence facts ke dict untuk synthesis (dan deduplikasi berdasar URL/fact jika perlu, tapi biarkan saja)
    evidence_list = []
    for ef in all_evidence_facts:
        evidence_list.append({
            "fact": ef.fact,
            "url": ef.url or "",
            "title": ef.title or "",
        })
    for ps in pain_signals:
        # Tambahkan pain signals juga ke evidence list agar url-nya bisa diverifikasi 
        evidence_list.append({
            "fact": ps.fact,
            "url": ps.url or "",
            "title": ps.title or "",
        })
        
    evidence_str = "\n".join(f"  • [URL: {e['url']}] Fakta: {e['fact']}" for e in evidence_list[:20])

    entities = list(set(entities))
    entities_text = ", ".join(entities)
    
    summary_text = "\n\n".join(summary_paragraphs)

    summary_str = f"""=== KONTEN HOMEPAGE ASLI ===
{homepage_content[:3000] if homepage_content else "(tidak ada)"}

=== LANE A ADVANCED PROFILE ===
Perusahaan: {company_name}

--- FAKTA TERVERIFIKASI (dari homepage gap analysis) ---
{known_facts or "  (tidak ada)"}

--- OVERVIEW PER ANGLE ---
{summary_text or "  (tidak ada summary)"}

--- EVIDENCE & PAIN SIGNALS (DENGAN URL) ---
{evidence_str or "  (tidak teridentifikasi)"}

--- ENTITAS PENTING ---
{entities_text or "  (tidak ada)"}

--- DEEP TARGETED DATA (R3 — domain lokal Indonesia) ---
{r3_text}
"""
    return summary_str, evidence_list


async def run_lane_a_advanced(
    url: str,
    company_name: str,
    domain: str,
    mode: ReconMode,
) -> tuple[str, list[dict]]:
    """
    Jalankan Advanced Lane A Pipeline (7-Step Custom Parallel Architecture).

    Args:
        url:          URL website target (canonical, dengan schema).
        company_name: Nama perusahaan (dari Step 0 pipeline utama).
        domain:       Domain bersih, e.g. "kreasidigital.co.id".
        domain:       Domain bersih, e.g. "kreasidigital.co.id".

    Returns:
        String summary kaya data (semua round + insights) untuk synthesize_profile().

    Raises:
        RuntimeError jika Step 3 (Tavily search kritis) gagal.
    """
    logger.info(
        "[lane_a_advanced] START | company=%r domain=%r mode=%s",
        company_name, domain, mode.value,
    )

    # Step 0: Extract homepage
    homepage_content = await _step0_extract_homepage(url)

    # Step 1: Gap Analysis (sequential — butuh homepage_content)
    gap_analysis = await _step1_gap_analysis(homepage_content, company_name)

    # Step 2: Generate queries (sequential — butuh gap_analysis)
    query_set = await _step2_generate_queries(gap_analysis, company_name, domain)

    # Step 3: Parallel Tavily Search 6 angles
    angle_results = await _step3_parallel_search(query_set)

    # Step 4: Parallel distillation all angles
    final_insights = await _step4_parallel_distill(
        angle_results, company_name
    )

    # Step 5: Deep Targeted Search R3 (pakai entitas dari Step 4)
    r3_results = await _step5_deep_targeted_search(
        query_set, final_insights, company_name
    )

    # Step 6: Combine semua → output tuple
    summary_str, evidence_list = _step6_combine(
        homepage_content, gap_analysis, final_insights,
        r3_results, company_name,
    )

    logger.info(
        "[lane_a_advanced] DONE | chars=%d angles=%d r3=%d evidence=%d",
        len(summary_str),
        len(final_insights),
        len(r3_results),
        len(evidence_list),
    )
    return summary_str, evidence_list
