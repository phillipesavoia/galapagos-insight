import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp } from "lucide-react";
import type { NavDataPoint } from "@/pages/Dashboard";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthlyReturnsTableProps {
  data: NavDataPoint[];
  loading: boolean;
}

interface MonthEndNav {
  year: number;
  month: number; // 0-11
  nav: number;
}

function computeMonthlyMatrix(data: NavDataPoint[]) {
  if (!data || data.length < 2) return null;

  // Sort ascending
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // Get last NAV per month
  const monthEnds = new Map<string, MonthEndNav>();
  for (const d of sorted) {
    const dt = new Date(d.date);
    const year = dt.getFullYear();
    const month = dt.getMonth();
    const key = `${year}-${month}`;
    monthEnds.set(key, { year, month, nav: d.nav });
  }

  // Convert to sorted array
  const entries = Array.from(monthEnds.values()).sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
  );

  if (entries.length < 2) return null;

  // Collect unique years
  const years = [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a);

  // Build matrix: year -> month -> return%
  const matrix: Record<number, (number | null)[]> = {};
  const ytdReturns: Record<number, number | null> = {};

  for (const year of years) {
    matrix[year] = new Array(12).fill(null);
  }

  // Calculate monthly returns
  for (let i = 0; i < entries.length; i++) {
    const curr = entries[i];
    // Find previous month-end
    const prevIdx = i - 1;
    if (prevIdx >= 0) {
      const prev = entries[prevIdx];
      const ret = (curr.nav / prev.nav) - 1;
      if (matrix[curr.year]) {
        matrix[curr.year][curr.month] = ret;
      }
    }
  }

  // Calculate YTD for each year
  for (const year of years) {
    // Last month-end of previous year
    const prevYearEnd = entries.filter((e) => e.year === year - 1).pop();
    // Last month-end of current year
    const currYearEnd = entries.filter((e) => e.year === year).pop();

    if (prevYearEnd && currYearEnd) {
      ytdReturns[year] = (currYearEnd.nav / prevYearEnd.nav) - 1;
    } else if (currYearEnd) {
      // First year — YTD from first entry of that year
      const firstOfYear = entries.find((e) => e.year === year);
      if (firstOfYear && currYearEnd !== firstOfYear) {
        // Use the nav at the start of the first month
        const firstDataPointOfYear = sorted.find(
          (d) => new Date(d.date).getFullYear() === year
        );
        if (firstDataPointOfYear) {
          ytdReturns[year] = (currYearEnd.nav / firstDataPointOfYear.nav) - 1;
        }
      } else {
        ytdReturns[year] = null;
      }
    }
  }

  // Since Inception
  const firstNav = sorted[0].nav;
  const lastNav = sorted[sorted.length - 1].nav;
  const sinceInception = (lastNav / firstNav) - 1;

  return { years, matrix, ytdReturns, sinceInception };
}

function formatReturn(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function getCellColor(value: number | null): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value > 0) return "text-green-500";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

function getCellBg(value: number | null): string {
  if (value === null || value === undefined) return "";
  if (value > 0) return "bg-green-500/5";
  if (value < 0) return "bg-destructive/5";
  return "";
}

export function MonthlyReturnsTable({ data, loading }: MonthlyReturnsTableProps) {
  const result = useMemo(() => computeMonthlyMatrix(data), [data]);
  const [yearFilter, setYearFilter] = useState<string>("all");

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="h-40 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            Dados insuficientes para calcular a matriz de retornos mensais.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { years, matrix, ytdReturns, sinceInception } = result;
  const siPositive = sinceInception >= 0;
  const displayYears = yearFilter === "all" ? years : years.filter((y) => String(y) === yearFilter);

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Retornos Mensais
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Retorno mês a mês baseado no último NAV de cada período
            </p>
          </div>
          <Badge
            variant="outline"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold tabular-nums border ${
              siPositive
                ? "border-green-500/30 text-green-500 bg-green-500/10"
                : "border-destructive/30 text-destructive bg-destructive/10"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Since Inception: {siPositive ? "+" : ""}
            {(sinceInception * 100).toFixed(2)}%
          </Badge>
        </div>

        <div className="overflow-x-auto -mx-1">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs font-semibold text-muted-foreground w-16">
                  Year
                </TableHead>
                {MONTHS.map((m) => (
                  <TableHead
                    key={m}
                    className="text-xs font-semibold text-muted-foreground text-right min-w-[60px]"
                  >
                    {m}
                  </TableHead>
                ))}
                <TableHead className="text-xs font-semibold text-muted-foreground text-right min-w-[70px]">
                  YTD
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((year) => (
                <TableRow key={year} className="border-border">
                  <TableCell className="text-sm font-semibold text-foreground tabular-nums">
                    {year}
                  </TableCell>
                  {matrix[year].map((val, monthIdx) => (
                    <TableCell
                      key={monthIdx}
                      className={`text-right text-xs tabular-nums ${getCellColor(val)} ${getCellBg(val)}`}
                    >
                      {formatReturn(val)}
                    </TableCell>
                  ))}
                  <TableCell
                    className={`text-right text-xs font-semibold tabular-nums ${getCellColor(ytdReturns[year] ?? null)} ${getCellBg(ytdReturns[year] ?? null)}`}
                  >
                    {formatReturn(ytdReturns[year] ?? null)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
