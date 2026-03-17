import { forwardRef, useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { NavDataPoint, PortfolioName } from "@/pages/Dashboard";

const RISK_FREE_RATE = 0.05;
const TRADING_DAYS = 252;

const BENCHMARK_COLORS: Record<string, string> = {
  SPY: "#3b82f6",
  ACWI: "#8b5cf6",
  TLT: "#f59e0b",
  AGG: "#ec4899",
};

interface BenchmarkSeries {
  ticker: string;
  name: string;
  data: { date: string; price: number }[];
}

interface Holding {
  asset_name: string;
  ticker: string | null;
  asset_class: string;
  weight_percentage: number;
  monthly_contribution?: number | null;
}

interface ReportPreviewProps {
  portfolio: PortfolioName;
  clientName: string;
  periodLabel: string;
  data: NavDataPoint[];
  loading: boolean;
  comment: string;
  benchmarks?: BenchmarkSeries[];
  topHoldings?: Holding[];
  aiCommentary?: string;
}

function computeMetrics(data: NavDataPoint[]) {
  if (data.length < 2) return null;
  const returns = data.map(d => d.daily_return).filter((r): r is number => r !== null && !isNaN(r));
  if (returns.length < 2) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const dailyStd = Math.sqrt(variance) / 100;
  const annualizedVol = dailyStd * Math.sqrt(TRADING_DAYS);
  const firstNav = data[0].nav;
  const lastNav = data[data.length - 1].nav;
  const firstDate = new Date(data[0].date);
  const lastDate = new Date(data[data.length - 1].date);
  const years = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = years > 0 ? (lastNav / firstNav) ** (1 / years) - 1 : 0;
  const sharpe = annualizedVol > 0 ? (cagr - RISK_FREE_RATE) / annualizedVol : 0;
  let peak = data[0].nav;
  let maxDD = 0;
  for (const d of data) {
    if (d.nav > peak) peak = d.nav;
    const dd = (d.nav - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  const accumulatedReturn = (lastNav / firstNav) - 1;
  return { accumulatedReturn, volatility: annualizedVol, sharpe, maxDrawdown: maxDD };
}

function normalizeToBase100(data: { date: string; value: number }[]): { date: string; value: number }[] {
  if (data.length === 0) return [];
  const base = data[0].value;
  if (base === 0) return data;
  return data.map(d => ({ date: d.date, value: (d.value / base) * 100 }));
}

export const ReportPreview = forwardRef<HTMLDivElement, ReportPreviewProps>(
  ({ portfolio, clientName, periodLabel, data, loading, comment, benchmarks = [], topHoldings = [], aiCommentary }, ref) => {
    const metrics = useMemo(() => computeMetrics(data), [data]);
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const chartData = useMemo(() => {
      if (data.length === 0) return [];
      const navNorm = normalizeToBase100(data.map(d => ({ date: d.date, value: d.nav })));
      const benchNorms = benchmarks.map(b => ({
        ticker: b.ticker,
        name: b.name,
        normalized: normalizeToBase100(b.data.map(d => ({ date: d.date, value: d.price }))),
      }));

      const dateSet = new Set(navNorm.map(d => d.date));
      benchNorms.forEach(b => b.normalized.forEach(d => dateSet.add(d.date)));
      const dates = Array.from(dateSet).sort();

      return dates.map(date => {
        const row: any = { date };
        const navPt = navNorm.find(d => d.date === date);
        if (navPt) row[portfolio] = parseFloat(navPt.value.toFixed(2));
        benchNorms.forEach(b => {
          const pt = b.normalized.find(d => d.date === date);
          if (pt) row[b.ticker] = parseFloat(pt.value.toFixed(2));
        });
        return row;
      });
    }, [data, benchmarks, portfolio]);

    const s = {
      page: { width: "210mm", minHeight: "297mm", padding: "20mm 18mm", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" } as React.CSSProperties,
      headerBar: { borderBottom: "2px solid #10b981", paddingBottom: "12px", marginBottom: "24px" } as React.CSSProperties,
      sectionTitle: { fontSize: "13px", fontWeight: 600, color: "#111827", margin: "0 0 10px 0", textTransform: "uppercase" as const, letterSpacing: "0.05em" } as React.CSSProperties,
      metricCard: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px 14px", textAlign: "center" as const } as React.CSSProperties,
      metricLabel: { fontSize: "10px", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", margin: "0 0 4px 0" } as React.CSSProperties,
    };

    return (
      <div ref={ref} className="bg-white text-gray-900 shadow-xl border border-gray-200 rounded-sm print:shadow-none print:border-none" style={s.page}>
        {/* Header */}
        <div style={s.headerBar}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0 }}>Galapagos Capital Advisory</h1>
              <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Relatório de Performance — {portfolio}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>Data de geração: {today}</p>
              {clientName && <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", marginTop: "2px" }}>Cliente: {clientName}</p>}
            </div>
          </div>
        </div>

        {/* Period */}
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#111827", margin: "0 0 4px 0" }}>{portfolio} Portfolio</h2>
          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
            Período: {periodLabel}
            {data.length >= 2 && (<> — {new Date(data[0].date).toLocaleDateString("pt-BR")} a {new Date(data[data.length - 1].date).toLocaleDateString("pt-BR")}</>)}
          </p>
        </div>

        {/* Chart */}
        <div style={{ marginBottom: "24px" }}>
          {loading ? (
            <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "13px" }}>Carregando dados...</div>
          ) : data.length === 0 ? (
            <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "13px", border: "1px dashed #d1d5db", borderRadius: "8px" }}>Sem dados disponíveis</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={{ stroke: "#d1d5db" }} tickLine={false}
                  tickFormatter={(v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "11px" }}
                  labelFormatter={(v: string) => new Date(v).toLocaleDateString("pt-BR")} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Line type="monotone" dataKey={portfolio} name={portfolio} stroke="#10b981" strokeWidth={2} dot={false} />
                {benchmarks.map(b => (
                  <Line key={b.ticker} type="monotone" dataKey={b.ticker} name={b.name} stroke={BENCHMARK_COLORS[b.ticker] || "#94a3b8"} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          {benchmarks.length > 0 && (
            <p style={{ fontSize: "9px", color: "#9ca3af", marginTop: "4px", textAlign: "center" }}>
              * Todas as séries normalizadas para base 100 no início do período
            </p>
          )}
        </div>

        {/* Metrics Row */}
        {metrics && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "28px" }}>
            {[
              { label: "Retorno Acumulado", value: `${metrics.accumulatedReturn >= 0 ? "+" : ""}${(metrics.accumulatedReturn * 100).toFixed(2)}%`, color: metrics.accumulatedReturn >= 0 ? "#10b981" : "#ef4444" },
              { label: "Volatilidade Anual.", value: `${(metrics.volatility * 100).toFixed(2)}%`, color: "#111827" },
              { label: "Índice Sharpe", value: metrics.sharpe.toFixed(2), color: metrics.sharpe >= 0 ? "#10b981" : "#ef4444" },
              { label: "Max Drawdown", value: `${(metrics.maxDrawdown * 100).toFixed(2)}%`, color: "#ef4444" },
            ].map(m => (
              <div key={m.label} style={s.metricCard}>
                <p style={s.metricLabel}>{m.label}</p>
                <p style={{ fontSize: "18px", fontWeight: 700, color: m.color, margin: 0, fontVariantNumeric: "tabular-nums" }}>{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Top Holdings */}
        {topHoldings && topHoldings.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h3 style={s.sectionTitle}>Principais Posições</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Ativo</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Ticker</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Classe</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Peso (%)</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Contrib.</th>
                </tr>
              </thead>
              <tbody>
                {topHoldings.map((h, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    <td style={{ padding: "6px 8px", color: "#111827" }}>{h.asset_name}</td>
                    <td style={{ padding: "6px 8px", color: "#6b7280", fontFamily: "monospace", fontSize: "10px" }}>{h.ticker || "—"}</td>
                    <td style={{ padding: "6px 8px", color: "#6b7280" }}>{h.asset_class}</td>
                    <td style={{ padding: "6px 8px", color: "#111827", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{h.weight_percentage.toFixed(1)}%</td>
                    <td style={{
                      padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums",
                      color: h.monthly_contribution != null ? (h.monthly_contribution >= 0 ? "#10b981" : "#ef4444") : "#9ca3af",
                    }}>
                      {h.monthly_contribution != null ? `${h.monthly_contribution >= 0 ? "+" : ""}${h.monthly_contribution.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* AI Commentary */}
        {aiCommentary && (
          <div style={{ marginBottom: "24px" }}>
            <h3 style={s.sectionTitle}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                ✨ IA Investment Commentary
              </span>
            </h3>
            <div style={{ fontSize: "12px", lineHeight: "1.8", color: "#374151", whiteSpace: "pre-wrap", borderLeft: "3px solid #8b5cf6", paddingLeft: "14px", backgroundColor: "#faf5ff", padding: "12px 14px", borderRadius: "0 6px 6px 0" }}>
              {aiCommentary}
            </div>
          </div>
        )}

        {/* Comment */}
        {comment && (
          <div style={{ marginBottom: "24px" }}>
            <h3 style={s.sectionTitle}>Comentário de Mercado</h3>
            <div style={{ fontSize: "12px", lineHeight: "1.7", color: "#374151", whiteSpace: "pre-wrap", borderLeft: "3px solid #10b981", paddingLeft: "14px" }}>
              {comment}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px", marginTop: "auto", display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#9ca3af" }}>
          <span>Galapagos Capital Advisory — Documento confidencial</span>
          <span>Taxa livre de risco: {(RISK_FREE_RATE * 100).toFixed(0)}% a.a. | Gerado via Galapagos Connect</span>
        </div>
      </div>
    );
  }
);

ReportPreview.displayName = "ReportPreview";
