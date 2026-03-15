import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioTab } from "@/components/dashboard/PortfolioTab";

const portfolios = ["Conservative", "Income", "Balanced", "Growth"] as const;

export type PortfolioName = (typeof portfolios)[number];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("Conservative");

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Performance Analítica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evolução de NAV e composição dos modelos de portfólio
          </p>
        </div>

        {/* Tabs */}
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
                <PortfolioTab portfolio={p} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
