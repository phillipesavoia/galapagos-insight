import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Search, Plus } from "lucide-react";
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
  const { documents, loading, uploadDocument, deleteDocument } = useDocuments();

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      (doc.fund_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filterMap[activeFilter] || doc.type === filterMap[activeFilter];
    return matchesSearch && matchesFilter;
  });

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Base de Conhecimento</h1>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} /> Novo Documento
          </button>
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
          onClose={() => setShowUploadModal(false)}
          onUpload={uploadDocument}
        />
      </div>
    </Layout>
  );
}
