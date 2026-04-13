import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Loader2, ExternalLink, Download, X, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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

function extractTicker(name: string): string | null {
  const match = name.match(/\b([A-Z]{2,6})\s*(LN|LX|ID|SW|US|GR|NA|IM|FP)?\b/);
  return match ? match[0].trim() : null;
}

function isSupabaseUrl(url: string): boolean {
  return url.includes("supabase.co/storage");
}

export function FactsheetFundoTab() {
  const [docs, setDocs] = useState<FundDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<FundDoc | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const [listWidth, setListWidth] = useState(440);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = listWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setListWidth(Math.min(600, Math.max(280, startWidth + (ev.clientX - startX))));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [listWidth]);

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

  // When selectedDoc changes, resolve the iframe URL
  useEffect(() => {
    if (!selectedDoc?.file_url) {
      setIframeUrl(null);
      return;
    }

    const url = selectedDoc.file_url;
    const isPdf = url.toLowerCase().includes(".pdf");

    if (!isPdf) {
      setIframeUrl(null);
      return;
    }

    if (isSupabaseUrl(url)) {
      // Extract bucket and path from the URL to create a fresh signed URL
      // URL format: https://<ref>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
      // or: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
      const storageMatch = url.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/(.+?)(?:\?|$)/);
      if (storageMatch) {
        const bucket = storageMatch[1];
        const path = decodeURIComponent(storageMatch[2]);
        supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
          if (data?.signedUrl) {
            setIframeUrl(data.signedUrl);
          } else {
            // Fallback to original URL
            setIframeUrl(url);
          }
        });
      } else {
        setIframeUrl(url);
      }
    } else {
      // External PDF — use Google Docs viewer
      setIframeUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`);
    }
  }, [selectedDoc]);

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
  const isDirectPdf = selectedDoc?.file_url?.toLowerCase().includes(".pdf") ?? false;

  const handleSelectFund = (doc: FundDoc) => {
    setSelectedDoc(doc);
  };

  const showPanel = !!selectedDoc;

  return (
    <div className="flex">
      {/* List panel */}
      <div className="min-w-0 space-y-4 pr-4" style={{ width: showPanel ? `${listWidth}px` : "100%", flexShrink: 0 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Factsheet Fundo</CardTitle>
            <CardDescription>Selecione um fundo para visualizar sua factsheet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome do fundo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            {/* Fund list */}
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
              <div className="space-y-4 pr-1">
                {groups.map((group) => (
                  <div key={group.key}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.items.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {group.items.map((doc) => {
                        const ticker = extractTicker(doc.name);
                        return (
                          <button
                            key={doc.id}
                            onClick={() => handleSelectFund(doc)}
                            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                              selectedDoc?.id === doc.id
                                ? "border-primary bg-primary/5 text-foreground"
                                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate font-medium">{getDisplayName(doc)}</span>
                              {ticker && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0 font-mono">{ticker}</Badge>
                              )}
                              {doc.period && <span className="shrink-0 text-[10px] text-muted-foreground">{doc.period}</span>}
                              {doc.file_url && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-green-600 border-green-300">PDF</Badge>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resize handle */}
      {showPanel && (
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 shrink-0 cursor-col-resize flex items-center justify-center hover:bg-accent transition-colors relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="flex flex-col items-center gap-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Right panel */}
      {showPanel && (
        <div className="flex-1 min-w-0 flex flex-col animate-in slide-in-from-right duration-300 bg-background">
          {/* Top bar */}
          <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-border">
            <span className="text-xs text-muted-foreground truncate min-w-0 mr-2">{fundLabel}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedDoc?.file_url && (
                <a
                  href={selectedDoc.file_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <Download className="h-3 w-3" />
                  Download PDF
                </a>
              )}
              <button
                onClick={() => setSelectedDoc(null)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {/* Case A: direct PDF with resolved iframe URL */}
            {selectedDoc?.file_url && isDirectPdf && iframeUrl ? (
              <iframe
                src={iframeUrl}
                style={{ width: "100%", height: "100%", border: "none", minHeight: "500px" }}
                title={fundLabel}
              />
            ) : selectedDoc?.file_url && isDirectPdf && !iframeUrl ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando PDF...</span>
              </div>
            ) : selectedDoc?.file_url && !isDirectPdf ? (
              /* Case B: webpage URL */
              <div className="flex flex-col items-center gap-4 px-6 text-center" style={{ paddingTop: "20%" }}>
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{fundLabel}</p>
                  <p className="text-xs text-muted-foreground">Factsheet disponível no site do gestor</p>
                </div>
                <Button onClick={() => window.open(selectedDoc.file_url!, "_blank")} size="lg">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Factsheet
                </Button>
              </div>
            ) : (
              /* Case C: no file_url */
              <div className="flex flex-col items-center gap-4 px-6 text-center" style={{ paddingTop: "20%" }}>
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{fundLabel}</p>
                  <p className="text-xs text-muted-foreground">Factsheet não disponível na Biblioteca</p>
                </div>
                <Button
                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(fundLabel + " factsheet PDF")}`, "_blank")}
                  size="lg"
                  variant="outline"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar no Google
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
