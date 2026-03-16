import { useState, useEffect } from "react";
import type { Period } from "@/components/dashboard/PeriodFilter";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioTab } from "@/components/dashboard/PortfolioTab";
import { supabase } from "@/integrations/supabase/client";

const portfolios = ["Conservative", "Income", "Balanced", "Growth"] as const;
export type PortfolioName = (typeof portfolios)[number];

export interface NavDataPoint {
  date: string;
  nav: number;
  daily_return: number | null;
  ytd_return: number | null;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("Conservative");
  const [period, setPeriod] = useState<Period>("YTD");
  const [navData, setNavData] = useState<NavDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Performance Analítica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evolução de NAV e composição dos modelos de portfólio
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-secondary/50 border border-border">
              {portfolios.map((p) => (
                <TabsTrigger
                  key={p}
                  value={p}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                >
                  {p}
                </TabsTrigger>
              ))}
            </TabsList>

            {portfolios.map((p) => (
              <TabsContent key={p} value={p} className="mt-5">
                <PortfolioTab portfolio={p} navData={navData} loading={loading} period={period} onPeriodChange={setPeriod} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
