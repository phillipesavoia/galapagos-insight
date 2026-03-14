import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Copy, Download, Edit, ArrowRight } from "lucide-react";

const tabs = ["Carta Mensal", "Resumo de Fundo", "Comparativo"] as const;
type Tab = (typeof tabs)[number];

const mockFunds = [
  "Macro Global",
  "Crédito Plus",
  "Total Return",
  "Equity Long Short",
  "EM Debt Opportunities",
];

const mockLetter = `Prezado(a) Ricardo,

Gostaríamos de compartilhar um resumo do desempenho dos fundos em destaque referente ao mês de Fevereiro de 2025.

**Cenário Macroeconômico**

O mês de fevereiro foi marcado pela manutenção da taxa de juros pelo Federal Reserve em 5.25-5.50%, em linha com as expectativas do mercado. Os spreads de crédito continuaram comprimidos, com o índice CDX IG fechando em 52 bps. Observamos oportunidades seletivas em mercados emergentes, especialmente em crédito soberano latino-americano.

**Galapagos Macro Global**

O fundo encerrou o mês com retorno de +1.47%, acumulando +3.32% no ano. As principais contribuições vieram de posições em juros nominais americanos (+0.62%) e crédito high yield (+0.41%). A volatilidade realizada permaneceu controlada em 5.8% a.a.

**Galapagos Crédito Plus**

Retorno mensal de +0.93%, com destaque para a alocação em CLOs de classe AA (+0.31%) e títulos investment grade de duration curta (+0.28%). O spread médio da carteira encerrou em 172 bps sobre treasuries.

**Perspectivas**

Mantemos visão construtiva para ativos de risco, com preferência por crédito de qualidade e exposição seletiva a duration. Continuamos monitorando sinais de desaceleração no mercado de trabalho americano como indicador para eventual corte de juros.

Ficamos à disposição para discutir em maior detalhe.

Atenciosamente,
Equipe Galapagos Capital Advisory`;

export default function Generator() {
  const [activeTab, setActiveTab] = useState<Tab>("Carta Mensal");
  const [clientName, setClientName] = useState("Ricardo Almeida");
  const [period, setPeriod] = useState("2025-02");
  const [selectedFunds, setSelectedFunds] = useState(["Macro Global", "Crédito Plus"]);
  const [tone, setTone] = useState("Neutro");
  const [macroContext, setMacroContext] = useState("Fed em pausa, spreads comprimidos, oportunidades em EM...");
  const [showPreview, setShowPreview] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Tab B state
  const [fundB, setFundB] = useState("Macro Global");
  const [periodB, setPeriodB] = useState("2025-02");
  const [recipientB, setRecipientB] = useState("Cliente");

  // Tab C state
  const [fundC1, setFundC1] = useState("Macro Global");
  const [fundC2, setFundC2] = useState("Crédito Plus");
  const [fundC3, setFundC3] = useState("");
  const [criteria, setCriteria] = useState("Retorno");

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowPreview(true);
    }, 1500);
  };

  const periodLabel = (() => {
    const [y, m] = period.split("-");
    const months = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${months[parseInt(m)]} ${y}`;
  })();

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

        {activeTab === "Carta Mensal" && (
          <div className="flex gap-6">
            {/* Form */}
            <div className="w-96 shrink-0 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nome do cliente</label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Período</label>
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                />
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
                <select
                  onChange={(e) => {
                    if (e.target.value && !selectedFunds.includes(e.target.value)) {
                      setSelectedFunds((p) => [...p, e.target.value]);
                    }
                    e.target.value = "";
                  }}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  defaultValue=""
                >
                  <option value="" disabled>Adicionar fundo...</option>
                  {mockFunds.filter((f) => !selectedFunds.includes(f)).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tom desejado</label>
                <div className="flex gap-1 bg-secondary rounded-lg p-1">
                  {["Neutro", "Otimista", "Cauteloso"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`flex-1 px-3 py-2 rounded-md text-xs transition-colors ${
                        tone === t ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Contexto macro adicional</label>
                <textarea
                  value={macroContext}
                  onChange={(e) => setMacroContext(e.target.value)}
                  rows={3}
                  placeholder="Ex: Fed em pausa, spreads comprimidos, oportunidades em EM..."
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>

              <button onClick={handleGenerate} className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                Gerar Carta <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
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
                {isGenerating ? (
                  <div className="space-y-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="h-4 bg-secondary rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    ))}
                  </div>
                ) : showPreview ? (
                  <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{mockLetter}</div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-20">Clique em "Gerar Carta" para visualizar o documento.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Resumo de Fundo" && (
          <div className="flex gap-6">
            <div className="w-96 shrink-0 space-y-4">
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
              <button onClick={handleGenerate} className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                Gerar Resumo <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 bg-card border border-border rounded-xl p-6">
              <p className="text-sm text-muted-foreground text-center py-20">Selecione um fundo e clique em "Gerar Resumo" para visualizar.</p>
            </div>
          </div>
        )}

        {activeTab === "Comparativo" && (
          <div className="flex gap-6">
            <div className="w-96 shrink-0 space-y-4">
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
              <button onClick={handleGenerate} className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                Gerar Comparativo <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 bg-card border border-border rounded-xl p-6">
              <p className="text-sm text-muted-foreground text-center py-20">Selecione os fundos e clique em "Gerar Comparativo" para visualizar.</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
