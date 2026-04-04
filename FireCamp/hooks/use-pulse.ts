"use client"

import { useEffect } from "react"
import { markStageDone } from "@/lib/progress"

export function usePulse() {
  useEffect(() => {
    markStageDone("pulse")
  }, [])
}
