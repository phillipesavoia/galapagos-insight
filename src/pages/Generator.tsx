import { useState, useMemo, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Copy, Download, Edit, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { marked } from "marked";
import html2pdf from "html2pdf.js";

const tabs = ["Carta Mensal", "Resumo de Fundo", "Comparativo"] as const;
type Tab = (typeof tabs)[number];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-semibold text-neon-orange uppercase tracking-widest mb-1.5 font-mono">{label}</label>
      {children}
    </div>
  );
}

function ToggleGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-0.5 glass-card rounded-xl p-0.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono font-medium transition-colors ${value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{o}</button>
      ))}
    </div>
  );
}

const MODEL_PORTFOLIOS = [
  "Conservative",
  "Income",
  "Balanced",
  "Growth",
  "Aggressive",
  "Tactical",
];

export default function Generator() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [fundNames] = useState<string[]>(MODEL_PORTFOLIOS);
  const [activeTab, setActiveTab] = useState<Tab>("Carta Mensal");
  const [clientName, setClientName] = useState("Ricardo Almeida");
  const [period, setPeriod] = useState("2025-02");
  const [selectedFunds, setSelectedFunds] = useState<string[]>([]);
  const [tone, setTone] = useState("Neutro");
  const [macroContext, setMacroContext] = useState("Fed em pausa, spreads comprimidos, oportunidades em EM...");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [fundB, setFundB] = useState("");
  const [periodB, setPeriodB] = useState("2025-02");
  const [recipientB, setRecipientB] = useState("Cliente");
  const [generatedB, setGeneratedB] = useState("");

  const [fundC1, setFundC1] = useState("");
  const [fundC2, setFundC2] = useState("");
  const [fundC3, setFundC3] = useState("");
  const [criteria, setCriteria] = useState("Retorno");
  const [generatedC, setGeneratedC] = useState("");

  const handleGenerate = async () => {
    setIsGenerating(true);
    const setSetter = activeTab === "Carta Mensal" ? setGeneratedContent : activeTab === "Resumo de Fundo" ? setGeneratedB : setGeneratedC;
    setSetter("");

    try {
      let body: Record<string, unknown> = {};

      if (activeTab === "Carta Mensal") {
        body = { type: "carta_mensal", client_name: clientName, period, funds: selectedFunds, tone, macro_context: macroContext };
      } else if (activeTab === "Resumo de Fundo") {
        body = { type: "resumo_fundo", funds: [fundB], period: periodB, recipient: recipientB };
      } else {
        body = { type: "comparativo", funds: [fundC1, fundC2, fundC3].filter(Boolean), tone: criteria };
      }

      const { data: { session } } = await supabase.auth.getSession();
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`,
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
      toast({ title: "Copied!", description: "Content copied to clipboard." });
    } catch {
      toast({ title: "Copy error", variant: "destructive" });
    }
  };

  const handleExportPDF = async () => {
    if (!previewRef.current || !currentContent) return;

    const clone = document.createElement("div");
    clone.style.cssText = `font-family: 'Georgia', serif; font-size: 12px; line-height: 1.6; color: #1a1a1a; background: #ffffff; padding: 20px; max-width: 700px;`;

    const header = document.createElement("div");
    header.style.cssText = `display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0a1f44; padding-bottom: 12px; margin-bottom: 24px;`;
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
      toast({ title: "PDF exported successfully!" });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({ title: "PDF export error", variant: "destructive" });
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
            <div key={i} className="h-4 bg-white/[0.03] rounded-lg animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
          ))}
        </div>
      );
    }
    if (currentContent) {
      return (
        <div
          className="prose prose-invert prose-sm max-w-none text-foreground/80 text-justify"
          dangerouslySetInnerHTML={{ __html: parsedHtml }}
        />
      );
    }
    const labels: Record<Tab, string> = {
      "Carta Mensal": 'Click "Generate" to preview the document.',
      "Resumo de Fundo": 'Select a fund and click "Generate" to preview.',
      "Comparativo": 'Select funds and click "Generate" to preview.',
    };
    return <p className="text-xs text-muted-foreground/50 text-center py-20 font-mono">{labels[activeTab]}</p>;
  };

  const buttonLabels: Record<Tab, string> = {
    "Carta Mensal": "Generate",
    "Resumo de Fundo": "Generate",
    "Comparativo": "Generate",
  };

  return (
    <Layout>
      <div className="p-6 animate-fade-up">
        {/* Tab selector */}
        <div className="flex gap-0.5 mb-5 glass-card rounded-xl p-0.5 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-mono font-medium transition-colors uppercase tracking-wider ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-5">
          {/* Form */}
          <div className="w-72 shrink-0 space-y-4">
            {activeTab === "Carta Mensal" && (
              <>
                <Field label="Client Name">
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="field-input font-mono text-xs rounded-xl" />
                </Field>
                <Field label="Period">
                  <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="field-input font-mono text-xs rounded-xl [color-scheme:dark]" />
                </Field>
                <Field label="Featured Funds">
                  {selectedFunds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {selectedFunds.map((f) => (
                        <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-mono font-medium">
                          {f}
                          <button onClick={() => setSelectedFunds((p) => p.filter((x) => x !== f))} className="hover:text-primary-foreground ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select onChange={(e) => { if (e.target.value && !selectedFunds.includes(e.target.value)) setSelectedFunds((p) => [...p, e.target.value]); e.target.value = ""; }} className="field-input text-muted-foreground font-mono text-xs rounded-xl" defaultValue="">
                    <option value="" disabled>Add fund...</option>
                    {fundNames.filter((f) => !selectedFunds.includes(f)).map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                </Field>
                <Field label="Tone">
                  <ToggleGroup options={["Neutro", "Otimista", "Cauteloso"]} value={tone} onChange={setTone} />
                </Field>
                <Field label="Macro Context">
                  <textarea value={macroContext} onChange={(e) => setMacroContext(e.target.value)} rows={2} placeholder="Ex: Fed on pause, spreads compressed..." className="field-input resize-none font-mono text-xs rounded-xl" />
                </Field>
              </>
            )}

            {activeTab === "Resumo de Fundo" && (
              <>
                <Field label="Fund">
                  <select value={fundB} onChange={(e) => setFundB(e.target.value)} className="field-input font-mono text-xs rounded-xl">
                    {fundNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Period">
                  <input type="month" value={periodB} onChange={(e) => setPeriodB(e.target.value)} className="field-input font-mono text-xs rounded-xl [color-scheme:dark]" />
                </Field>
                <Field label="Recipient">
                  <ToggleGroup options={["Cliente", "Assessor", "Interno"]} value={recipientB} onChange={setRecipientB} />
                </Field>
              </>
            )}

            {activeTab === "Comparativo" && (
              <>
                <Field label="Fund A">
                  <select value={fundC1} onChange={(e) => setFundC1(e.target.value)} className="field-input font-mono text-xs rounded-xl">
                    {fundNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Fund B">
                  <select value={fundC2} onChange={(e) => setFundC2(e.target.value)} className="field-input font-mono text-xs rounded-xl">
                    {fundNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Fund C (optional)">
                  <select value={fundC3} onChange={(e) => setFundC3(e.target.value)} className="field-input font-mono text-xs rounded-xl">
                    <option value="">+ Add</option>
                    {fundNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Criteria">
                  <ToggleGroup options={["Retorno", "Risco", "Liquidez", "Correlação"]} value={criteria} onChange={setCriteria} />
                </Field>
              </>
            )}

            <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-[10px] font-mono font-semibold uppercase tracking-widest hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {isGenerating ? "Generating..." : buttonLabels[activeTab]} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1 glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <h3 className="text-[10px] font-mono font-semibold text-neon-orange tracking-widest uppercase">Galapagos Capital · {periodLabel}</h3>
              <div className="flex gap-1.5">
                <button onClick={handleCopy} disabled={!currentContent} className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-card text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                  <Copy className="h-3 w-3" strokeWidth={2} /> Copy
                </button>
                <button onClick={handleExportPDF} disabled={!currentContent} className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-card text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                  <Download className="h-3 w-3" strokeWidth={2} /> PDF
                </button>
                <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-card text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                  <Edit className="h-3 w-3" strokeWidth={2} /> Edit
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
