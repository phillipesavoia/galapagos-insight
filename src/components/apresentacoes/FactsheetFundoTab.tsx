import { useState, useEffect, useRef } from "react";
import { Search, FileText, Loader2, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArtifactPanel, type ArtifactData } from "@/components/chat/ArtifactPanel";

interface FundDoc {
  id: string;
  name: string;
  fund_name: string | null;
  period: string | null;
  category: string | null;
}

const FUND_CATEGORIES = ["etf", "bond", "private_fund", "open_end_fund", "ucits", "other"] as const;

const GROUP_CONFIG: Record<string, { label: string; categories: string[] }> = {
  etfs: { label: "ETFs", categories: ["etf"] },
  bonds: { label: "Bonds", categories: ["bond"] },
  fundos: { label: "Fundos", categories: ["private_fund", "open_end_fund", "ucits", "other"] },
};

function detectArtifact(content: string): ArtifactData | null {
  if (!content || content.length < 200) return null;
  const headerCount = (content.match(/^#{1,3}\s+.+$/gm) || []).length;
  const tableRowCount = (content.match(/^\|.+\|$/gm) || []).length;
  const formalSections = [
    "resumo executivo", "performance", "composição", "composicao",
    "análise de risco", "analise de risco", "conclusão", "conclusao",
    "recomendação", "recomendacao", "retorno", "alocação", "alocacao",
    "carteira", "fundo", "portfólio", "portfolio", "gestão", "gestao",
    "estratégia", "estrategia",
  ];
  const lower = content.toLowerCase();
  const formalHits = formalSections.filter(s => lower.includes(s)).length;
  const isArtifact = headerCount >= 2 || tableRowCount >= 3 || formalHits >= 2 || (content.length >= 800 && headerCount >= 1);
  if (!isArtifact) return null;
  const firstHeader = content.match(/^#{1,3}\s+(.+)$/m);
  const title = firstHeader ? firstHeader[1].trim() : "Factsheet";
  return { title, content, artifact_type: "factsheet" };
}

export function FactsheetFundoTab() {
  const [docs, setDocs] = useState<FundDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<FundDoc | null>(null);
  const [analysisContent, setAnalysisContent] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [artifactPanel, setArtifactPanel] = useState<ArtifactData | null>(null);
  const [toolCalls, setToolCalls] = useState<Array<{ tool: string; input: any }>>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, fund_name, period, category")
        .in("category", FUND_CATEGORIES as unknown as string[])
        .eq("status", "indexed")
        .order("name");
      if (!error) setDocs((data as FundDoc[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase();
    return (
      (d.fund_name?.toLowerCase().includes(q) ?? false) ||
      d.name.toLowerCase().includes(q)
    );
  });

  const groups = Object.entries(GROUP_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    items: filtered.filter((d) => cfg.categories.includes(d.category ?? "other")),
  })).filter((g) => g.items.length > 0);

  const handleAnalyze = async () => {
    if (!selectedDoc) return;
    setAnalysisLoading(true);
    setAnalysisContent("");
    setArtifactPanel(null);
    setToolCalls([]);

    const fundLabel = selectedDoc.fund_name || selectedDoc.name;
    const query = `Faça uma análise completa do fundo ${fundLabel} com base nos documentos disponíveis. Inclua: estratégia, performance, composição, riscos e pontos de atenção. Gere um artifact com type='factsheet' com o resumo completo.`;

    let fullContent = "";
    let allToolCalls: Array<{ tool: string; input: any }> = [];

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
              fullContent += event.text;
              setAnalysisContent(fullContent);
            } else if (event.type === "tool_call") {
              allToolCalls = [...allToolCalls, { tool: event.tool, input: event.input }];
              setToolCalls(allToolCalls);
            }
          } catch {
            // partial JSON
          }
        }
      }

      // Detect artifact
      const vizTools = [
        "renderizar_grafico_barras", "renderizar_grafico_linha",
        "renderizar_pie_chart", "renderizar_tabela_retornos",
        "renderizar_flash_factsheet",
      ];
      const chartCalls = allToolCalls.filter(tc => vizTools.includes(tc.tool));
      const detected = detectArtifact(fullContent);
      if (detected) {
        const artifact = { ...detected, chartCalls: chartCalls.length > 0 ? chartCalls : undefined };
        setArtifactPanel(artifact);
      } else if (chartCalls.length > 0) {
        setArtifactPanel({
          title: chartCalls[0]?.input?.title || "Factsheet",
          content: fullContent,
          artifact_type: "factsheet",
          chartCalls,
        });
      }
    } catch (err) {
      console.error("Factsheet analysis error:", err);
      setAnalysisContent("Erro ao gerar análise. Tente novamente.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Scroll content as it streams
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [analysisContent]);

  return (
    <div className="flex gap-4 h-full">
      {/* Main content area */}
      <div className="flex-1 min-w-0 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Factsheet Fundo</CardTitle>
            <CardDescription>
              Selecione um fundo para gerar uma análise completa com base nos documentos indexados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                              {doc.fund_name || doc.name}
                            </span>
                            {doc.period && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {doc.period}
                              </span>
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

            {/* Selected fund action */}
            {selectedDoc && (
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {selectedDoc.fund_name || selectedDoc.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedDoc.period || "Período não definido"}
                  </p>
                </div>
                <Button onClick={handleAnalyze} disabled={analysisLoading} size="sm">
                  {analysisLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    "Gerar Análise"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inline analysis result */}
        {(analysisContent || analysisLoading) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {analysisLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {analysisLoading ? "Analisando documento..." : "Análise Completa"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={contentRef}
                className="prose prose-sm max-w-none max-h-[400px] overflow-y-auto text-foreground"
              >
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                  {analysisContent}
                </pre>
              </div>
              {artifactPanel && !analysisLoading && (
                <div className="mt-3 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setArtifactPanel(artifactPanel)}
                    className="text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Ver Relatório Completo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Artifact panel */}
      {artifactPanel && (
        <ArtifactPanel
          artifact={artifactPanel}
          onClose={() => setArtifactPanel(null)}
        />
      )}
    </div>
  );
}
