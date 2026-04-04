import { PdfExtractionResult } from "@/types/match.types"
import { mockData } from "@/lib/mock/mockdata"

// Strip quotes defensif — sama seperti di catalog.ts
function stripQuotes(v: string) { return v.replace(/^(['"])(.*)\1$/, "$2").trim() }
const _mockRaw = stripQuotes(process.env.NEXT_PUBLIC_USE_MOCK ?? "true")
const USE_MOCK = _mockRaw === "true"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// Debug log saat modul pertama kali di-load (tampil di browser console)
if (typeof window !== "undefined") {
  console.info(
    `[Campfire/pdf-extract] mode = ${USE_MOCK ? "MOCK" : "LIVE"} | NEXT_PUBLIC_USE_MOCK = "${process.env.NEXT_PUBLIC_USE_MOCK}"`
  )
}

// -----------------------------------------------------------------------------
// extractFromPdf — single-call extraction
// -----------------------------------------------------------------------------

export async function extractFromPdf(file: File): Promise<PdfExtractionResult> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return mockData.pdfExtractionMock
  }

  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`${API_URL}/api/pdf-extract`, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    throw new Error(`PDF extraction failed: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<PdfExtractionResult>
}

// -----------------------------------------------------------------------------
// extractFromPdfSteps — step-by-step version for loading animation
// -----------------------------------------------------------------------------

const MOCK_STEPS = [
  "Membaca dokumen...",
  "Mengidentifikasi informasi produk...",
  "Mengekstrak nama, harga...",
]

export async function extractFromPdfSteps(
  onStep: (step: string) => void
): Promise<PdfExtractionResult> {
  if (USE_MOCK) {
    for (const step of MOCK_STEPS) {
      onStep(step)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return mockData.pdfExtractionMock
  }

  // Live mode — call onStep first, then POST to backend (Phase 2)
  onStep("Mengunggah dokumen...")
  const res = await fetch(`${API_URL}/api/pdf-extract`, { method: "POST" })

  if (!res.ok) {
    throw new Error(`PDF extraction failed: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<PdfExtractionResult>
}
