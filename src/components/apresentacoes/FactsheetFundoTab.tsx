import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Loader2, ExternalLink, X, GripVertical, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

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

const CATEGORY_LABELS: Record<string, string> = {
  etf: "ETF",
  bond: "Bond",
  private_fund: "Fundo Privado",
  open_end_fund: "Fundo Aberto",
  ucits: "UCITS",
  other: "Outro",
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

  // RAG summary state
  const [ragSummary, setRagSummary] = useState("");
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);

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

  // Reset RAG when fund changes
  useEffect(() => {
    setRagSummary("");
    setRagError(null);
    setRagLoading(false);
  }, [selectedDoc?.id]);

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
  const showPanel = !!selectedDoc;

  const handleGenerateRag = async () => {
    if (!selectedDoc) return;
    setRagLoading(true);
    setRagError(null);
    setRagSummary("");

    const prompt = `Faça um resumo completo do fundo "${fundLabel}". Inclua: estratégia, performance recente, composição da carteira, métricas de risco e qualquer informação relevante disponível nos documentos.`;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setRagError("Sessão expirada. Faça login novamente.");
        setRagLoading(false);
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            query: prompt,
            filter_fund: fundLabel,
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        throw new Error("Erro ao gerar resumo");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              accumulated += content;
              setRagSummary(accumulated);
            }
          } catch {
            // partial JSON, ignore
          }
        }
      }
    } catch (e) {
      setRagError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setRagLoading(false);
    }
  };

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
              <div className="space-y-4 pr-1">
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
                          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                            selectedDoc?.id === doc.id
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">{getDisplayName(doc)}</span>
                            {doc.period && <span className="shrink-0 text-[10px] text-muted-foreground">{doc.period}</span>}
                            {doc.file_url && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-green-600 border-green-300">PDF</Badge>
                            )}
                          </div>
                        </button>
                      ))}
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

      {/* Right panel — clean info card */}
      {showPanel && selectedDoc && (
        <div className="flex-1 min-w-0 animate-in slide-in-from-right duration-300">
          {/* Close button */}
          <div className="flex justify-end px-3 py-2">
            <button
              onClick={() => setSelectedDoc(null)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-6 pb-8 space-y-6">
            {/* Fund name + metadata */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground leading-tight">{fundLabel}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {selectedDoc.category && (
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[selectedDoc.category] ?? selectedDoc.category}
                  </Badge>
                )}
                {selectedDoc.period && <span>{selectedDoc.period}</span>}
              </div>
            </div>

            <Separator />

            {/* Action section */}
            <div className="space-y-3">
              {selectedDoc.file_url ? (
                <>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => window.open(selectedDoc.file_url!, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Factsheet PDF
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    O PDF abre diretamente no navegador
                  </p>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/search?q=${encodeURIComponent(fundLabel + " factsheet PDF")}`,
                        "_blank"
                      )
                    }
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Buscar Factsheet no Google
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Documento não indexado na Biblioteca
                  </p>
                </>
              )}
            </div>

            <Separator />

            {/* RAG Summary section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Resumo RAG</h3>

              {!ragSummary && !ragLoading && (
                <Button
                  variant="outline"
                  onClick={handleGenerateRag}
                  disabled={ragLoading}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Resumo
                </Button>
              )}

              {ragLoading && !ragSummary && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Gerando resumo...</span>
                </div>
              )}

              {ragError && (
                <p className="text-sm text-destructive">{ragError}</p>
              )}

              {ragSummary && (
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{ragSummary}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
