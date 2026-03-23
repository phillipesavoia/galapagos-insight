import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Download } from "lucide-react";
import Papa from "papaparse";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PORTFOLIO_COLS = ["Conservative", "Income", "Balanced", "Growth", "Bond Portfolio", "Liquidity"];
const BENCHMARK_SUFFIX = " Benchmark";
const BLOOMBERG_FORMAT_MARKER = "Start Date";

interface NavRow {
  portfolio_name: string;
  date: string;
  nav: number;
  daily_return: number | null;
  ytd_return: number | null;
}

function parseUSDate(raw: string): string | null {
  const parts = raw.trim().split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  const yyyy = y.length === 2 ? `20${y}` : y;
  return `${yyyy}-${mm}-${dd}`;
}

export default function NavUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      setFile(f);
      setResult(null);
      setValidationError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setValidationError(null);
    setResult(null);

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await import("xlsx");
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          await parseAndUploadRows(rows);
        } catch (err) {
          setValidationError(`Erro ao ler Excel: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
          setUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: async (parsed) => {
          await parseAndUploadRows(parsed.data as any[][]);
        },
        error: (err) => {
          setValidationError(`Erro ao ler CSV: ${err.message}`);
          setUploading(false);
        },
      });
    }
  };

  const parseAndUploadRows = async (rows: any[][]) => {
    if (!rows || rows.length < 3) {
      setValidationError("Arquivo inválido — linhas insuficientes.");
      setUploading(false);
      return;
    }

    const isBloomberg = String(rows[0]?.[0] || "").trim() === BLOOMBERG_FORMAT_MARKER;

    let headerRowIndex = 0;
    let dataStartIndex = 1;

    if (isBloomberg) {
      // Bloomberg format: dynamically find the row containing "Dates"
      // Row 0 = Start Date, Row 1 = End Date, Row 2 = portfolio names,
      // Row 3 = tickers, Row 4 = "Dates" + data headers
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const firstCell = String(rows[i]?.[0] || "").trim().toLowerCase();
        if (firstCell === "dates" || firstCell === "date") {
          headerRowIndex = i;
          dataStartIndex = i + 1;
          break;
        }
      }
      // If no "Dates" row found, try row 2 as fallback for portfolio names
      if (headerRowIndex === 0) {
        // Look for portfolio names row
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const rowValues = rows[i].map((v: any) => String(v || "").trim());
          if (PORTFOLIO_COLS.some(p => rowValues.includes(p))) {
            headerRowIndex = i;
            dataStartIndex = i + 2; // skip tickers row
            break;
          }
        }
      }
    }

    const headerRow = rows[headerRowIndex].map((h: any) => String(h || "").trim());

    // Find Dates column index — look in header row and also check if 
    // first column of data rows contains dates
    let datesIdx = headerRow.findIndex((h: string) => 
      h.toLowerCase() === "dates" || h.toLowerCase() === "date"
    );
    
    // If not found in header, assume first column is dates
    if (datesIdx === -1 && isBloomberg) {
      datesIdx = 0;
    }

    if (datesIdx === -1) {
      setValidationError("Coluna 'Dates' não encontrada. Verifique o formato do arquivo.");
      setUploading(false);
      return;
    }

    const portfolioColMap: Record<string, number> = {};
    const benchmarkColMap: Record<string, number> = {};

    headerRow.forEach((header: string, idx: number) => {
      if (idx === datesIdx) return;
      const cleanHeader = header.replace(BENCHMARK_SUFFIX, "").trim();
      if (header.includes(BENCHMARK_SUFFIX)) {
        if (PORTFOLIO_COLS.includes(cleanHeader)) {
          benchmarkColMap[cleanHeader] = idx;
        }
      } else if (PORTFOLIO_COLS.includes(header)) {
        portfolioColMap[header] = idx;
      }
    });

    const foundPortfolios = Object.keys(portfolioColMap);
    if (foundPortfolios.length === 0) {
      setValidationError(`Nenhuma coluna de portfólio encontrada. Esperado: ${PORTFOLIO_COLS.join(", ")}`);
      setUploading(false);
      return;
    }

    const dataRows = rows.slice(dataStartIndex);
    const perPortfolio: Record<string, { date: string; nav: number }[]> = {};
    for (const col of foundPortfolios) perPortfolio[col] = [];

    for (const row of dataRows) {
      const rawDate = String(row[datesIdx] || "").trim();
      if (!rawDate) continue;

      let isoDate: string | null = null;
      if (/^\d+$/.test(rawDate)) {
        const excelDate = new Date(Date.UTC(1899, 11, 30) + parseInt(rawDate) * 86400000);
        isoDate = excelDate.toISOString().slice(0, 10);
      } else {
        isoDate = parseUSDate(rawDate);
      }

      if (!isoDate) continue;

      for (const col of foundPortfolios) {
        const val = parseFloat(String(row[portfolioColMap[col]] || "").replace(/[,%\s]/g, ""));
        if (!isNaN(val) && val > 0) {
          perPortfolio[col].push({ date: isoDate, nav: val });
        }
      }
    }

    const allRows: NavRow[] = [];

    for (const portfolio of foundPortfolios) {
      const entries = perPortfolio[portfolio].sort((a, b) => a.date.localeCompare(b.date));

      const navByYear: Record<number, number> = {};
      for (const e of entries) {
        const year = parseInt(e.date.substring(0, 4));
        navByYear[year] = e.nav;
      }

      let prevNav: number | null = null;

      for (const entry of entries) {
        const year = parseInt(entry.date.substring(0, 4));

        const daily_return = prevNav !== null
          ? parseFloat((((entry.nav - prevNav) / prevNav) * 100).toFixed(4))
          : null;

        const prevYearBase = navByYear[year - 1] ?? null;
        const ytd_return = prevYearBase !== null
          ? parseFloat((((entry.nav - prevYearBase) / prevYearBase) * 100).toFixed(4))
          : null;

        allRows.push({ portfolio_name: portfolio, date: entry.date, nav: entry.nav, daily_return, ytd_return });
        prevNav = entry.nav;
      }
    }

    if (allRows.length === 0) {
      setValidationError("Nenhuma linha válida encontrada.");
      setUploading(false);
      return;
    }

    let success = 0;
    let errors = 0;
    const BATCH = 500;

    for (let i = 0; i < allRows.length; i += BATCH) {
      const batch = allRows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("daily_navs")
        .upsert(batch as any, { onConflict: "portfolio_name,date" });

      if (error) { errors += batch.length; console.error("Upsert error:", error); }
      else { success += batch.length; }
    }

    setResult({ success, errors });
    toast({ title: "Upload concluído", description: `${success} registros inseridos, ${errors} erros.` });
    setUploading(false);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col bg-background">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Upload de NAV Diário
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe o CSV/Excel no formato:{" "}
            <code className="text-xs bg-secondary px-1 py-0.5 rounded">
              Formato Bloomberg: Conservative, Income, Balanced, Growth, Bond Portfolio, Liquidity + Benchmarks
            </code>
          </p>
        </div>

        <div className="flex-1 flex items-start justify-center p-8">
          <div className="w-full max-w-lg space-y-6">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-accent/5 transition-colors cursor-pointer"
            >
              {file ? (
                <>
                  <FileSpreadsheet className="h-10 w-10 text-primary" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB — Clique para trocar
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
                  <p className="text-sm text-foreground font-medium">
                    Clique para selecionar um CSV ou Excel
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formato Bloomberg: Dates, Conservative, Income, Balanced, Growth, Bond Portfolio, Liquidity
                  </p>
                </>
              )}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {validationError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {validationError}
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => {
                import("xlsx").then((XLSX) => {
                  const templateData = [
                    ["Start Date", "9/22/2022", "", "", "", "", "", "", "", "", "", "", ""],
                    ["End Date", "", "", "", "", "", "", "", "", "", "", "", ""],
                    ["Dates", "Conservative", "Conservative Benchmark", "Income", "Income Benchmark", "Balanced", "Balanced Benchmark", "Growth", "Growth Benchmark", "Bond Portfolio", "Bond Portfolio New", "Liquidity", ""],
                    ["", ".CONS_MODG Index", ".CONS_BENC Index", ".INC_MODG Index", ".INC_BENC Index", ".BAL_MODG Index", ".BAL_BENC Index", ".GROW_MODG Index", ".GROW_BENC Index", ".BONDPORTG Index", ".BONDS20 Index", ".LIQ_MODEL Index", ""],
                    ["9/22/2022", 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, ""],
                    ["9/23/2022", 98.52, 99.1, 100, 100.2, 98.20, 98.5, "", "", 99.70, "", 97.66, ""],
                  ];
                  const ws = XLSX.utils.aoa_to_sheet(templateData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "NAV Data");
                  XLSX.writeFile(wb, "nav_template.xlsx");
                });
              }}
              className="w-full"
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template Excel
            </Button>

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : result ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {result.success} registros inseridos
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar CSV / Excel
                </>
              )}
            </Button>

            {result && (
              <p className="text-xs text-center text-muted-foreground">
                {result.errors > 0
                  ? `${result.errors} linhas falharam. Verifique o formato e tente novamente.`
                  : "Todos os registros foram inseridos com sucesso."}
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
