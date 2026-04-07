import { PdfExtractionResult } from "@/types/match.types"

function stripQuotes(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const API_URL = stripQuotes(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")

// -----------------------------------------------------------------------------
// extractFromPdf — single-call extraction
// -----------------------------------------------------------------------------

export async function extractFromPdf(file: File): Promise<PdfExtractionResult> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`${API_URL}/api/catalog/pdf-extract`, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `PDF extraction failed: ${res.status}`)
  }

  return res.json() as Promise<PdfExtractionResult>
}

// -----------------------------------------------------------------------------
// extractFromPdfSteps — step-by-step version for loading animation
// -----------------------------------------------------------------------------

const STEPS = [
  "Mengunggah dokumen...",
  "Membaca teks PDF...",
  "Mengidentifikasi informasi produk...",
  "Mengekstrak nama, harga, dan USP...",
]

export async function extractFromPdfSteps(
  file: File,
  onStep: (step: string) => void
): Promise<PdfExtractionResult> {
  // Kick off the API call immediately (non-blocking)
  const apiPromise = extractFromPdf(file)

  // Animate steps while waiting
  for (const step of STEPS) {
    onStep(step)
    await new Promise<void>((resolve) => setTimeout(resolve, 600))
  }

  return apiPromise
}
