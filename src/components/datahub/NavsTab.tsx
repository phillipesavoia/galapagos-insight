import { useState, useRef, useEffect } from "react";
import { Upload, TrendingUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const portfolios = ["Liquidity", "Bonds", "Conservative", "Income", "Balanced", "Growth"];

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
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [navData, setNavData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNavs = async () => {
    setLoading(true);

    // Fetch recent NAVs for table (last 10 dates)
    const { data: recentNavs, error } = await supabase
      .from("daily_navs")
      .select("date, portfolio_name, nav")
      .order("date", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching NAVs:", error);
      setLoading(false);
      return;
    }

    // Group by date for table
    const dateMap: Record<string, Record<string, number>> = {};
    (recentNavs || []).forEach((row: any) => {
      if (!dateMap[row.date]) dateMap[row.date] = {};
      dateMap[row.date][row.portfolio_name] = Number(row.nav);
    });

    const dates = Object.keys(dateMap).sort().reverse().slice(0, 10);
    const tableRows = dates.map((date) => ({
      date,
      ...dateMap[date],
    }));
    setNavData(tableRows);

    // For chart: get last 60 dates ascending
    const chartDates = Object.keys(dateMap).sort().slice(-60);
    const chartRows = chartDates.map((date) => ({
      date: date.slice(5), // MM-DD
      ...dateMap[date],
    }));
    setChartData(chartRows);

    setLoading(false);
  };

  useEffect(() => {
    fetchNavs();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const processFile = async (file: File) => {
    setUploading(true);
    setUploadResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows: { date: string; portfolio_name: string; nav: number }[] = [];

          for (const row of results.data as Record<string, string>[]) {
            // Expect columns: date (or Date), then portfolio names
            const dateVal = row.date || row.Date || row.DATE || Object.values(row)[0];
            if (!dateVal) continue;

            // Normalize date
            const dateParsed = new Date(dateVal);
            if (isNaN(dateParsed.getTime())) continue;
            const dateStr = dateParsed.toISOString().split("T")[0];

            for (const portfolio of portfolios) {
              // Try exact match and case-insensitive
              const val = row[portfolio] || row[portfolio.toLowerCase()] || row[portfolio.toUpperCase()];
              if (val !== undefined && val !== "") {
                const nav = parseFloat(String(val).replace(",", "."));
                if (!isNaN(nav)) {
                  rows.push({ date: dateStr, portfolio_name: portfolio, nav });
                }
              }
            }
          }

          if (rows.length === 0) {
            toast.error("Nenhum dado válido encontrado no CSV");
            setUploading(false);
            return;
          }

          // Upsert in batches of 500
          const batchSize = 500;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const { error } = await supabase.from("daily_navs").upsert(
              batch.map((r) => ({
                date: r.date,
                portfolio_name: r.portfolio_name,
                nav: r.nav,
              })),
              { onConflict: "date,portfolio_name", ignoreDuplicates: false }
            );
            if (error) {
              console.error("Upsert error:", error);
              // Fallback: insert individually
              for (const r of batch) {
                await supabase.from("daily_navs").upsert(
                  { date: r.date, portfolio_name: r.portfolio_name, nav: r.nav },
                  { onConflict: "date,portfolio_name", ignoreDuplicates: false }
                );
              }
            }
          }

          setUploadResult({ success: true, count: rows.length });
          toast.success(`${rows.length} registros importados com sucesso`);
          await fetchNavs();
        } catch (err) {
          console.error("CSV processing error:", err);
          toast.error("Erro ao processar CSV");
          setUploadResult({ success: false, count: 0 });
        } finally {
          setUploading(false);
        }
      },
      error: (err) => {
        console.error("Papa parse error:", err);
        toast.error("Erro ao ler arquivo CSV");
        setUploading(false);
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-8">
      {/* CSV Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-card/50"
        }`}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : uploadResult?.success ? (
              <CheckCircle2 className="h-6 w-6 text-primary" />
            ) : uploadResult && !uploadResult.success ? (
              <AlertCircle className="h-6 w-6 text-destructive" />
            ) : (
              <Upload className="h-6 w-6 text-primary" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {uploading
                ? "Processando arquivo..."
                : uploadResult?.success
                ? `${uploadResult.count} registros importados`
                : "Arraste o arquivo CSV de cotas aqui"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              CSV · Formato: Date | Liquidity | Bonds | Conservative | Income | Balanced | Growth
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Performance Chart */}
          {chartData.length > 0 && (
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
          )}

          {/* NAV Table */}
          {navData.length > 0 ? (
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
                  {navData.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="text-sm font-medium text-foreground">{row.date}</TableCell>
                      {portfolios.map((p) => (
                        <TableCell key={p} className="text-sm text-muted-foreground text-right font-mono">
                          {row[p] != null ? Number(row[p]).toFixed(2) : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum dado de NAV encontrado. Faça upload de um arquivo CSV para começar.
            </div>
          )}
        </>
      )}
    </div>
  );
}
