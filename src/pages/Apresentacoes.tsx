import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PORTFOLIOS } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";

const periods = ["Janeiro 2026", "Fevereiro 2026", "Março 2026"];

const tabs = [
  { value: "portfolio-pptx", label: "Portfólio PPTX" },
  { value: "factsheet-amc", label: "Factsheet AMC" },
  { value: "carta-mensal", label: "Carta Mensal" },
  { value: "comparativo", label: "Comparativo de Grade" },
  { value: "personalizado", label: "Personalizado" },
] as const;

const descriptions: Record<string, string> = {
  "portfolio-pptx": "Gere apresentações completas dos portfólios modelo em PowerPoint",
  "factsheet-amc": "Fichas detalhadas de cada AMC Galapagos (Fixed Income, Equities, Alternatives)",
  "carta-mensal": "Carta de mercado mensal gerada pelo Claude com base no relatório de gestão",
  "comparativo": "Tabela comparativa de todos os portfólios modelo em PowerPoint",
  "personalizado": "Descreva o que precisa e o Claude monta a apresentação",
};

export default function Apresentacoes() {
  const [portfolio, setPortfolio] = useState<string>("");
  const [period, setPeriod] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!portfolio || !period) {
      toast.error("Selecione o portfólio e o período");
      return;
    }

    setGenerating(true);
    try {
      const { data: holdings, error: holdingsError } = await supabase
        .from("asset_knowledge")
        .select("ticker, name, asset_class, weight_pct, amc_parent, portfolios")
        .contains("portfolios", [portfolio]);

      if (holdingsError) throw new Error(holdingsError.message);

      const composition = (holdings ?? [])
        .filter((h) => h.amc_parent === null && (h.weight_pct as any)?.[portfolio] > 0)
        .map((h) => ({
          name: h.name,
          class: h.asset_class,
          weight: (h.weight_pct as any)[portfolio],
        }));

      const lookthrough = (holdings ?? [])
        .filter((h) => h.amc_parent !== null && (h.weight_pct as any)?.[portfolio] > 0)
        .map((h) => ({
          name: h.name,
          ticker: h.ticker,
          portfolioWeight: (h.weight_pct as any)[portfolio],
          amc_parent: h.amc_parent,
        }));

      const { data: navData, error: navError } = await supabase
        .from("daily_navs")
        .select("ytd_return, daily_return")
        .eq("portfolio_name", portfolio)
        .order("date", { ascending: false })
        .limit(1);

      if (navError) throw new Error(navError.message);

      const payload = {
        portfolio: portfolio.toLowerCase(),
        month: period,
        data: {
          performance: {
            month: navData?.[0]?.daily_return ?? 0,
            ytd: navData?.[0]?.ytd_return ?? 0,
          },
          composition,
          lookthrough: { fixedIncome: lookthrough },
          attribution: [],
          synthesis: { strengths: [], risks: [] },
          grade: [
            { name: "Conservative", month: 1.38, ytd: 2.02, fi: 80, eq: 5, alts: 10, liq: 5, vol: 4, var: 6 },
            { name: "Income", month: 0.97, ytd: 2.10, fi: 60, eq: 20, alts: 15, liq: 5, vol: 5, var: 8 },
            { name: "Balanced", month: 0.50, ytd: 2.22, fi: 35, eq: 40, alts: 20, liq: 5, vol: 8, var: 12 },
            { name: "Growth", month: -0.09, ytd: 2.30, fi: 0, eq: 70, alts: 25, liq: 5, vol: 13, var: 20 },
          ],
        },
      };

      const response = await fetch(
        "https://43ed6015-f502-4d2f-8f81-efec12377521-00-14er4jw3ws1x8.riker.replit.dev/generate-report",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "GalapagosKey2026",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `galapagos_${portfolio}_${period.replace(/\s+/g, "_")}.pptx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("PPTX gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PPTX");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Apresentações & Docs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere relatórios, factsheets e documentos institucionais
          </p>
        </div>

        <Tabs defaultValue="portfolio-pptx" className="w-full">
          <TabsList className="w-full justify-start gap-1 bg-transparent p-0 border-b border-border rounded-none h-auto pb-0">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="portfolio-pptx" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Portfólio PPTX</CardTitle>
                <CardDescription>{descriptions["portfolio-pptx"]}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5 min-w-[200px]">
                  <label className="text-sm font-medium text-foreground">Portfólio</label>
                  <Select value={portfolio} onValueChange={setPortfolio}>
                    <SelectTrigger><SelectValue placeholder="Selecione o portfólio" /></SelectTrigger>
                    <SelectContent>
                      {PORTFOLIOS.filter(p => !["Liquidity", "Bond Portfolio"].includes(p)).map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-[200px]">
                  <label className="text-sm font-medium text-foreground">Período</label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
                    <SelectContent>
                      {periods.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? "Gerando..." : "Gerar PPTX"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {tabs.filter((t) => t.value !== "portfolio-pptx").map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t.label}</CardTitle>
                  <CardDescription>{descriptions[t.value]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button disabled variant="secondary">Em breve</Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Layout>
  );
}
