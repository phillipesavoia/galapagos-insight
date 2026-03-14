import { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, Trash2 } from "lucide-react";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, meta: { name: string; type: string; fund_name: string; period: string }) => Promise<boolean>;
  initialFiles?: File[];
}

const typeOptions = [
  { value: "factsheet", label: "Factsheet" },
  { value: "carta_mensal", label: "Carta Mensal" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "outro", label: "Outro" },
];

interface FileEntry {
  file: File;
  docType: string;
  fundName: string;
  period: string;
  status: "pending" | "uploading" | "done" | "error";
}

export function UploadModal({ open, onClose, onUpload, initialFiles }: UploadModalProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset files when modal opens/closes, load initial files from drag-and-drop
  useEffect(() => {
    if (open) {
      if (initialFiles && initialFiles.length > 0) {
        const entries: FileEntry[] = initialFiles.map((f) => ({
          file: f,
          docType: "factsheet",
          fundName: "",
          period: "",
          status: "pending" as const,
        }));
        setFiles(entries);
      } else {
        setFiles([]);
      }
    } else {
      setFiles([]);
    }
  }, [open, initialFiles]);

  if (!open) return null;

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const entries: FileEntry[] = Array.from(newFiles).map((f) => ({
      file: f,
      docType: "factsheet",
      fundName: "",
      period: "",
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...entries]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFile = (index: number, updates: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status === "done") continue;

      updateFile(i, { status: "uploading" });
      const success = await onUpload(entry.file, {
        name: entry.file.name,
        type: entry.docType,
        fund_name: entry.fundName,
        period: entry.period,
      });
      updateFile(i, { status: success ? "done" : "error" });
    }

    setUploading(false);
    const allDone = files.every((f) => f.status === "done");
    if (allDone) {
      setTimeout(() => {
        setFiles([]);
        onClose();
      }, 500);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const pendingCount = files.filter((f) => f.status !== "done").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Upload de Documentos
            {files.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({doneCount}/{files.length} processados)
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" disabled={uploading}>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed border-primary/30 rounded-xl p-6 text-center mb-4 transition-colors ${
            uploading ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 cursor-pointer"
          }`}
        >
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" strokeWidth={1.5} />
          <p className="text-sm text-foreground font-medium">Arraste arquivos aqui ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX · Múltiplos arquivos permitidos</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
            {files.map((entry, i) => (
              <div
                key={`${entry.file.name}-${i}`}
                className={`border rounded-lg p-3 transition-colors ${
                  entry.status === "done"
                    ? "border-primary/30 bg-primary/5"
                    : entry.status === "error"
                    ? "border-destructive/30 bg-destructive/5"
                    : entry.status === "uploading"
                    ? "border-primary/20 bg-primary/5 animate-pulse"
                    : "border-border bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-sm text-foreground font-medium truncate flex-1">
                    {entry.file.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(entry.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {entry.status === "done" && (
                    <span className="text-xs text-primary font-medium">✓</span>
                  )}
                  {entry.status === "error" && (
                    <span className="text-xs text-destructive font-medium">Erro</span>
                  )}
                  {entry.status === "pending" && !uploading && (
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                {entry.status !== "done" && (
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={entry.docType}
                      onChange={(e) => updateFile(i, { docType: e.target.value })}
                      disabled={uploading}
                      className="bg-secondary border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      {typeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      value={entry.fundName}
                      onChange={(e) => updateFile(i, { fundName: e.target.value })}
                      placeholder="Fundo"
                      disabled={uploading}
                      className="bg-secondary border border-border rounded-md px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <input
                      type="month"
                      value={entry.period}
                      onChange={(e) => updateFile(i, { period: e.target.value })}
                      disabled={uploading}
                      className="bg-secondary border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={files.length === 0 || uploading || pendingCount === 0}
          className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {uploading
            ? `Processando... (${doneCount}/${files.length})`
            : `Fazer Upload${files.length > 1 ? ` (${files.length} arquivos)` : files.length === 1 ? "" : ""}`}
        </button>
      </div>
    </div>
  );
}
