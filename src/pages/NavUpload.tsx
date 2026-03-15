import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

export default function NavUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.name.endsWith(".csv")) {
      setFile(f);
      setUploaded(false);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    // TODO: integrate with Supabase edge function to process CSV
    setUploaded(true);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col bg-background">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Upload de NAV Diário
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe arquivos CSV exportados da Bloomberg com os NAVs diários dos modelos
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
                    Formato esperado: Data, Portfólio, NAV
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

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={!file || uploaded}
              className="w-full"
              size="lg"
            >
              {uploaded ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Arquivo recebido
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar CSV
                </>
              )}
            </Button>

            {uploaded && (
              <p className="text-xs text-center text-muted-foreground">
                Processamento será integrado na próxima fase com a edge function de ingestão.
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
