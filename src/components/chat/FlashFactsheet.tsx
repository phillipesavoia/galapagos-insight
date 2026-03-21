import { Progress } from "@/components/ui/progress";

interface RadarMetric {
  metric: string;
  score: number;
}

interface FlashFactsheetProps {
  assetName: string;
  ticker?: string;
  assetClass: string;
  portfolios: string[];
  weightsByPortfolio?: Record<string, number>;
  radarMetrics: RadarMetric[];
  thesis: string;
}

const PORTFOLIO_COLORS: Record<string, string> = {
  Conservative: "bg-blue-100 text-blue-700 border-blue-200",
  Income: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Balanced: "bg-amber-100 text-amber-700 border-amber-200",
  Growth: "bg-purple-100 text-purple-700 border-purple-200",
};

const CLASS_ICONS: Record<string, string> = {
  "Fixed Income": "🏦",
  Equities: "📈",
  Alternatives: "🔷",
  "Cash & Equivalents": "💵",
  Commodities: "🪙",
};

function getIntensityLabel(score: number): { label: string; className: string } {
  if (score <= 3) return { label: "Baixo", className: "text-emerald-600" };
  if (score <= 6) return { label: "Moderado", className: "text-amber-600" };
  return { label: "Alto", className: "text-red-500" };
}

export function FlashFactsheet({
  assetName,
  ticker,
  assetClass,
  portfolios,
  weightsByPortfolio,
  radarMetrics,
  thesis,
}: FlashFactsheetProps) {
  const icon = CLASS_ICONS[assetClass] || "📊";
  const hasWeights = weightsByPortfolio && Object.keys(weightsByPortfolio).length > 0;

  return (
    <div className="my-3 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <h3 className="text-sm font-bold text-gray-900 truncate">{assetName}</h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {ticker && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-900 text-white tracking-wider">
                  {ticker}
                </span>
              )}
              <span className="text-[11px] text-gray-500 font-medium">{assetClass}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Badges with Weights */}
      <div className="px-5 py-2.5 flex flex-wrap gap-1.5 border-b border-gray-100">
        {portfolios.map((p) => {
          const weight = hasWeights ? weightsByPortfolio[p] : undefined;
          return (
            <span
              key={p}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                PORTFOLIO_COLORS[p] || "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              {p}{weight != null ? ` · ${weight}%` : ""}
            </span>
          );
        })}
      </div>

      {/* Metric Bars - only if there are real metrics */}
      {radarMetrics.length > 0 && (
        <div className="px-5 py-3 space-y-2.5 border-b border-gray-100">
          {radarMetrics.map((m) => {
            const { label, className } = getIntensityLabel(m.score);
            return (
              <div key={m.metric} className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-gray-600 w-28 shrink-0 truncate">
                  {m.metric}
                </span>
                <Progress
                  value={m.score * 10}
                  className="h-2 flex-1 bg-gray-100"
                />
                <span className={`text-[10px] font-semibold w-16 text-right shrink-0 ${className}`}>
                  {m.score}/10 · {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Thesis */}
      <div className="px-5 py-3 bg-gray-50/50">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Tese na Carteira
        </p>
        <p className="text-xs text-gray-700 leading-relaxed">{thesis}</p>
      </div>
    </div>
  );
}
