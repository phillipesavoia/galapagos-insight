import { forwardRef, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { NavDataPoint, PortfolioName } from "@/pages/Dashboard";

const RISK_FREE_RATE = 0.045;
const TRADING_DAYS = 252;

interface ReportPreviewProps {
  portfolio: PortfolioName;
  clientName: string;
  periodLabel: string;
  data: NavDataPoint[];
  loading: boolean;
  comment: string;
}

function computeMetrics(data: NavDataPoint[]) {
  if (data.length < 2) return null;
  const returns = data.map((d) => d.daily_return).filter((r): r is number => r !== null && !isNaN(r));
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

  return {
    accumulatedReturn: (lastNav / firstNav) - 1,
    volatility: annualizedVol,
    sharpe,
    maxDrawdown: maxDD,
  };
}

export const ReportPreview = forwardRef<HTMLDivElement, ReportPreviewProps>(
  ({ portfolio, clientName, periodLabel, data, loading, comment }, ref) => {
    const metrics = useMemo(() => computeMetrics(data), [data]);
    const today = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    return (
      <div
        ref={ref}
        className="bg-white text-gray-900 shadow-xl border border-gray-200 rounded-sm"
        style={{
          width: "210mm",
          minHeight: "297mm",
          padding: "20mm 18mm",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: "2px solid #10b981", paddingBottom: "12px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0 }}>
                Galapagos Capital Advisory
              </h1>
              <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                Relatório de Performance — {portfolio}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>
                Data de geração: {today}
              </p>
              {clientName && (
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", marginTop: "2px" }}>
                  Cliente: {clientName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio + Period */}
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#111827", margin: "0 0 4px 0" }}>
            {portfolio} Portfolio
          </h2>
          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
            Período: {periodLabel}
            {data.length >= 2 && (
              <> — {new Date(data[0].date).toLocaleDateString("pt-BR")} a {new Date(data[data.length - 1].date).toLocaleDateString("pt-BR")}</>
            )}
          </p>
        </div>

        {/* Chart */}
        <div style={{ marginBottom: "24px" }}>
          {loading ? (
            <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "13px" }}>
              Carregando dados...
            </div>
          ) : data.length === 0 ? (
            <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "13px", border: "1px dashed #d1d5db", borderRadius: "8px" }}>
              Sem dados disponíveis para este período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  axisLine={{ stroke: "#d1d5db" }}
                  tickLine={false}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={["dataMin - 0.5", "dataMax + 0.5"]}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "11px",
                  }}
                  labelFormatter={(v: string) => new Date(v).toLocaleDateString("pt-BR")}
                  formatter={(value: number) => [`US$ ${value.toFixed(2)}`, "NAV"]}
                />
                <Line
                  type="monotone"
                  dataKey="nav"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Metrics Row */}
        {metrics && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "12px",
            marginBottom: "28px",
          }}>
            {[
              { label: "Retorno Acumulado", value: `${metrics.accumulatedReturn >= 0 ? "+" : ""}${(metrics.accumulatedReturn * 100).toFixed(2)}%`, color: metrics.accumulatedReturn >= 0 ? "#10b981" : "#ef4444" },
              { label: "Volatilidade Anual.", value: `${(metrics.volatility * 100).toFixed(2)}%`, color: "#111827" },
              { label: "Índice Sharpe", value: metrics.sharpe.toFixed(2), color: "#111827" },
              { label: "Max Drawdown", value: `${(metrics.maxDrawdown * 100).toFixed(2)}%`, color: "#ef4444" },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0" }}>
                  {m.label}
                </p>
                <p style={{ fontSize: "18px", fontWeight: 700, color: m.color, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Comment */}
        {comment && (
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#111827", margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Comentário de Mercado
            </h3>
            <div style={{
              fontSize: "12px",
              lineHeight: "1.7",
              color: "#374151",
              whiteSpace: "pre-wrap",
              borderLeft: "3px solid #10b981",
              paddingLeft: "14px",
            }}>
              {comment}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: "12px",
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "9px",
          color: "#9ca3af",
        }}>
          <span>Galapagos Capital Advisory — Documento confidencial</span>
          <span>Gerado automaticamente via Galapagos Connect</span>
        </div>
      </div>
    );
  }
);

ReportPreview.displayName = "ReportPreview";
