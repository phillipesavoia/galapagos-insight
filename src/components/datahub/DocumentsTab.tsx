import { useState, useRef } from "react";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDocuments, Document } from "@/hooks/useDocuments";
import { UploadModal } from "@/components/library/UploadModal";

function getAgeBadge(uploadDate: string | null) {
  if (!uploadDate) return <Badge variant="secondary">—</Badge>;
  const now = new Date();
  const uploaded = new Date(uploadDate);
  const diffDays = Math.floor((now.getTime() - uploaded.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 60) {
    return <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/20">Atualizado</Badge>;
  } else if (diffDays <= 90) {
    return <Badge className="bg-warning/15 text-warning border-warning/20 hover:bg-warning/20">Atenção</Badge>;
  } else {
    return <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/20">Vencido — Atualizar</Badge>;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatType(type: string | null) {
  const map: Record<string, string> = {
    factsheet: "Factsheet",
    carta_mensal: "Carta Mensal",
    apresentacao: "Apresentação",
    outro: "Outro",
  };
  return type ? map[type] || type : "—";
}

export function DocumentsTab() {
  const { documents, loading, uploadDocument, deleteDocument } = useDocuments();
  const [dragActive, setDragActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".docx")
    );
    if (files.length > 0) {
      setDroppedFiles(files);
      setModalOpen(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setDroppedFiles(files);
      setModalOpen(true);
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-8">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-card/50"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Arraste factsheets e apresentações aqui
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX · Múltiplos arquivos permitidos
            </p>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documento</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Portfólio</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data de Upload</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Carregando documentos...
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum documento enviado ainda.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        {doc.status === "processing" ? (
                          <Loader2 className="h-4 w-4 text-primary animate-spin" strokeWidth={1.5} />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground block break-words">{doc.name}</span>
                        {doc.status === "processing" && (
                          <span className="text-xs text-primary">Processando Inteligência...</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{doc.fund_name || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground">
                      {formatType(doc.type)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{formatDate(doc.uploaded_at)}</span>
                  </TableCell>
                  <TableCell>
                    {doc.status === "processing" ? (
                      <Badge className="bg-primary/15 text-primary border-primary/20">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Vetorizando
                      </Badge>
                    ) : doc.status === "error" ? (
                      <Badge variant="destructive">Erro</Badge>
                    ) : (
                      getAgeBadge(doc.uploaded_at)
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={() => deleteDocument(doc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setDroppedFiles([]); }}
        onUpload={uploadDocument}
        initialFiles={droppedFiles}
      />
    </div>
  );
}
