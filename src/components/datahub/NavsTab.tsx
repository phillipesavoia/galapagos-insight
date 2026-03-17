import { useState, useRef } from "react";
import { Upload, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const portfolios = ["Liquidity", "Bonds", "Conservative", "Income", "Balanced", "Growth"];

const mockNavData = [
  { date: "2026-03-14", Liquidity: 1012.34, Bonds: 1045.67, Conservative: 1078.12, Income: 1102.45, Balanced: 1156.78, Growth: 1234.56 },
  { date: "2026-03-13", Liquidity: 1012.20, Bonds: 1044.89, Conservative: 1077.50, Income: 1101.80, Balanced: 1155.20, Growth: 1232.10 },
  { date: "2026-03-12", Liquidity: 1012.05, Bonds: 1044.10, Conservative: 1076.88, Income: 1100.95, Balanced: 1153.67, Growth: 1229.45 },
  { date: "2026-03-11", Liquidity: 1011.90, Bonds: 1043.55, Conservative: 1076.20, Income: 1100.10, Balanced: 1152.05, Growth: 1226.80 },
  { date: "2026-03-10", Liquidity: 1011.78, Bonds: 1042.90, Conservative: 1075.55, Income: 1099.30, Balanced: 1150.40, Growth: 1224.15 },
];

const chartData = [
  { date: "Jan", Liquidity: 1000, Bonds: 1005, Conservative: 1010, Income: 1020, Balanced: 1030, Growth: 1050 },
  { date: "Feb", Liquidity: 1004, Bonds: 1015, Conservative: 1030, Income: 1045, Balanced: 1070, Growth: 1110 },
  { date: "Mar", Liquidity: 1008, Bonds: 1030, Conservative: 1055, Income: 1075, Balanced: 1120, Growth: 1180 },
  { date: "Abr", Liquidity: 1010, Bonds: 1038, Conservative: 1065, Income: 1090, Balanced: 1140, Growth: 1210 },
  { date: "Mai", Liquidity: 1012, Bonds: 1045, Conservative: 1078, Income: 1102, Balanced: 1156, Growth: 1234 },
];

const lineColors = [
  "hsl(var(--muted-foreground))",
  "hsl(var(--primary))",
  "hsl(38, 92%, 50%)",
  "hsl(200, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 55%)",
];

export function NavsTab() {
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  return (
    <div className="space-y-8">
      {/* CSV Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); }}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-card/50"
        }`}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" />
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Arraste o arquivo CSV de cotas aqui</p>
            <p className="text-xs text-muted-foreground mt-1">CSV, XLSX · Formato: Data | Portfólio | NAV</p>
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="border border-border rounded-xl p-6 bg-card">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-foreground">Validação Visual — Performance Recente</h3>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(240,5%,65%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(240,5%,65%)" }} axisLine={false} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
              <Tooltip
                contentStyle={{
                  background: "hsl(240,15%,7%)",
                  border: "1px solid hsl(240,10%,16%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              {portfolios.map((p, i) => (
                <Line key={p} type="monotone" dataKey={p} stroke={lineColors[i]} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {portfolios.map((p, i) => (
            <div key={p} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: lineColors[i] }} />
              <span className="text-xs text-muted-foreground">{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* NAV Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</TableHead>
              {portfolios.map((p) => (
                <TableHead key={p} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">{p}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockNavData.map((row) => (
              <TableRow key={row.date}>
                <TableCell className="text-sm font-medium text-foreground">{row.date}</TableCell>
                {portfolios.map((p) => (
                  <TableCell key={p} className="text-sm text-muted-foreground text-right font-mono">
                    {(row[p as keyof typeof row] as number).toFixed(2)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
