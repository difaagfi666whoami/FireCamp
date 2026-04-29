import { CheckCircle2, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ApproveButtonProps {
  isApproved: boolean;
  emailNumber: number;
  onToggle: () => void;
}

export function ApproveButton({ isApproved, emailNumber, onToggle }: ApproveButtonProps) {
  if (isApproved) {
    return (
      <div 
        className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-lg font-bold text-[14px] cursor-pointer shadow-sm hover:bg-emerald-100 transition-colors w-full justify-center" 
        onClick={onToggle}
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-600"  strokeWidth={1.5} />
        Email {emailNumber} Diapprove
      </div>
    )
  }

  return (
    <Button 
      onClick={onToggle} 
      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 px-6 h-10 shadow-sm w-full rounded-lg"
    >
      <Circle className="w-4 h-4"  strokeWidth={1.5} />
      Approve Email {emailNumber}
    </Button>
  )
}
