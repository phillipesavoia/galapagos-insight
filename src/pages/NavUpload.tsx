import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PORTFOLIO_COLS = ["Conservative", "Income", "Balanced", "Growth"];

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
    if (f && f.name.endsWith(".csv")) {
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

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const headers = parsed.meta.fields || [];

        // Validate: must have "Dates" column and at least one portfolio column
        if (!headers.includes("Dates")) {
          setValidationError("Coluna 'Dates' não encontrada. O CSV deve ter o formato: Dates, Conservative, Income, Balanced, Growth");
          setUploading(false);
          return;
        }

        const foundPortfolios = PORTFOLIO_COLS.filter((c) => headers.includes(c));
        if (foundPortfolios.length === 0) {
          setValidationError(`Nenhuma coluna de portfólio encontrada. Esperado: ${PORTFOLIO_COLS.join(", ")}`);
          setUploading(false);
          return;
        }

        // Unpivot wide → long, sorted by date per portfolio
        const rawData = parsed.data as Record<string, string>[];

        // Build per-portfolio sorted arrays
        const perPortfolio: Record<string, { date: string; nav: number }[]> = {};
        for (const col of foundPortfolios) {
          perPortfolio[col] = [];
        }

        for (const row of rawData) {
          const isoDate = parseUSDate(row["Dates"] || "");
          if (!isoDate) continue;

          for (const col of foundPortfolios) {
            const val = parseFloat(row[col]);
            if (!isNaN(val)) {
              perPortfolio[col].push({ date: isoDate, nav: val });
            }
          }
        }

        // Sort each portfolio by date and compute returns
        const allRows: NavRow[] = [];

        for (const portfolio of foundPortfolios) {
          const entries = perPortfolio[portfolio].sort((a, b) => a.date.localeCompare(b.date));

          // Find YTD base NAVs: last NAV of each prior year
          const navByYear: Record<number, number> = {};
          for (const e of entries) {
            const year = parseInt(e.date.substring(0, 4));
            navByYear[year] = e.nav; // will keep overwriting, last entry of that year wins
          }

          // We need the last NAV of the PREVIOUS year for YTD calc.
          // So we first collect all entries sorted, then compute.
          let prevNav: number | null = null;

          for (const entry of entries) {
            const year = parseInt(entry.date.substring(0, 4));

            // daily_return
            const daily_return = prevNav !== null
              ? parseFloat((((entry.nav - prevNav) / prevNav) * 100).toFixed(4))
              : null;

            // ytd_return: compare to last NAV of previous year
            const prevYearBase = navByYear[year - 1] ?? null;
            const ytd_return = prevYearBase !== null
              ? parseFloat((((entry.nav - prevYearBase) / prevYearBase) * 100).toFixed(4))
              : null;

            allRows.push({
              portfolio_name: portfolio,
              date: entry.date,
              nav: entry.nav,
              daily_return,
              ytd_return,
            });

            prevNav = entry.nav;
          }
        }

        if (allRows.length === 0) {
          setValidationError("Nenhuma linha válida encontrada no CSV.");
          setUploading(false);
          return;
        }

        // Upsert in batches of 500
        let success = 0;
        let errors = 0;
        const BATCH = 500;

        for (let i = 0; i < allRows.length; i += BATCH) {
          const batch = allRows.slice(i, i + BATCH);
          const { error } = await supabase
            .from("daily_navs")
            .upsert(batch as any, { onConflict: "portfolio_name,date" });

          if (error) {
            console.error("Upsert error:", error);
            errors += batch.length;
          } else {
            success += batch.length;
          }
        }

        setResult({ success, errors });
        toast({
          title: "Upload concluído",
          description: `${success} registros inseridos, ${errors} erros.`,
        });
        setUploading(false);
      },
      error: (err) => {
        setValidationError(`Erro ao ler CSV: ${err.message}`);
        setUploading(false);
      },
    });
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col bg-background">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Upload de NAV Diário
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe o CSV no formato:{" "}
            <code className="text-xs bg-secondary px-1 py-0.5 rounded">
              Dates, Conservative, Income, Balanced, Growth
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
                    Clique para selecionar um CSV
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formato wide: Dates, Conservative, Income, Balanced, Growth
                  </p>
                </>
              )}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".csv"
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
                  Enviar CSV
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
