import { useState } from "react";
import { RefreshCw, Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PORTFOLIOS = ["Conservative", "Income", "Balanced", "Growth"];

interface EstimatedNav {
  portfolio: string;
  lastNav: number;
  lastDate: string;
  estimatedChange: number;
  estimatedNav: number;
  holdingsUsed: number;
  coverageWeight: number;
}

export function FetchMarketPrices() {
  const [loading, setLoading] = useState(false);
  const [estimates, setEstimates] = useState<EstimatedNav[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setEstimates([]);

    try {
      const results: EstimatedNav[] = [];

      for (const portfolio of PORTFOLIOS) {
        const { data: holdings } = await supabase
          .from("portfolio_holdings")
          .select("ticker, asset_name, weight_percentage, asset_class")
          .eq("portfolio_name", portfolio)
          .eq("is_active", true);

        if (!holdings || holdings.length === 0) continue;

        const { data: navRows } = await supabase
          .from("daily_navs")
          .select("date, nav")
          .eq("portfolio_name", portfolio)
          .order("date", { ascending: false })
          .limit(1);

        if (!navRows || navRows.length === 0) continue;

        const lastNav = Number(navRows[0].nav);
        const lastDate = navRows[0].date;

        // Collect tickers
        const tickers = holdings.filter(h => h.ticker).map(h => h.ticker!);
        if (tickers.length === 0) continue;

        // Fetch quotes via edge function
        const { data: quoteData, error: fnError } = await supabase.functions.invoke("fetch-market-quotes", {
          body: { tickers },
        });

        if (fnError || !quoteData?.quotes) {
          console.error("Quote fetch error:", fnError);
          continue;
        }

        let weightedChange = 0;
        let coverageWeight = 0;
        let holdingsUsed = 0;

        for (const h of holdings) {
          if (!h.ticker) continue;
          const q = quoteData.quotes[h.ticker];
          if (q && q.pc > 0) {
            const pctChange = ((q.c - q.pc) / q.pc) * 100;
            weightedChange += pctChange * (h.weight_percentage / 100);
            coverageWeight += h.weight_percentage;
            holdingsUsed++;
          }
        }

        if (holdingsUsed > 0) {
          results.push({
            portfolio,
            lastNav,
            lastDate,
            estimatedChange: parseFloat(weightedChange.toFixed(4)),
            estimatedNav: parseFloat((lastNav * (1 + weightedChange / 100)).toFixed(2)),
            holdingsUsed,
            coverageWeight: parseFloat(coverageWeight.toFixed(1)),
          });
        }
      }

      if (results.length === 0) {
        setError("Nenhum holding com ticker válido encontrado. Cadastre os holdings com tickers no Data Hub.");
      } else {
        setEstimates(results);
        toast.success(`Preços D-1 obtidos para ${results.length} portfólios`);
      }
    } catch (err) {
      console.error("Fetch market prices error:", err);
      setError("Erro ao buscar preços de mercado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-foreground">NAV Estimado (Market Proxy)</h3>
        </div>
        <Button onClick={handleFetch} disabled={loading} size="sm" variant="outline" className="gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Puxar Preços de Mercado (D-1)
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Usa a Finnhub API para buscar o fechamento dos ativos que compõem cada modelo e estima a variação do NAV.
        Requer holdings cadastrados com tickers válidos no Data Hub → Matriz de Alocação.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {estimates.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase">Portfólio</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase text-right">Último NAV</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase text-right">Data</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase text-right">Δ Estimada</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase text-right">NAV Estimado</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase text-right">Cobertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map(e => (
                <TableRow key={e.portfolio}>
                  <TableCell className="text-sm font-medium text-foreground">{e.portfolio}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground text-right">{e.lastNav.toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground text-right">{e.lastDate}</TableCell>
                  <TableCell className={`text-sm font-mono text-right ${e.estimatedChange >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {e.estimatedChange >= 0 ? "+" : ""}{e.estimatedChange.toFixed(4)}%
                  </TableCell>
                  <TableCell className="text-sm font-mono text-foreground text-right">{e.estimatedNav.toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground text-right">{e.coverageWeight}% ({e.holdingsUsed} ativos)</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
