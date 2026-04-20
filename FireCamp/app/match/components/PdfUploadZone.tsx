"use client"

import { useState } from "react"
import { UploadCloud, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PdfUploadZoneProps {
  onExtracted: (products: any[]) => void
}

export function PdfUploadZone({ onExtracted }: PdfUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleExtract(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleExtract(e.target.files[0])
    }
  }

  const handleExtract = (file: File) => {
    // Only accept PDF (or simulate accepting anything as PDF)
    setIsExtracting(true)
    
    // Simulate extraction from mock data
    setTimeout(() => {
      import('@/lib/mock/mockdata').then(({ mockData }) => {
        setIsExtracting(false)
        const mock = mockData.pdfExtractionMock
        const extractedProduct = {
          id: `prod-extracted-${Date.now()}`,
          name: mock.extractedName,
          tagline: mock.extractedTagline,
          description: mock.extractedDescription,
          price: mock.extractedPrice,
          usp: mock.extractedUsp,
          painCategories: [],
          source: "pdf",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        onExtracted([extractedProduct])
      })
    }, 2000)
  }

  return (
    <div 
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        isDragging ? "border-brand bg-brand/5" : "border-border hover:bg-muted/50"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {isExtracting ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-brand"  strokeWidth={1.5} />
          <div className="text-sm font-medium">Mengekstrak produk dari PDF menggunakan AI...</div>
          <div className="text-xs text-muted-foreground">Proses ini akan menghabiskan sekitar ~1.2K tokens</div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-muted rounded-full">
            <UploadCloud className="w-8 h-8 text-muted-foreground"  strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-semibold text-base mb-1">Upload Brosur / Company Profile</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Drag and drop file PDF ke area ini, atau klik tombol di bawah untuk memilih file. AI akan otomatis mengekstrak daftar produk/layanan.
            </p>
          </div>
          <div className="relative">
            <label htmlFor="pdf-upload-brochure" className="sr-only">
              Upload file PDF brosur
            </label>
            <input
              id="pdf-upload-brochure"
              name="pdf-upload-brochure"
              type="file"
              accept=".pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileInput}
            />
            <Button variant="secondary">Pilih File PDF</Button>
          </div>
        </div>
      )}
    </div>
  )
}
