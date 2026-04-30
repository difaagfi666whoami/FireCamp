import { Sidebar } from "@/components/layout/Sidebar"
import { OutOfCreditsModal } from "@/components/ui/OutOfCreditsModal"

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto bg-background">{children}</main>
      <OutOfCreditsModal />
    </div>
  )
}
