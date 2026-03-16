import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface RadarMetric {
  metric: string;
  score: number;
}

interface FlashFactsheetProps {
  assetName: string;
  ticker?: string;
  assetClass: string;
  portfolios: string[];
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

export function FlashFactsheet({
  assetName,
  ticker,
  assetClass,
  portfolios,
  radarMetrics,
  thesis,
}: FlashFactsheetProps) {
  const radarData = radarMetrics.map((m) => ({
    subject: m.metric,
    value: m.score,
    fullMark: 10,
  }));

  const icon = CLASS_ICONS[assetClass] || "📊";

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

      {/* Portfolio Badges */}
      <div className="px-5 py-2.5 flex flex-wrap gap-1.5 border-b border-gray-100">
        {portfolios.map((p) => (
          <span
            key={p}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
              PORTFOLIO_COLORS[p] || "bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            {p}
          </span>
        ))}
      </div>

      {/* Radar Chart */}
      {radarData.length > 0 && (
        <div className="px-4 py-3 flex justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: "#6b7280", fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 10]}
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                tickCount={6}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Thesis */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Tese na Carteira
        </p>
        <p className="text-xs text-gray-700 leading-relaxed">{thesis}</p>
      </div>
    </div>
  );
}
