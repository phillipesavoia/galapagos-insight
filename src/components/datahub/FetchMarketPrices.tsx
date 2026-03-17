import { useState } from "react";
import { RefreshCw, Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PORTFOLIOS = ["Conservative", "Income", "Balanced", "Growth"];

interface HoldingPrice {
  portfolio: string;
  ticker: string;
  asset_name: string;
  weight: number;
  prevClose: number | null;
  change: number | null;
  error?: string;
}

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
      const finnhubKey = await getFinnhubKey();
      if (!finnhubKey) {
        setError("FINNHUB_API_KEY não configurada. Configure nas Edge Function secrets.");
        setLoading(false);
        return;
      }

      const results: EstimatedNav[] = [];

      for (const portfolio of PORTFOLIOS) {
        // Get holdings
        const { data: holdings } = await supabase
          .from("portfolio_holdings")
          .select("ticker, asset_name, weight_percentage, asset_class")
          .eq("portfolio_name", portfolio)
          .eq("is_active", true);

        if (!holdings || holdings.length === 0) continue;

        // Get latest NAV
        const { data: navRows } = await supabase
          .from("daily_navs")
          .select("date, nav")
          .eq("portfolio_name", portfolio)
          .order("date", { ascending: false })
          .limit(1);

        if (!navRows || navRows.length === 0) continue;

        const lastNav = navRows[0].nav;
        const lastDate = navRows[0].date;

        // Fetch prices for each holding with a ticker
        let weightedChange = 0;
        let coverageWeight = 0;
        let holdingsUsed = 0;

        for (const h of holdings) {
          if (!h.ticker) continue;
          try {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(h.ticker)}&token=${finnhubKey}`
            );
            if (res.ok) {
              const q = await res.json();
              if (q.c && q.pc && q.pc > 0) {
                const pctChange = ((q.c - q.pc) / q.pc) * 100;
                weightedChange += pctChange * (h.weight_percentage / 100);
                coverageWeight += h.weight_percentage;
                holdingsUsed++;
              }
            }
          } catch {
            // skip individual ticker errors
          }
        }

        if (holdingsUsed > 0) {
          const estimatedChange = weightedChange;
          const estimatedNav = lastNav * (1 + estimatedChange / 100);
          results.push({
            portfolio,
            lastNav: Number(lastNav),
            lastDate,
            estimatedChange: parseFloat(estimatedChange.toFixed(4)),
            estimatedNav: parseFloat(estimatedNav.toFixed(2)),
            holdingsUsed,
            coverageWeight: parseFloat(coverageWeight.toFixed(1)),
          });
        }
      }

      if (results.length === 0) {
        setError("Nenhum holding com ticker encontrado. Cadastre os holdings no Data Hub primeiro.");
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
        Requer holdings cadastrados com tickers válidos no Data Hub.
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

async function getFinnhubKey(): Promise<string | null> {
  // The Finnhub key is server-side only. We'll call via edge function proxy.
  // For now, attempt direct call — the key needs to be accessible client-side or via proxy.
  // Using a simple edge function approach:
  try {
    const { data } = await supabase.functions.invoke("get-finnhub-key");
    return data?.key || null;
  } catch {
    return null;
  }
}
