import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PortfolioName } from "@/lib/constants";

interface Holding {
  ticker: string;
  name: string;
  asset_class: string;
  weight: number;
  amc_parent: string | null;
}

interface HoldingsTableProps {
  portfolio: PortfolioName;
}

export function HoldingsTable({ portfolio }: HoldingsTableProps) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchHoldings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("asset_knowledge")
        .select("ticker, name, asset_class, weight_pct, portfolios, amc_parent")
        .contains("portfolios", [portfolio]);

      if (error || !data) {
        setHoldings([]);
        setLoading(false);
        return;
      }

      const items: Holding[] = data
        .map((a: any) => ({
          ticker: a.ticker,
          name: a.name,
          asset_class: a.asset_class,
          weight: (a.weight_pct as Record<string, number>)?.[portfolio] ?? 0,
          amc_parent: a.amc_parent ?? null,
        }))
        .filter((h) => h.weight > 0)
        .sort((a, b) => b.weight - a.weight);

      setHoldings(items);
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

  const directHoldings = holdings.filter((h) => !h.amc_parent);
  const amcChildren = holdings.filter((h) => h.amc_parent);
  const total = directHoldings.reduce((sum, h) => sum + h.weight, 0);

  if (directHoldings.length === 0) {
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

  const toggleExpand = (ticker: string) => {
    setExpanded((prev) => ({ ...prev, [ticker]: !prev[ticker] }));
  };

  const renderRow = (h: Holding, isChild = false, isExpandable = false, isOpen = false, onToggle?: () => void) => (
    <tr
      key={h.ticker}
      className={`border-b border-border/50 transition-colors ${
        isChild ? "bg-secondary/10" : "hover:bg-accent/5"
      } ${isExpandable ? "cursor-pointer" : ""}`}
      onClick={onToggle}
    >
      <td className={`px-5 py-3 font-mono text-xs font-semibold text-foreground ${isChild ? "pl-10" : ""}`}>
        <span className="flex items-center gap-1.5">
          {isExpandable && (
            isOpen
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {h.ticker}
        </span>
      </td>
      <td className="px-5 py-3 text-foreground">{h.name}</td>
      <td className="px-5 py-3 text-muted-foreground text-xs">{h.asset_class}</td>
      <td className="px-5 py-3 text-right text-muted-foreground font-mono">
        {h.weight.toFixed(2)}%
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
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          Composição — {portfolio}
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
            {directHoldings.map((h) => {
              const children = amcChildren.filter((c) => c.amc_parent === h.ticker);
              const isExpandable = children.length > 0;
              const isOpen = expanded[h.ticker];

              return (
                <>{renderRow(h, false, isExpandable, isOpen, isExpandable ? () => toggleExpand(h.ticker) : undefined)}
                  {isOpen &&
                    children
                      .sort((a, b) => b.weight - a.weight)
                      .map((child) => renderRow(child, true))}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-secondary/20">
              <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-foreground">
                Total
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-foreground">
                {total.toFixed(2)}%
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
