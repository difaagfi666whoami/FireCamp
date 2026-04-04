"use client"

import { useState, useRef } from "react"
import { extractFromPdfSteps } from "@/lib/api/pdf-extract"
import { PdfExtractionResult } from "@/types/match.types"

const ACCEPTED_FORMATS = [".pdf", ".docx", ".pptx"]
const MAX_SIZE_MB = 10

export function usePdfUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState<PdfExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (f: File): string | null => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase()
    if (!ACCEPTED_FORMATS.includes(ext))
      return `Format tidak didukung. Gunakan: ${ACCEPTED_FORMATS.join(", ")}`
    if (f.size > MAX_SIZE_MB * 1024 * 1024)
      return `Ukuran file maksimal ${MAX_SIZE_MB}MB`
    return null
  }

  const handleFileSelect = (f: File) => {
    const err = validateFile(f)
    if (err) { setError(err); return }
    setError(null)
    setFile(f)
    setExtractionResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelect(dropped)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const startExtraction = async () => {
    if (!file) return
    setIsExtracting(true)
    setError(null)
    try {
      const result = await extractFromPdfSteps(() => {})
      setExtractionResult(result)
      return result
    } catch (err) {
      console.error("[Campfire/usePdfUpload]", err)
      setError("Gagal mengekstrak dokumen. Coba lagi.")
      return null
    } finally {
      setIsExtracting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setError(null)
    setExtractionResult(null)
    setIsExtracting(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  return {
    file,
    isDragging,
    isExtracting,
    extractionResult,
    error,
    inputRef,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileSelect,
    startExtraction,
    reset,
  }
}
