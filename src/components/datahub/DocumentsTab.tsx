import { useState, useRef } from "react";
import { Upload, FileText, Trash2 } from "lucide-react";
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

interface MockDocument {
  id: string;
  name: string;
  portfolio: string;
  uploadDate: string;
  type: string;
}

const mockDocuments: MockDocument[] = [
  { id: "1", name: "Factsheet Growth — Q4 2025.pdf", portfolio: "Growth", uploadDate: "2026-03-10", type: "Factsheet" },
  { id: "2", name: "Factsheet Balanced — Q4 2025.pdf", portfolio: "Balanced", uploadDate: "2026-02-15", type: "Factsheet" },
  { id: "3", name: "Apresentação Income — Jan 2026.pdf", portfolio: "Income", uploadDate: "2026-01-05", type: "Apresentação" },
  { id: "4", name: "Carta Mensal Conservative — Dez 2025.pdf", portfolio: "Conservative", uploadDate: "2025-11-20", type: "Carta Mensal" },
  { id: "5", name: "Factsheet Liquidity — Q3 2025.pdf", portfolio: "Liquidity", uploadDate: "2025-09-01", type: "Factsheet" },
];

function getAgeBadge(uploadDate: string) {
  const now = new Date("2026-03-17");
  const uploaded = new Date(uploadDate);
  const diffDays = Math.floor((now.getTime() - uploaded.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 60) {
    return <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/20">Atualizado</Badge>;
  } else if (diffDays <= 90) {
    return <Badge className="bg-warning/15 text-warning border-warning/20 hover:bg-warning/20">Atenção</Badge>;
  } else {
    return <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/20">Vencido</Badge>;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function DocumentsTab() {
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  return (
    <div className="space-y-8">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); }}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-card/50"
        }`}
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx" multiple className="hidden" />
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
            {mockDocuments.map((doc) => (
              <TableRow key={doc.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{doc.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{doc.portfolio}</span>
                </TableCell>
                <TableCell>
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground">{doc.type}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{formatDate(doc.uploadDate)}</span>
                </TableCell>
                <TableCell>{getAgeBadge(doc.uploadDate)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
