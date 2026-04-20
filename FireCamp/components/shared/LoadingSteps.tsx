import { Check, CircleDashed, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStepsProps {
  steps: string[]
  currentStep: number // 0-indexed
}

export function LoadingSteps({ steps, currentStep }: LoadingStepsProps) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-muted/20 border">
      {steps.map((step, index) => {
        const isDone = index < currentStep
        const isActive = index === currentStep
        
        return (
          <div 
            key={index} 
            className={cn(
              "flex items-center gap-3 text-sm transition-colors duration-300",
              isDone ? "text-success" : isActive ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            <div className="flex-shrink-0">
              {isDone ? (
                <Check className="w-4 h-4"  strokeWidth={1.5} />
              ) : isActive ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand"  strokeWidth={1.5} />
              ) : (
                <CircleDashed className="w-4 h-4"  strokeWidth={1.5} />
              )}
            </div>
            <span>{step}</span>
          </div>
        )
      })}
    </div>
  )
}
