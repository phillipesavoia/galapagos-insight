import { useState, useEffect, useRef } from "react";
import { Search, FileText, Loader2, ChevronRight, ExternalLink, Download, X } from "lucide-react";
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
  if (doc.fund_name && doc.fund_name.length > 15 && !doc.fund_name.match(/^[A-Z0-9]{10,}$/)) {
    return doc.fund_name;
  }
  if (doc.name.includes(" — ")) {
    return doc.name.split(" — ").slice(1).join(" — ").replace(/ (ETF|Bond) Data$/, "").trim();
  }
  return doc.name;
}

function isSupabaseUrl(url: string): boolean {
  return url.includes("supabase.co");
}

export function FactsheetFundoTab() {
  const [docs, setDocs] = useState<FundDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<FundDoc | null>(null);

  // PDF panel state
  const [showPdfPanel, setShowPdfPanel] = useState(false);

  // No-URL fallback state
  const [summaryContent, setSummaryContent] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase();
    const displayName = getDisplayName(d).toLowerCase();
    return (
      displayName.includes(q) ||
      (d.fund_name?.toLowerCase().includes(q) ?? false) ||
      d.name.toLowerCase().includes(q)
    );
  });

  const groups = Object.entries(GROUP_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    items: filtered.filter((d) => cfg.categories.includes(d.category ?? "other")),
  })).filter((g) => g.items.length > 0);

  const fundLabel = selectedDoc ? getDisplayName(selectedDoc) : "";

  const handleViewFactsheet = () => {
    if (!selectedDoc) return;
    if (selectedDoc.file_url) {
      setShowPdfPanel(true);
      setSummaryContent("");
    }
  };

  const handleSearchOnline = () => {
    const q = encodeURIComponent(fundLabel + " factsheet PDF");
    window.open(`https://www.google.com/search?q=${q}`, "_blank");
  };

  const handleFetchSummary = async () => {
    if (!selectedDoc || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryContent("");

    const query = `Resuma em 3 parágrafos o fundo ${fundLabel} com base nos documentos disponíveis. Seja conciso.`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query, filter_type: "factsheet" }),
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "delta" && event.text) {
              full += event.text;
              setSummaryContent(full);
            }
          } catch { /* partial */ }
        }
      }
    } catch (err) {
      console.error("Summary error:", err);
      setSummaryContent("Erro ao gerar resumo. Tente novamente.");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [summaryContent]);

  useEffect(() => {
    setShowPdfPanel(false);
    setSummaryContent("");
    setSummaryLoading(false);
  }, [selectedDoc?.id]);

  const canEmbedPdf = selectedDoc?.file_url ? isSupabaseUrl(selectedDoc.file_url) : false;

  return (
    <div className="flex gap-4 h-full">
      {/* Main content area */}
      <div className="flex-1 min-w-0 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Factsheet Fundo</CardTitle>
            <CardDescription>
              Selecione um fundo para visualizar sua factsheet ou buscar online
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected fund action — TOP */}
            {selectedDoc && (
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fundLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedDoc.period || "Período não definido"}
                    {selectedDoc.file_url ? " · PDF disponível" : " · Sem PDF"}
                  </p>
                </div>
                {selectedDoc.file_url ? (
                  <Button onClick={handleViewFactsheet} size="sm">
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Ver Factsheet
                  </Button>
                ) : (
                  <Button onClick={handleSearchOnline} size="sm" variant="outline">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Buscar Factsheet Online
                  </Button>
                )}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do fundo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
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
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {groups.map((group) => (
                  <div key={group.key}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {group.items.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {group.items.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => setSelectedDoc(doc)}
                          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                            selectedDoc?.id === doc.id
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">
                              {getDisplayName(doc)}
                            </span>
                            {doc.period && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {doc.period}
                              </span>
                            )}
                            {doc.file_url && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-green-600 border-green-300">
                                PDF
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* No-URL fallback: inline summary */}
        {selectedDoc && !selectedDoc.file_url && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumo do Fundo (RAG)</CardTitle>
              <CardDescription className="text-xs">
                Resumo gerado com base nos documentos indexados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!summaryContent && !summaryLoading && (
                <Button onClick={handleFetchSummary} size="sm" variant="secondary">
                  <Loader2 className="h-3.5 w-3.5 mr-1.5" />
                  Gerar Resumo
                </Button>
              )}
              {(summaryContent || summaryLoading) && (
                <div>
                  {summaryLoading && !summaryContent && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando resumo...
                    </div>
                  )}
                  <div
                    ref={contentRef}
                    className="prose prose-sm max-w-none max-h-[300px] overflow-y-auto text-foreground"
                  >
                    <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                      {summaryContent}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* PDF Panel (right side) */}
      {showPdfPanel && selectedDoc?.file_url && (
        <div className="w-[520px] shrink-0 border-l border-border flex flex-col h-full animate-in slide-in-from-right duration-300 bg-background">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "#173C82" }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                Factsheet
              </span>
              <span className="text-sm font-semibold text-white truncate">{fundLabel}</span>
            </div>
            <button
              onClick={() => setShowPdfPanel(false)}
              className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content: iframe for Supabase URLs, fallback card for external */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {canEmbedPdf ? (
              <iframe
                src={selectedDoc.file_url!}
                style={{ width: "100%", height: "100%", border: "none" }}
                title={`Factsheet - ${fundLabel}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-6" style={{ background: "#F4F7FB" }}>
                <FileText className="h-16 w-16 text-muted-foreground/40" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">{fundLabel}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Este documento não pode ser exibido inline — clique para abrir no navegador
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => window.open(selectedDoc.file_url!, "_blank")}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir Factsheet
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ background: "#F4F7FB", borderTop: "1px solid #d1dce8" }}>
            <a
              href={selectedDoc.file_url!}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </a>
            <button
              onClick={() => window.open(selectedDoc.file_url!, "_blank")}
              className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir em nova aba
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
