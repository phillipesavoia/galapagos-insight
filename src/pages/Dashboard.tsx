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
        <div className="px-8 pt-8 pb-5">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Performance
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            NAV evolution & portfolio composition
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-4 scrollbar-thin">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="glass-card border-white/5 rounded-xl p-0.5">
              {portfolios.map((p) => (
                <TabsTrigger
                  key={p}
                  value={p}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-mono rounded-lg px-4"
                >
                  {p}
                </TabsTrigger>
              ))}
            </TabsList>

            {portfolios.map((p) => (
              <TabsContent key={p} value={p} className="mt-6">
                <PortfolioTab portfolio={p} navData={navData} loading={loading} period={period} onPeriodChange={setPeriod} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
