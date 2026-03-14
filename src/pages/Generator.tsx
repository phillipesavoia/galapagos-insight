import { useState, useMemo, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Copy, Download, Edit, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { marked } from "marked";
import html2pdf from "html2pdf.js";

const tabs = ["Carta Mensal", "Resumo de Fundo", "Comparativo"] as const;
type Tab = (typeof tabs)[number];

const mockFunds = [
  "Macro Global",
  "Crédito Plus",
  "Total Return",
  "Equity Long Short",
  "EM Debt Opportunities",
];

export default function Generator() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Carta Mensal");
  const [clientName, setClientName] = useState("Ricardo Almeida");
  const [period, setPeriod] = useState("2025-02");
  const [selectedFunds, setSelectedFunds] = useState(["Macro Global", "Crédito Plus"]);
  const [tone, setTone] = useState("Neutro");
  const [macroContext, setMacroContext] = useState("Fed em pausa, spreads comprimidos, oportunidades em EM...");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Tab B state
  const [fundB, setFundB] = useState("Macro Global");
  const [periodB, setPeriodB] = useState("2025-02");
  const [recipientB, setRecipientB] = useState("Cliente");
  const [generatedB, setGeneratedB] = useState("");

  // Tab C state
  const [fundC1, setFundC1] = useState("Macro Global");
  const [fundC2, setFundC2] = useState("Crédito Plus");
  const [fundC3, setFundC3] = useState("");
  const [criteria, setCriteria] = useState("Retorno");
  const [generatedC, setGeneratedC] = useState("");

  const handleGenerate = async () => {
    setIsGenerating(true);

    // Clear previous content for active tab
    const setSetter = activeTab === "Carta Mensal" ? setGeneratedContent : activeTab === "Resumo de Fundo" ? setGeneratedB : setGeneratedC;
    setSetter("");

    try {
      let body: Record<string, unknown> = {};

      if (activeTab === "Carta Mensal") {
        body = {
          type: "carta_mensal",
          client_name: clientName,
          period,
          funds: selectedFunds,
          tone,
          macro_context: macroContext,
        };
      } else if (activeTab === "Resumo de Fundo") {
        body = {
          type: "resumo_fundo",
          funds: [fundB],
          period: periodB,
          recipient: recipientB,
        };
      } else {
        body = {
          type: "comparativo",
          funds: [fundC1, fundC2, fundC3].filter(Boolean),
          tone: criteria,
        };
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/generate-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "delta") {
              fullContent += evt.text;
              setSetter(fullContent);
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      if (!fullContent) {
        setSetter("Erro ao gerar documento — resposta vazia.");
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao gerar documento", description: err instanceof Error ? err.message : "Tente novamente", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentContent = activeTab === "Carta Mensal" ? generatedContent : activeTab === "Resumo de Fundo" ? generatedB : generatedC;

  const handleCopy = async () => {
    if (!currentContent) return;
    try {
      await navigator.clipboard.writeText(currentContent);
      toast({ title: "Copiado!", description: "Conteúdo copiado para a área de transferência." });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleExportPDF = () => {
    if (!previewRef.current) return;
    const opt = {
      margin: [12, 16],
      filename: `${activeTab.replace(/ /g, "_")}_${period || "documento"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };
    html2pdf().set(opt).from(previewRef.current).save();
  };

  const periodLabel = (() => {
    const [y, m] = period.split("-");
    const months = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${months[parseInt(m)]} ${y}`;
  })();

  const parsedHtml = useMemo(() => {
    if (!currentContent) return "";
    return marked(currentContent) as string;
  }, [currentContent]);

  const renderPreview = () => {
    if (isGenerating && !currentContent) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-4 bg-secondary rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
          ))}
        </div>
      );
    }
    if (currentContent) {
      return (
        <div
          className="prose prose-invert prose-sm max-w-none text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: parsedHtml }}
        />
      );
    }
    const labels: Record<Tab, string> = {
      "Carta Mensal": 'Clique em "Gerar Carta" para visualizar o documento.',
      "Resumo de Fundo": 'Selecione um fundo e clique em "Gerar Resumo" para visualizar.',
      "Comparativo": 'Selecione os fundos e clique em "Gerar Comparativo" para visualizar.',
    };
    return <p className="text-sm text-muted-foreground text-center py-20">{labels[activeTab]}</p>;
  };

  const buttonLabels: Record<Tab, string> = {
    "Carta Mensal": "Gerar Carta",
    "Resumo de Fundo": "Gerar Resumo",
    "Comparativo": "Gerar Comparativo",
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Tab selector */}
        <div className="flex gap-1 mb-6 bg-secondary rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Form */}
          <div className="w-96 shrink-0 space-y-4">
            {activeTab === "Carta Mensal" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Nome do cliente</label>
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Período</label>
                  <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Fundos em destaque</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedFunds.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/15 text-primary text-xs">
                        {f}
                        <button onClick={() => setSelectedFunds((p) => p.filter((x) => x !== f))} className="hover:text-primary-foreground">×</button>
                      </span>
                    ))}
                  </div>
                  <select onChange={(e) => { if (e.target.value && !selectedFunds.includes(e.target.value)) setSelectedFunds((p) => [...p, e.target.value]); e.target.value = ""; }} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" defaultValue="">
                    <option value="" disabled>Adicionar fundo...</option>
                    {mockFunds.filter((f) => !selectedFunds.includes(f)).map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tom desejado</label>
                  <div className="flex gap-1 bg-secondary rounded-lg p-1">
                    {["Neutro", "Otimista", "Cauteloso"].map((t) => (
                      <button key={t} onClick={() => setTone(t)} className={`flex-1 px-3 py-2 rounded-md text-xs transition-colors ${tone === t ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Contexto macro adicional</label>
                  <textarea value={macroContext} onChange={(e) => setMacroContext(e.target.value)} rows={3} placeholder="Ex: Fed em pausa, spreads comprimidos..." className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
                </div>
              </>
            )}

            {activeTab === "Resumo de Fundo" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Fundo</label>
                  <select value={fundB} onChange={(e) => setFundB(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    {mockFunds.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Período</label>
                  <input type="month" value={periodB} onChange={(e) => setPeriodB(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Destinatário</label>
                  <div className="flex gap-1 bg-secondary rounded-lg p-1">
                    {["Cliente", "Assessor", "Interno"].map((r) => (
                      <button key={r} onClick={() => setRecipientB(r)} className={`flex-1 px-3 py-2 rounded-md text-xs transition-colors ${recipientB === r ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>{r}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "Comparativo" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Fundo A</label>
                  <select value={fundC1} onChange={(e) => setFundC1(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    {mockFunds.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Fundo B</label>
                  <select value={fundC2} onChange={(e) => setFundC2(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    {mockFunds.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Fundo C (opcional)</label>
                  <select value={fundC3} onChange={(e) => setFundC3(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    <option value="">+ Adicionar</option>
                    {mockFunds.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Critérios</label>
                  <div className="flex gap-1 bg-secondary rounded-lg p-1">
                    {["Retorno", "Risco", "Liquidez", "Correlação"].map((c) => (
                      <button key={c} onClick={() => setCriteria(c)} className={`flex-1 px-2 py-2 rounded-md text-xs transition-colors ${criteria === c ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>{c}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {isGenerating ? "Gerando..." : buttonLabels[activeTab]} <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Galapagos Capital Advisory · {periodLabel}</h3>
              <div className="flex gap-2">
                {[{ icon: Copy, label: "Copiar" }, { icon: Download, label: "Exportar PDF" }, { icon: Edit, label: "Editar" }].map(({ icon: Icon, label }) => (
                  <button key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-thin">
              {renderPreview()}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
