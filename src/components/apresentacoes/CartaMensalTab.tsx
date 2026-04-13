import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PERIODS = ["Janeiro 2026", "Fevereiro 2026", "Março 2026", "Abril 2026"];
const PORTFOLIOS = ["Conservative", "Income", "Balanced", "Growth"];

export function CartaMensalTab() {
  const [mode, setMode] = useState<string>("mercado");
  const [period, setPeriod] = useState("");
  const [clientName, setClientName] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [generating, setGenerating] = useState(false);
  const [letterContent, setLetterContent] = useState("");
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    if (!period) {
      toast.error("Selecione o período");
      return;
    }
    if (mode === "portfolio" && (!clientName.trim() || !portfolio)) {
      toast.error("Preencha o nome do cliente e selecione o portfólio");
      return;
    }

    const query =
      mode === "mercado"
        ? `Gere uma carta mensal formal em português brasileiro para clientes da Galapagos Capital Advisory referente a ${period}. Estrutura obrigatória com estas seções exatas: 'Prezados Clientes,', 'Cenário de Mercado', 'Portfólios Modelo', 'Movimentos Táticos', 'Perspectivas', 'Atenciosamente, Equipe Galapagos Capital Advisory'. Use linguagem institucional. Base-se nos documentos disponíveis.`
        : `Gere uma carta mensal formal em português brasileiro para o cliente ${clientName} da Galapagos Capital Advisory referente a ${period}. Portfólio: ${portfolio}. Estrutura: saudação personalizada, desempenho do portfólio no mês, composição atual, destaques, perspectivas, encerramento formal. Linguagem institucional.`;

    setGenerating(true);
    setLetterContent("");
    setDone(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

      abortRef.current = new AbortController();

      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query, filter_type: "all" }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
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
              content += event.text;
              setLetterContent(content);
            }
          } catch {
            // partial JSON
          }
        }
      }

      setDone(true);
      toast.success("Carta gerada com sucesso!");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(err.message || "Erro ao gerar carta");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 40px; line-height: 1.8; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #173C82; padding-bottom: 20px; margin-bottom: 40px; }
  .logo-text { font-size: 22px; font-weight: bold; color: #173C82; letter-spacing: 2px; }
  .logo-sub { font-size: 11px; color: #0071BB; letter-spacing: 4px; margin-top: 2px; }
  .date { font-size: 12px; color: #666; text-align: right; }
  .body { white-space: pre-wrap; }
  .footer { margin-top: 60px; border-top: 1px solid #e0e0e0; padding-top: 16px; font-size: 10px; color: #888; text-align: center; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="logo-text">GALAPAGOS</div>
    <div class="logo-sub">CAPITAL ADVISORY</div>
  </div>
  <div class="date">Miami, FL · ${period}<br/>Uso Exclusivo do Cliente · Confidencial</div>
</div>
<div class="body">${letterContent}</div>
<div class="footer">Galapagos Capital Advisory LLC · Miami, FL · Este documento é confidencial e de uso exclusivo do destinatário.</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  return (
    <div style={{ display: "flex", gap: "24px", minHeight: "500px" }}>
      {/* Left: Controls */}
      <div style={{ width: "340px", flexShrink: 0 }}>
        <Card>
          <CardContent className="p-5 space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Tipo de Carta</label>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(v) => v && setMode(v)}
                className="w-full"
              >
                <ToggleGroupItem value="mercado" className="flex-1 text-xs">
                  Carta de Mercado
                </ToggleGroupItem>
                <ToggleGroupItem value="portfolio" className="flex-1 text-xs">
                  Carta de Portfólio
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Período</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === "portfolio" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Nome do Cliente</label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Portfólio</label>
                  <Select value={portfolio} onValueChange={setPortfolio}>
                    <SelectTrigger><SelectValue placeholder="Selecione o portfólio" /></SelectTrigger>
                    <SelectContent>
                      {PORTFOLIOS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando carta...
                </>
              ) : (
                "Gerar Carta"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right: Letter content */}
      <div className="flex-1 min-w-0">
        <Card className="h-full">
          <CardContent className="p-6 h-full flex flex-col">
            {!letterContent && !generating ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Configure os parâmetros e clique em "Gerar Carta"
                </p>
              </div>
            ) : (
              <>
                <div
                  className="flex-1 overflow-y-auto prose prose-sm max-w-none"
                  style={{
                    fontFamily: "Georgia, serif",
                    lineHeight: 1.8,
                    scrollbarWidth: "thin",
                    scrollbarColor: "hsl(var(--muted-foreground) / 0.2) transparent",
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {letterContent}
                  </ReactMarkdown>
                  {generating && (
                    <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                  )}
                </div>
                {done && (
                  <div className="pt-4 border-t border-border mt-4 shrink-0">
                    <Button onClick={handleDownloadPDF} className="w-full" variant="outline">
                      <FileDown className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
