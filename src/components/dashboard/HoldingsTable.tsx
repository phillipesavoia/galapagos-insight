import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PortfolioName } from "@/lib/constants";

interface Holding {
  ticker: string;
  name: string;
  weight: number;
  asset_class: string;
}

interface HoldingsTableProps {
  portfolio: PortfolioName;
}

export function HoldingsTable({ portfolio }: HoldingsTableProps) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchHoldings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("asset_knowledge")
        .select("ticker, name, asset_class, weight_pct, portfolios")
        .contains("portfolios", [portfolio]);

      if (error || !data) {
        setHoldings([]);
        setLoading(false);
        return;
      }

      const items: Holding[] = data
        .map((a: any) => {
          const weightMap = a.weight_pct as Record<string, number> | null;
          const weight = weightMap?.[portfolio] ?? 0;
          return {
            ticker: a.ticker,
            name: a.name,
            asset_class: a.asset_class,
            weight,
          };
        })
        .filter((h) => h.weight > 0)
        .sort((a, b) => b.weight - a.weight);

      setHoldings(items);
      setTotal(items.reduce((sum, h) => sum + h.weight, 0));
      setLoading(false);
    };

    fetchHoldings();
  }, [portfolio]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Carregando composição...</p>
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum ativo encontrado para {portfolio}. Configure as alocações no{" "}
          <a href="/admin/assets" className="text-primary hover:underline">
            Asset Dictionary
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          Composição do Portfólio — {portfolio}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Ticker
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Nome
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Classe
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Peso
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Alocação
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr
                key={h.ticker}
                className="border-b border-border/50 hover:bg-accent/5 transition-colors"
              >
                <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">
                  {h.ticker}
                </td>
                <td className="px-5 py-3 text-foreground">{h.name}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs">{h.asset_class}</td>
                <td className="px-5 py-3 text-right text-muted-foreground font-mono">
                  {h.weight.toFixed(1)}%
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(h.weight, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-secondary/20">
              <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-foreground">
                Total
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-foreground">
                {total.toFixed(1)}%
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
