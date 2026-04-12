import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PORTFOLIOS } from "@/lib/constants";

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

          {/* Portfólio PPTX — active tab */}
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
                <Button onClick={() => toast("Em desenvolvimento")}>
                  Gerar PPTX
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Placeholder tabs */}
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
