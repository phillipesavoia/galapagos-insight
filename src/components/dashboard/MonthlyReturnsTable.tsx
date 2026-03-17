import { useMemo, useState } from "react";
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
  month: number;
  nav: number;
}

function computeMonthlyMatrix(data: NavDataPoint[]) {
  if (!data || data.length < 2) return null;

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  const monthEnds = new Map<string, MonthEndNav>();
  for (const d of sorted) {
    const dt = new Date(d.date);
    const year = dt.getFullYear();
    const month = dt.getMonth();
    const key = `${year}-${month}`;
    monthEnds.set(key, { year, month, nav: d.nav });
  }

  const entries = Array.from(monthEnds.values()).sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
  );

  if (entries.length < 2) return null;

  const years = [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a);

  const matrix: Record<number, (number | null)[]> = {};
  const ytdReturns: Record<number, number | null> = {};

  for (const year of years) {
    matrix[year] = new Array(12).fill(null);
  }

  for (let i = 0; i < entries.length; i++) {
    const curr = entries[i];
    const prevIdx = i - 1;
    if (prevIdx >= 0) {
      const prev = entries[prevIdx];
      const ret = (curr.nav / prev.nav) - 1;
      if (matrix[curr.year]) {
        matrix[curr.year][curr.month] = ret;
      }
    }
  }

  for (const year of years) {
    const prevYearEnd = entries.filter((e) => e.year === year - 1).pop();
    const currYearEnd = entries.filter((e) => e.year === year).pop();

    if (prevYearEnd && currYearEnd) {
      ytdReturns[year] = (currYearEnd.nav / prevYearEnd.nav) - 1;
    } else if (currYearEnd) {
      const firstOfYear = entries.find((e) => e.year === year);
      if (firstOfYear && currYearEnd !== firstOfYear) {
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
  if (value > 0) return "text-neon-green";
  if (value < 0) return "text-neon-rose";
  return "text-muted-foreground";
}

export function MonthlyReturnsTable({ data, loading }: MonthlyReturnsTableProps) {
  const result = useMemo(() => computeMonthlyMatrix(data), [data]);
  const [yearFilter, setYearFilter] = useState<string>("all");

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="h-40 animate-pulse rounded-lg bg-white/[0.03]" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <p className="text-sm text-muted-foreground font-mono">
          Insufficient data for monthly returns matrix.
        </p>
      </div>
    );
  }

  const { years, matrix, ytdReturns, sinceInception } = result;
  const siPositive = sinceInception >= 0;
  const displayYears = yearFilter === "all" ? years : years.filter((y) => String(y) === yearFilter);

  return (
    <div className="glass-card rounded-2xl p-6 animate-fade-up">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Monthly Returns
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase tracking-widest">
            Month-over-month based on last NAV
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs font-mono glass-card border-white/5 rounded-xl">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge
            variant="outline"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold tabular-nums font-mono rounded-xl ${
              siPositive
                ? "border-neon-green/30 text-neon-green bg-neon-green/10"
                : "border-neon-rose/30 text-neon-rose bg-neon-rose/10"
            }`}
          >
            <TrendingUp className="h-3 w-3" />
            SI: {siPositive ? "+" : ""}
            {(sinceInception * 100).toFixed(2)}%
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-16">
                Year
              </TableHead>
              {MONTHS.map((m) => (
                <TableHead
                  key={m}
                  className="text-right min-w-[55px]"
                >
                  {m}
                </TableHead>
              ))}
              <TableHead className="text-right min-w-[65px]">
                YTD
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayYears.map((year) => (
              <TableRow key={year} className="border-white/[0.03]">
                <TableCell className="text-xs font-semibold text-foreground tabular-nums font-mono">
                  {year}
                </TableCell>
                {matrix[year].map((val, monthIdx) => (
                  <TableCell
                    key={monthIdx}
                    className={`text-right text-xs tabular-nums font-mono ${getCellColor(val)}`}
                  >
                    {formatReturn(val)}
                  </TableCell>
                ))}
                <TableCell
                  className={`text-right text-xs font-semibold tabular-nums font-mono ${getCellColor(ytdReturns[year] ?? null)}`}
                >
                  {formatReturn(ytdReturns[year] ?? null)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
