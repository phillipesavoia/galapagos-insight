import { BarChart3, FileText, Presentation, ClipboardList, Eye, RefreshCw, Trash2, CheckCircle } from "lucide-react";
import { useState } from "react";
import type { Document } from "@/hooks/useDocuments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const typeIcons: Record<string, React.ComponentType<any>> = {
  factsheet: BarChart3,
  carta_mensal: FileText,
  apresentacao: Presentation,
  outro: ClipboardList,
};

const typeLabels: Record<string, string> = {
  factsheet: "Factsheet",
  carta_mensal: "Carta Mensal",
  apresentacao: "Apresentação",
  outro: "Outro",
};

interface DocumentCardProps {
  doc: Document;
  onDelete: (id: string) => void;
}

export function DocumentCard({ doc, onDelete }: DocumentCardProps) {
  const [hovered, setHovered] = useState(false);
  const Icon = typeIcons[doc.type || "outro"] || ClipboardList;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative p-6 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate">{doc.name}</h3>
          <p className="text-sm text-primary mt-0.5">{doc.fund_name || "—"}</p>
          {/* Ticker / ISIN from metadata */}
          {doc.metadata && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(doc.metadata as Record<string, unknown>).detected_ticker_exchange && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-mono font-semibold">
                  {(doc.metadata as Record<string, unknown>).detected_ticker_exchange as string}
                </span>
              )}
              {!(doc.metadata as Record<string, unknown>).detected_ticker_exchange && (doc.metadata as Record<string, unknown>).detected_ticker && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-mono font-semibold">
                  {(doc.metadata as Record<string, unknown>).detected_ticker as string}
                </span>
              )}
              {(doc.metadata as Record<string, unknown>).detected_isin && (
                <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground font-mono">
                  {(doc.metadata as Record<string, unknown>).detected_isin as string}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground">
              {doc.period || "—"}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground">
              {typeLabels[doc.type || "outro"] || doc.type}
            </span>
            {doc.status === "indexed" ? (
              <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Indexado
              </span>
            ) : doc.status === "processing" ? (
              <span className="px-2 py-0.5 rounded-md bg-warning/15 text-warning text-xs animate-pulse">
                Processando...
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-destructive/15 text-destructive text-xs">Erro</span>
            )}
          </div>
          {doc.status === "indexed" && doc.chunk_count != null && (
            <p className="text-xs text-muted-foreground mt-2">{doc.chunk_count} chunks</p>
          )}
        </div>
      </div>

      {hovered && (
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          <button title="Excluir" onClick={() => onDelete(doc.id)} className="p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
