import { NewsItem } from "@/types/recon.types"
import { CitationLink } from "@/components/shared/CitationLink"
import { Newspaper } from "lucide-react"

export function NewsSection({ news }: { news: NewsItem[] }) {
  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-[15px] text-foreground mb-5 flex items-center gap-2">
        <Newspaper className="w-4 h-4 text-muted-foreground" />
        Recent News & Sinyal Bisnis
      </h3>

      {!news?.length ? (
        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
          <Newspaper className="w-7 h-7 text-muted-foreground/40" />
          <p className="text-[13px] text-muted-foreground font-medium">Belum ada berita tersedia</p>
          <p className="text-[12px] text-muted-foreground/60">Sinyal bisnis akan muncul setelah Recon dijalankan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {news.map((item, idx) => (
            <div key={idx} className={`pb-4 ${idx < news.length - 1 ? "border-b border-border/40" : ""}`}>
              <h4 className="font-bold text-[13.5px] text-foreground leading-snug mb-1.5">{item.title}</h4>
              <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground font-medium mb-2">
                <span className="bg-muted border border-border/50 px-2 py-0.5 rounded-full">{item.source}</span>
                <span>·</span>
                <span>{item.date}</span>
              </div>
              <p className="text-[13px] text-foreground/75 leading-relaxed mb-2">{item.summary}</p>
              {item.url && <CitationLink href={item.url} label="Baca artikel sumber" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
