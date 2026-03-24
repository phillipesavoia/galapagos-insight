import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { Download } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { filterByPeriod, type NavDataPoint } from "@/lib/utils";
import { PORTFOLIOS, type PortfolioName } from "@/lib/constants";
import type { Period } from "@/components/dashboard/PeriodFilter";
import { ReportPreview } from "@/components/reports/ReportPreview";

const portfolios: readonly PortfolioName[] = PORTFOLIOS;
const periods: { label: string; value: Period }[] = [
  { label: "1 Mês", value: "1M" },
  { label: "YTD", value: "YTD" },
  { label: "12 Meses", value: "12M" },
  { label: "Máximo", value: "Máx" },
];


export default function Reports() {
  const [clientName, setClientName] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioName>("Conservative");
  const [period, setPeriod] = useState<Period>("YTD");
  const [comment, setComment] = useState("");
  const [navData, setNavData] = useState<NavDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState<"novo" | "historico">("novo");
  const [generatedReports, setGeneratedReports] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (historyTab !== "historico") return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      const { data } = await supabase
        .from("generated_reports")
        .select("id, name, period, created_at, content")
        .order("created_at", { ascending: false })
        .limit(50);
      setGeneratedReports(data || []);
      setLoadingHistory(false);
    };
    fetchHistory();
  }, [historyTab]);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Relatorio_${portfolio}_${clientName || "Cliente"}`,
  });

  useEffect(() => {
    const fetchNav = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("daily_navs")
        .select("date, nav, daily_return, ytd_return")
        .eq("portfolio_name", portfolio)
        .order("date", { ascending: true })
        .limit(1000);
      if (error) {
        console.error("Error fetching NAVs:", error);
        setNavData([]);
      } else {
        setNavData(
          (data || []).map((r: any) => ({
            date: r.date,
            nav: Number(r.nav),
            daily_return: r.daily_return != null ? Number(r.daily_return) : null,
            ytd_return: r.ytd_return != null ? Number(r.ytd_return) : null,
          }))
        );
      }
      setLoading(false);
    };
    fetchNav();
  }, [portfolio]);

  const filtered = useMemo(() => filterByPeriod(navData, period), [navData, period]);

  const periodLabel = periods.find((p) => p.value === period)?.label || period;

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Relatório de Portfólio
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monte relatórios personalizados para seus clientes
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setHistoryTab("novo")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                historyTab === "novo"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
              }`}
            >
              Novo relatório
            </button>
            <button
              onClick={() => setHistoryTab("historico")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                historyTab === "historico"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
              }`}
            >
              Histórico
            </button>
          </div>
        </div>

        {historyTab === "novo" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-6 p-6 min-h-full">
            {/* Left: Controls */}
            <div className="w-80 shrink-0 space-y-5">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Configuração</h2>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Nome do Cliente (opcional)
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Portfólio
                  </label>
                  <select
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value as PortfolioName)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {portfolios.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Período
                  </label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as Period)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {periods.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Comentário de Mercado
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Cole aqui o resumo de mercado gerado pela IA ou escreva seu próprio comentário..."
                    rows={8}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                </div>
              </div>

              <button
                onClick={() => handlePrint()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Exportar para PDF
              </button>
            </div>

            {/* Right: A4 Preview */}
            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-[210mm]">
                <ReportPreview
                  ref={printRef}
                  portfolio={portfolio}
                  clientName={clientName}
                  periodLabel={periodLabel}
                  data={filtered}
                  loading={loading}
                  comment={comment}
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {historyTab === "historico" && (
          <div className="flex-1 overflow-y-auto p-6">
            {loadingHistory ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : generatedReports.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum relatório gerado ainda.</div>
            ) : (
              <div className="space-y-3">
                {generatedReports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{report.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {report.period} · {new Date(report.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const win = window.open("", "_blank");
                        win?.document.write(`<pre style="font-family:sans-serif;padding:2rem;white-space:pre-wrap">${report.content}</pre>`);
                      }}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      Ver relatório
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
