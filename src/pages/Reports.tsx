import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { Download } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import type { NavDataPoint, PortfolioName } from "@/pages/Dashboard";
import type { Period } from "@/components/dashboard/PeriodFilter";
import { ReportPreview } from "@/components/reports/ReportPreview";

const portfolios: PortfolioName[] = ["Conservative", "Income", "Balanced", "Growth"];
const periods: { label: string; value: Period }[] = [
  { label: "1 Mês", value: "1M" },
  { label: "YTD", value: "YTD" },
  { label: "12 Meses", value: "12M" },
  { label: "Máximo", value: "Máx" },
];

function filterByPeriod(data: NavDataPoint[], period: Period): NavDataPoint[] {
  if (data.length === 0 || period === "Máx") return data;
  const lastDate = new Date(data[data.length - 1].date);
  let cutoff: Date;
  if (period === "YTD") {
    cutoff = new Date(lastDate.getFullYear(), 0, 1);
  } else {
    const months = period === "1M" ? 1 : period === "3M" ? 3 : 12;
    cutoff = new Date(lastDate);
    cutoff.setMonth(cutoff.getMonth() - months);
  }
  return data.filter((d) => d.date >= cutoff.toISOString().slice(0, 10));
}

export default function Reports() {
  const [clientName, setClientName] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioName>("Conservative");
  const [period, setPeriod] = useState<Period>("YTD");
  const [comment, setComment] = useState("");
  const [navData, setNavData] = useState<NavDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Gerador de Relatórios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monte relatórios personalizados para seus clientes
          </p>
        </div>

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
      </div>
    </Layout>
  );
}
