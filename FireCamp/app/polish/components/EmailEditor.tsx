import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface EmailEditorProps {
  subject: string;
  body: string;
  onChangeSubject: (val: string) => void;
  onChangeBody: (val: string) => void;
  disabled?: boolean;
}

export function EmailEditor({ subject, body, onChangeSubject, onChangeBody, disabled }: EmailEditorProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <label className="text-[13px] font-bold tracking-tight text-muted-foreground uppercase">Subject Line</label>
        <Input 
          value={subject}
          onChange={e => onChangeSubject(e.target.value)}
          disabled={disabled}
          className="font-bold text-[16px] h-12 disabled:opacity-75 disabled:cursor-not-allowed bg-white shadow-sm"
          placeholder="Tulis subject line email..."
        />
      </div>

      <div className="space-y-2.5">
        <label className="text-[13px] font-bold tracking-tight text-muted-foreground uppercase">Body Content</label>
        <Textarea 
          value={body}
          onChange={e => onChangeBody(e.target.value)}
          disabled={disabled}
          className="min-h-[350px] text-[15px] leading-relaxed resize-y font-medium text-foreground/90 disabled:opacity-75 disabled:cursor-not-allowed p-5 bg-white shadow-sm rounded-xl border-border/80"
          placeholder="Tulis isi email di sini..."
        />
      </div>
    </div>
  )
}
