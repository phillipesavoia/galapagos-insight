import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface FundDoc {
  id: string;
  name: string;
  fund_name: string | null;
  period: string | null;
  category: string | null;
  file_url: string | null;
}

const FUND_CATEGORIES = ["etf", "bond", "private_fund", "open_end_fund", "ucits", "other"] as const;

const GROUP_CONFIG: Record<string, { label: string; categories: string[] }> = {
  etfs: { label: "ETFs", categories: ["etf"] },
  bonds: { label: "Bonds", categories: ["bond"] },
  fundos: { label: "Fundos", categories: ["private_fund", "open_end_fund", "ucits", "other"] },
};

function getDisplayName(doc: FundDoc): string {
  if (doc.fund_name && doc.fund_name.length > 5 && !doc.fund_name.match(/^[A-Z0-9]{8,}$/)) {
    return doc.fund_name;
  }
  if (doc.name.includes(" — ")) {
    return doc.name
      .split(" — ")
      .slice(1)
      .join(" — ")
      .replace(/ ETF Data$/i, "")
      .replace(/ Bond Data$/i, "")
      .trim();
  }
  return doc.name;
}


export function FactsheetFundoTab() {
  const [docs, setDocs] = useState<FundDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<FundDoc | null>(null);
  const [leftWidth, setLeftWidth] = useState(340);
  const isDragging = useRef(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, fund_name, period, category, file_url")
        .in("category", FUND_CATEGORIES as unknown as string[])
        .eq("status", "indexed")
        .order("name");
      if (!error) setDocs((data as FundDoc[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(500, Math.max(220, ev.clientX));
      setLeftWidth(newWidth);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase();
    const displayName = getDisplayName(d).toLowerCase();
    return displayName.includes(q) || (d.fund_name?.toLowerCase().includes(q) ?? false) || d.name.toLowerCase().includes(q);
  });

  const groups = Object.entries(GROUP_CONFIG)
    .map(([key, cfg]) => ({
      key,
      label: cfg.label,
      items: filtered.filter((d) => cfg.categories.includes(d.category ?? "other")),
    }))
    .filter((g) => g.items.length > 0);

  const fundLabel = selectedDoc ? getDisplayName(selectedDoc) : "";
  const hasFileUrl = !!selectedDoc?.file_url;

  const openGoogleSearch = () => {
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(fundLabel + " factsheet PDF")}`,
      "_blank"
    );
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)" }}>
      <style>{`
        .fund-list::-webkit-scrollbar { width: 4px; }
        .fund-list::-webkit-scrollbar-track { background: transparent; }
        .fund-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        .fund-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
      `}</style>

      {/* Left column: fund list */}
      <div
        className="pr-3 fund-list"
        style={{
          width: leftWidth,
          flexShrink: 0,
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.15) transparent",
        }}
      >
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Factsheet Fundo</h3>
            <p className="text-sm text-muted-foreground">Selecione um fundo para visualizar</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome do fundo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando fundos...</span>
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum fundo encontrado{search ? ` para "${search}"` : ""}.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.items.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          selectedDoc?.id === doc.id
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{getDisplayName(doc)}</span>
                        {doc.period && <span className="shrink-0 text-[10px] text-muted-foreground">{doc.period}</span>}
                        {doc.file_url && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-green-600 border-green-300">PDF</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drag handle divider */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 4,
          flexShrink: 0,
          cursor: "col-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
        }}
        className="bg-border hover:bg-primary/30 transition-colors"
      >
        <span className="text-muted-foreground text-[10px] select-none" style={{ lineHeight: 1 }}>⋮</span>
      </div>

      {/* Right column: always visible */}
      <div style={{ flex: 1 }} className="flex flex-col min-w-0">
        {!selectedDoc ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Selecione um fundo na lista para ver o factsheet</p>
          </div>
        ) : hasFileUrl ? (
          <>
            <div className="px-4 py-3 shrink-0 border-b border-border">
              <h2 className="text-base font-semibold text-foreground truncate">{fundLabel}</h2>
            </div>
            <iframe
              key={selectedDoc.id}
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedDoc.file_url!)}&embedded=true`}
              width="100%"
              style={{ flex: 1, border: "none", minHeight: "600px" }}
              title={fundLabel}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{fundLabel}</p>
              <p className="text-xs text-muted-foreground">Factsheet não disponível na Biblioteca</p>
            </div>
            <Button onClick={openGoogleSearch} size="lg" variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Buscar no Google
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
