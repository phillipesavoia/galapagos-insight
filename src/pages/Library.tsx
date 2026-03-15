import { useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Search, Plus, Upload, Trash2, Loader2 } from "lucide-react";
import { useDocuments } from "@/hooks/useDocuments";
import { DocumentCard } from "@/components/library/DocumentCard";
import { UploadModal } from "@/components/library/UploadModal";

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
  const { documents, loading, uploadDocument, deleteDocument } = useDocuments();

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
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Nenhum documento encontrado.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2">
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onDelete={deleteDocument} />
            ))}
          </div>
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
