import { useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Search, Plus, Upload, Trash2, Loader2, FileText, Zap } from "lucide-react";
import { useDocuments } from "@/hooks/useDocuments";
import { DocumentCard } from "@/components/library/DocumentCard";
import { UploadModal } from "@/components/library/UploadModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const filterChips = ["Todos", "Factsheets", "Cartas Mensais", "Apresentações", "Outros"];
const filterMap: Record<string, string | null> = {
  Todos: null,
  Factsheets: "factsheet",
  "Cartas Mensais": "carta_mensal",
  Apresentações: "apresentacao",
  Outros: "outro",
};

export default function Library() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportPeriod, setReportPeriod] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const { documents, loading, uploadDocument, deleteDocument, fetchDocuments } = useDocuments();
  const { toast } = useToast();

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      (doc.fund_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filterMap[activeFilter] || doc.type === filterMap[activeFilter];
    return matchesSearch && matchesFilter;
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".docx")
    );
    if (files.length > 0) {
      setDroppedFiles(files);
      setShowUploadModal(true);
    }
  }, []);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: presentations } = await supabase
        .from("documents")
        .select("id, name")
        .eq("type", "apresentacao")
        .eq("status", "indexed")
        .eq("period", reportPeriod);

      if (!presentations || presentations.length < 2) {
        toast({
          title: "Apresentações insuficientes",
          description: `É necessário ter a Mercadológica e o IC Meeting do período ${reportPeriod} indexados.`,
          variant: "destructive",
        });
        setGeneratingReport(false);
        return;
      }

      const { data, error: invokeError } = await supabase.functions.invoke('generate-report', {
        body: {
          document_ids: presentations.map(p => p.id),
          period: reportPeriod,
        },
      });

      if (invokeError) throw invokeError;
      if (data.success) {
        toast({
          title: "Relatório gerado com sucesso",
          description: `${data.name} — gerado com sucesso.`,
        });
        setTimeout(() => fetchDocuments(), 2000);
      } else {
        toast({
          title: "Erro ao gerar relatório",
          description: data.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao conectar com o servidor.",
        variant: "destructive",
      });
    }
    setGeneratingReport(false);
  };

  const reports = filtered.filter(d => 
    d.type === "relatorio" || d.type === "Relatorio" || d.type === "report"
  );
  const presentations = filtered.filter(d => d.type === "apresentacao");
  const others = filtered.filter(d => d.type !== "relatorio" && d.type !== "apresentacao");

  return (
    <Layout>
      <div
        className="p-6 relative min-h-full"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-40 bg-primary/5 border-2 border-dashed border-primary/40 rounded-xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
            <div className="text-center">
              <Upload className="h-10 w-10 mx-auto text-primary mb-3" strokeWidth={1.5} />
              <p className="text-lg font-medium text-primary">Solte os arquivos aqui</p>
              <p className="text-sm text-muted-foreground mt-1">PDF, DOCX</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Base de Conhecimento</h1>
          <div className="flex items-center gap-2">
            {documents.length > 0 && (
              <button
                disabled={deleting}
                onClick={async () => {
                  if (!confirm(`Excluir todos os ${documents.length} documentos? Esta ação é irreversível.`)) return;
                  setDeleting(true);
                  for (const doc of documents) {
                    await deleteDocument(doc.id);
                  }
                  setDeleting(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Trash2 className="h-4 w-4" strokeWidth={1.5} />}
                {deleting ? "Excluindo..." : "Excluir Todos"}
              </button>
            )}
            <button
              onClick={() => { setDroppedFiles([]); setShowUploadModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} /> Novo Documento
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por fundo, período ou tipo..."
              className="w-full bg-secondary border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-1.5">
            {filterChips.map((chip) => (
              <button
                key={chip}
                onClick={() => setActiveFilter(chip)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  activeFilter === chip
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Carregando documentos...</div>
        ) : filtered.length === 0 && reports.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Nenhum documento encontrado.</div>
        ) : (
          <>
            {/* Report Generator Card */}
            <div className="mb-6 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    Relatórios Mensais
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gerados automaticamente ao indexar Mercadológica + IC Meeting do mesmo período
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={reportPeriod}
                    onChange={e => setReportPeriod(e.target.value)}
                    className="h-8 px-2 text-xs rounded-lg border border-border bg-secondary text-foreground"
                  />
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {generatingReport ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> Gerando...</>
                    ) : (
                      <><Zap className="h-3.5 w-3.5" strokeWidth={1.5} /> Gerar relatório</>
                    )}
                  </button>
                </div>
              </div>
              {reports.length > 0 && (
                <div className="mt-4 space-y-2">
                  {reports.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-xs font-medium text-foreground">{doc.name}</span>
                        <span className="text-xs text-muted-foreground">{doc.period}</span>
                        <span className="text-xs text-muted-foreground">· {doc.chunk_count} seções</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        Indexado
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {reports.length === 0 && (
                <p className="mt-3 text-xs text-muted-foreground italic">
                  Nenhum relatório gerado ainda. Faça upload da Mercadológica e do IC Meeting do mesmo período.
                </p>
              )}
            </div>

            {/* Presentations */}
            {presentations.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  Apresentações ({presentations.length})
                </h3>
                <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2">
                  {presentations.map(doc => (
                    <DocumentCard key={doc.id} doc={doc} onDelete={deleteDocument} />
                  ))}
                </div>
              </div>
            )}

            {/* Other documents */}
            {others.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  Outros documentos ({others.length})
                </h3>
                <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2">
                  {others.map(doc => (
                    <DocumentCard key={doc.id} doc={doc} onDelete={deleteDocument} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <UploadModal
          open={showUploadModal}
          onClose={() => { setShowUploadModal(false); setDroppedFiles([]); }}
          onUpload={uploadDocument}
          initialFiles={droppedFiles}
        />
      </div>
    </Layout>
  );
}
