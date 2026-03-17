import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface AllocationSlice {
  name: string;
  value: number;
  color: string;
}

interface PortfolioModel {
  name: string;
  allocations: AllocationSlice[];
}

const palette = [
  "hsl(var(--primary))",
  "hsl(200, 80%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(var(--muted-foreground))",
];

const models: PortfolioModel[] = [
  {
    name: "Liquidity",
    allocations: [
      { name: "Cash & Equivalents", value: 85, color: palette[0] },
      { name: "Short-Term Bonds", value: 15, color: palette[1] },
    ],
  },
  {
    name: "Bonds",
    allocations: [
      { name: "Fixed Income", value: 70, color: palette[0] },
      { name: "EM Bonds", value: 20, color: palette[1] },
      { name: "Cash", value: 10, color: palette[5] },
    ],
  },
  {
    name: "Conservative",
    allocations: [
      { name: "Fixed Income", value: 55, color: palette[0] },
      { name: "Equities", value: 25, color: palette[2] },
      { name: "Alternatives", value: 12, color: palette[3] },
      { name: "Cash", value: 8, color: palette[5] },
    ],
  },
  {
    name: "Income",
    allocations: [
      { name: "Fixed Income", value: 40, color: palette[0] },
      { name: "Equities", value: 35, color: palette[2] },
      { name: "Alternatives", value: 18, color: palette[3] },
      { name: "Cash", value: 7, color: palette[5] },
    ],
  },
  {
    name: "Balanced",
    allocations: [
      { name: "Equities", value: 50, color: palette[2] },
      { name: "Fixed Income", value: 30, color: palette[0] },
      { name: "Alternatives", value: 15, color: palette[3] },
      { name: "Cash", value: 5, color: palette[5] },
    ],
  },
  {
    name: "Growth",
    allocations: [
      { name: "Equities", value: 70, color: palette[2] },
      { name: "Alternatives", value: 20, color: palette[3] },
      { name: "Fixed Income", value: 0, color: palette[0] },
      { name: "Cash", value: 10, color: palette[5] },
    ].filter(s => s.value > 0),
  },
];

function PortfolioCard({ model }: { model: PortfolioModel }) {
  const total = model.allocations.reduce((s, a) => s + a.value, 0);

  return (
    <div className="border border-border rounded-xl bg-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{model.name}</h3>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground gap-1">
          <Pencil className="h-3 w-3" /> Editar Pesos
        </Button>
      </div>

      <div className="flex items-center gap-5 flex-1">
        {/* Donut */}
        <div className="h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={model.allocations}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={48}
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(var(--card))"
              >
                {model.allocations.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(240,15%,7%)",
                  border: "1px solid hsl(240,10%,16%)",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                formatter={(value: number) => `${value}%`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          {model.allocations.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                <span className="text-xs text-muted-foreground truncate">{a.name}</span>
              </div>
              <span className="text-xs font-semibold text-foreground tabular-nums">{a.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AllocationTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {models.map((m) => (
        <PortfolioCard key={m.name} model={m} />
      ))}
    </div>
  );
}
