import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NavRow {
  portfolio_name: string;
  date: string;
  nav: number;
  daily_return: number | null;
  ytd_return: number | null;
}

const REQUIRED_COLS = ["portfolio_name", "date", "nav"];

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
        const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));

        if (missing.length > 0) {
          setValidationError(`Colunas obrigatórias ausentes: ${missing.join(", ")}`);
          setUploading(false);
          return;
        }

        const rows: NavRow[] = [];
        for (const raw of parsed.data as Record<string, string>[]) {
          const nav = parseFloat(raw.nav);
          if (!raw.portfolio_name || !raw.date || isNaN(nav)) continue;
          rows.push({
            portfolio_name: raw.portfolio_name.trim(),
            date: raw.date.trim(),
            nav,
            daily_return: raw.daily_return ? parseFloat(raw.daily_return) : null,
            ytd_return: raw.ytd_return ? parseFloat(raw.ytd_return) : null,
          });
        }

        if (rows.length === 0) {
          setValidationError("Nenhuma linha válida encontrada no CSV.");
          setUploading(false);
          return;
        }

        // Upsert in batches of 500
        let success = 0;
        let errors = 0;
        const BATCH = 500;

        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
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
            Importe arquivos CSV com colunas: <code className="text-xs bg-secondary px-1 py-0.5 rounded">portfolio_name, date, nav, daily_return, ytd_return</code>
          </p>
        </div>

        <div className="flex-1 flex items-start justify-center p-8">
          <div className="w-full max-w-lg space-y-6">
            {/* Drop zone */}
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
                    Formato: portfolio_name, date, nav, daily_return, ytd_return
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
