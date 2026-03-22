import { useState, useMemo, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Copy, Download, Edit, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { marked } from "marked";
import html2pdf from "html2pdf.js";

const tabs = ["Carta Mensal", "Resumo de Fundo", "Comparativo"] as const;
type Tab = (typeof tabs)[number];

export default function Generator() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [fundNames, setFundNames] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Carta Mensal");
  const [clientName, setClientName] = useState("Ricardo Almeida");

  useEffect(() => {
    const fetchFunds = async () => {
      const { data } = await supabase
        .from("documents")
        .select("fund_name")
        .eq("status", "indexed")
        .not("fund_name", "is", null);
      const names = [...new Set(data?.map((d) => d.fund_name).filter(Boolean))] as string[];
      setFundNames(names);
    };
    fetchFunds();
  }, []);
  const [period, setPeriod] = useState("2025-02");
  const [selectedFunds, setSelectedFunds] = useState<string[]>([]);
  const [tone, setTone] = useState("Neutro");
  const [macroContext, setMacroContext] = useState("Fed em pausa, spreads comprimidos, oportunidades em EM...");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Tab B state
  const [fundB, setFundB] = useState("");
  const [periodB, setPeriodB] = useState("2025-02");
  const [recipientB, setRecipientB] = useState("Cliente");
  const [generatedB, setGeneratedB] = useState("");

  // Tab C state
  const [fundC1, setFundC1] = useState("");
  const [fundC2, setFundC2] = useState("");
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

      const { data: { session } } = await supabase.auth.getSession();
      const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucWRhZmR6YnRncHdsZ2tlcHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDQwNjUsImV4cCI6MjA4OTA4MDA2NX0.YOC-K2Rp6Ns9e4-zKmG6MJh1oIVRtGC3fVBvy5uXZcY";

      const resp = await fetch(
        `https://unqdafdzbtgpwlgkepqh.supabase.co/functions/v1/generate-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || anonKey}`,
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

  const handleExportPDF = async () => {
    if (!previewRef.current || !currentContent) return;

    // Create a print-friendly clone with light theme
    const clone = document.createElement("div");
    clone.style.cssText = `
      font-family: 'Georgia', serif;
      font-size: 12px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      padding: 20px;
      max-width: 700px;
    `;

    // Header with logo
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0a1f44;
      padding-bottom: 12px;
      margin-bottom: 24px;
    `;
    const logo = document.createElement("img");
    logo.src = window.location.origin + "/galapagos-logo.png";
    logo.style.cssText = "height: 40px; width: auto;";
    const headerRight = document.createElement("div");
    headerRight.style.cssText = "text-align: right; font-size: 11px; color: #555;";
    headerRight.innerHTML = `<div style="font-weight:600;color:#0a1f44">${activeTab}</div><div>${periodLabel}</div>`;
    header.appendChild(logo);
    header.appendChild(headerRight);
    clone.appendChild(header);

    const body = document.createElement("div");
    body.innerHTML = parsedHtml;
    clone.appendChild(body);
    // Style all child elements for print
    clone.querySelectorAll("h1, h2, h3").forEach((el) => {
      (el as HTMLElement).style.color = "#111";
      (el as HTMLElement).style.marginTop = "16px";
      (el as HTMLElement).style.marginBottom = "8px";
    });
    clone.querySelectorAll("table").forEach((el) => {
      el.style.borderCollapse = "collapse";
      el.style.width = "100%";
      el.style.marginTop = "12px";
      el.style.marginBottom = "12px";
    });
    clone.querySelectorAll("th, td").forEach((el) => {
      (el as HTMLElement).style.border = "1px solid #ccc";
      (el as HTMLElement).style.padding = "6px 10px";
      (el as HTMLElement).style.fontSize = "11px";
      (el as HTMLElement).style.color = "#1a1a1a";
    });
    clone.querySelectorAll("th").forEach((el) => {
      (el as HTMLElement).style.backgroundColor = "#f0f0f0";
      (el as HTMLElement).style.fontWeight = "600";
    });

    document.body.appendChild(clone);

    try {
      const opt = {
        margin: [15, 15] as [number, number],
        filename: `${activeTab.replace(/ /g, "_")}_${period || "documento"}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      };
      await html2pdf().set(opt).from(clone).save();
      toast({ title: "PDF exportado com sucesso!" });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({ title: "Erro ao exportar PDF", variant: "destructive" });
    } finally {
      document.body.removeChild(clone);
    }
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
          className="prose prose-invert prose-sm max-w-none text-muted-foreground text-justify"
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
                    {fundNames.filter((f) => !selectedFunds.includes(f)).map((f) => (<option key={f} value={f}>{f}</option>))}
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
                    {fundNames.map((f) => <option key={f} value={f}>{f}</option>)}
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
                    {fundNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Fundo B</label>
                  <select value={fundC2} onChange={(e) => setFundC2(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    {fundNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Fundo C (opcional)</label>
                  <select value={fundC3} onChange={(e) => setFundC3(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    <option value="">+ Adicionar</option>
                    {fundNames.map((f) => <option key={f} value={f}>{f}</option>)}
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
                <button onClick={handleCopy} disabled={!currentContent} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} /> Copiar
                </button>
                <button onClick={handleExportPDF} disabled={!currentContent} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} /> Exportar PDF
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Edit className="h-3.5 w-3.5" strokeWidth={1.5} /> Editar
                </button>
              </div>
            </div>
            <div ref={previewRef} className="p-6 overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-thin">
              {renderPreview()}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
