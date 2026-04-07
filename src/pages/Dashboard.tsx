import { useState, useEffect, useMemo } from "react";
import type { Period } from "@/components/dashboard/PeriodFilter";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioTab } from "@/components/dashboard/PortfolioTab";
import { supabase } from "@/integrations/supabase/client";
import { PORTFOLIOS } from "@/lib/constants";
import { filterByPeriod, type NavDataPoint } from "@/lib/utils";
import { DownloadReportButton } from "@/components/DownloadReportButton";

const TRADING_DAYS = 252;

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("Conservative");
  const [period, setPeriod] = useState<Period>("YTD");
  const [selectedBenchmark, setSelectedBenchmark] = useState("");
  const [navData, setNavData] = useState<NavDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdings, setHoldings] = useState<{ ticker: string; name: string; asset_class: string; weight: number }[]>([]);

  useEffect(() => {
    const fetchNav = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("daily_navs")
        .select("date, nav, daily_return, ytd_return")
        .eq("portfolio_name", activeTab)
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
  }, [activeTab]);

  // Fetch holdings for current tab
  useEffect(() => {
    const fetchHoldings = async () => {
      const { data } = await supabase
        .from("asset_knowledge")
        .select("ticker, name, asset_class, weight_pct, portfolios")
        .contains("portfolios", [activeTab]);
      if (data) {
        setHoldings(
          data
            .map((a: any) => ({
              ticker: a.ticker,
              name: a.name,
              asset_class: a.asset_class,
              weight: (a.weight_pct as Record<string, number>)?.[activeTab] ?? 0,
            }))
            .filter((h) => h.weight > 0)
            .sort((a, b) => b.weight - a.weight)
        );
      }
    };
    fetchHoldings();
  }, [activeTab]);

  // Compute metrics for PPTX payload
  const filtered = useMemo(() => filterByPeriod(navData, period), [navData, period]);

  const cumulativeReturn = useMemo(() => {
    if (filtered.length < 2) return 0;
    const first = filtered[0].nav;
    const last = filtered[filtered.length - 1].nav;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [filtered]);

  const ytdReturn = useMemo(() => {
    const last = navData[navData.length - 1];
    return last?.ytd_return != null ? last.ytd_return * 100 : 0;
  }, [navData]);

  const volatility = useMemo(() => {
    if (filtered.length < 2) return 0;
    const returns = filtered
      .map((d) => d.daily_return)
      .filter((r): r is number => r !== null && !isNaN(r));
    if (returns.length < 2) return 0;
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
    return Math.sqrt(variance) / 100 * Math.sqrt(TRADING_DAYS) * 100;
  }, [filtered]);

  const pptxData = useMemo(() => {
    const compositionArr = holdings.map((h) => ({
      ticker: h.ticker,
      name: h.name,
      class: h.asset_class,
      weight: Number(h.weight.toFixed(2)),
    }));
    const top9 = compositionArr.slice(0, 9);
    return {
      performance: {
        month: Number(cumulativeReturn.toFixed(2)),
        ytd: Number(ytdReturn.toFixed(2)),
        rankYtd: 1,
      },
      volatility: Number(volatility.toFixed(2)),
      composition: compositionArr,
      lookthrough: {
        fixedIncome: top9.map((h) => ({
          name: h.name,
          ticker: h.ticker,
          portfolioWeight: h.weight,
        })),
      },
      grade: [
        { name: "Conservative", month: 1.38, ytd: 2.02, fi: 80, eq: 5, alts: 10, liq: 5, vol: 4, var: 6 },
        { name: "Income", month: 0.97, ytd: 2.10, fi: 60, eq: 20, alts: 15, liq: 5, vol: 5, var: 8 },
        { name: "Balanced", month: 0.50, ytd: 2.22, fi: 35, eq: 40, alts: 20, liq: 5, vol: 8, var: 12 },
        { name: "Growth", month: -0.09, ytd: 2.30, fi: 0, eq: 70, alts: 25, liq: 5, vol: 13, var: 20 },
      ],
    };
  }, [cumulativeReturn, ytdReturn, volatility, holdings]);

  const periodLabels: Record<string, string> = { "1M": "1 Mês", "YTD": "YTD", "12M": "12 Meses", "Máx": "Máximo" };

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                Performance Analítica
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Evolução de NAV e composição dos modelos de portfólio
              </p>
            </div>
            <DownloadReportButton
              portfolio={activeTab.toLowerCase()}
              month={periodLabels[period] || period}
              data={pptxData}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-secondary/50 border border-border">
              {PORTFOLIOS.map((p) => (
                <TabsTrigger
                  key={p}
                  value={p}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                >
                  {p}
                </TabsTrigger>
              ))}
            </TabsList>

            {PORTFOLIOS.map((p) => (
              <TabsContent key={p} value={p} className="mt-5">
                <PortfolioTab portfolio={p} navData={navData} loading={loading} period={period} onPeriodChange={setPeriod} selectedBenchmark={selectedBenchmark} onBenchmarkChange={setSelectedBenchmark} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
