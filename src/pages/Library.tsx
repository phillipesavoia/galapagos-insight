import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Search, Plus, BarChart3, FileText, Presentation, ClipboardList, Eye, RefreshCw, Trash2, Upload, X, CheckCircle } from "lucide-react";

interface Document {
  id: string;
  name: string;
  type: "factsheet" | "carta_mensal" | "apresentacao" | "outro";
  fundName: string;
  period: string;
  status: "indexed" | "processing" | "error";
  chunkCount: number;
}

const mockDocuments: Document[] = [
  { id: "1", name: "Factsheet Macro Global", type: "factsheet", fundName: "Macro Global", period: "Fev 2025", status: "indexed", chunkCount: 24 },
  { id: "2", name: "Carta Mensal Q4", type: "carta_mensal", fundName: "Macro Global", period: "Jan 2025", status: "indexed", chunkCount: 18 },
  { id: "3", name: "Factsheet Crédito Plus", type: "factsheet", fundName: "Crédito Plus", period: "Fev 2025", status: "indexed", chunkCount: 22 },
  { id: "4", name: "Apresentação Trimestral", type: "apresentacao", fundName: "Total Return", period: "Q4 2024", status: "indexed", chunkCount: 45 },
  { id: "5", name: "Factsheet Total Return", type: "factsheet", fundName: "Total Return", period: "Fev 2025", status: "processing", chunkCount: 0 },
  { id: "6", name: "Carta Mensal Crédito", type: "carta_mensal", fundName: "Crédito Plus", period: "Jan 2025", status: "indexed", chunkCount: 16 },
  { id: "7", name: "Equity Long Short Overview", type: "apresentacao", fundName: "Equity Long Short", period: "2024", status: "indexed", chunkCount: 38 },
  { id: "8", name: "Relatório EM Debt", type: "outro", fundName: "EM Debt Opportunities", period: "Fev 2025", status: "processing", chunkCount: 0 },
  { id: "9", name: "Factsheet Equity LS", type: "factsheet", fundName: "Equity Long Short", period: "Jan 2025", status: "indexed", chunkCount: 20 },
];

const typeIcons: Record<string, React.ComponentType<any>> = {
  factsheet: BarChart3,
  carta_mensal: FileText,
  apresentacao: Presentation,
  outro: ClipboardList,
};

const typeLabels: Record<string, string> = {
  factsheet: "Factsheet",
  carta_mensal: "Carta Mensal",
  apresentacao: "Apresentação",
  outro: "Outro",
};

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
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const filtered = mockDocuments.filter((doc) => {
    const matchesSearch = !search || doc.name.toLowerCase().includes(search.toLowerCase()) || doc.fundName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filterMap[activeFilter] || doc.type === filterMap[activeFilter];
    return matchesSearch && matchesFilter;
  });

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Base de Conhecimento</h1>
          <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" strokeWidth={1.5} /> Novo Documento
          </button>
        </div>

        {/* Filters */}
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

        {/* Grid */}
        <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2">
          {filtered.map((doc) => {
            const Icon = typeIcons[doc.type] || ClipboardList;
            return (
              <div
                key={doc.id}
                onMouseEnter={() => setHoveredCard(doc.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className="relative p-6 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{doc.name}</h3>
                    <p className="text-sm text-primary mt-0.5">{doc.fundName}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground">{doc.period}</span>
                      {doc.status === "indexed" ? (
                        <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Indexado
                        </span>
                      ) : doc.status === "processing" ? (
                        <span className="px-2 py-0.5 rounded-md bg-warning/15 text-warning text-xs animate-pulse">Processando...</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-destructive/15 text-destructive text-xs">Erro</span>
                      )}
                    </div>
                    {doc.status === "indexed" && (
                      <p className="text-xs text-muted-foreground mt-2">{doc.chunkCount} chunks</p>
                    )}
                  </div>
                </div>

                {/* Hover actions */}
                {hoveredCard === doc.id && (
                  <div className="absolute bottom-4 right-4 flex gap-1.5">
                    {[
                      { icon: Eye, label: "Ver detalhes" },
                      { icon: RefreshCw, label: "Reindexar" },
                      { icon: Trash2, label: "Excluir" },
                    ].map(({ icon: ActionIcon, label }) => (
                      <button
                        key={label}
                        title={label}
                        className="p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ActionIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-foreground">Novo Documento</h2>
                <button onClick={() => setShowUploadModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Drop zone */}
              <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center mb-4 hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
                <p className="text-sm text-foreground font-medium">Arraste e solte o arquivo aqui</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar (PDF, DOCX)</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Tipo de documento</label>
                  <select className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    <option>Factsheet</option>
                    <option>Carta Mensal</option>
                    <option>Apresentação</option>
                    <option>Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Nome do fundo</label>
                  <input placeholder="Ex: Macro Global" className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Período</label>
                  <input type="month" className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]" />
                </div>
              </div>

              <button className="w-full mt-4 bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium hover:bg-primary/90 transition-colors">
                Fazer Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
