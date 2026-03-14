import { useState, useRef } from "react";
import { X, Upload } from "lucide-react";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, meta: { name: string; type: string; fund_name: string; period: string }) => Promise<boolean>;
}

const typeOptions = [
  { value: "factsheet", label: "Factsheet" },
  { value: "carta_mensal", label: "Carta Mensal" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "outro", label: "Outro" },
];

export function UploadModal({ open, onClose, onUpload }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("factsheet");
  const [fundName, setFundName] = useState("");
  const [period, setPeriod] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    const success = await onUpload(file, {
      name: file.name,
      type: docType,
      fund_name: fundName,
      period,
    });
    setUploading(false);
    if (success) {
      setFile(null);
      setFundName("");
      setPeriod("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Novo Documento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" disabled={uploading}>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center mb-4 hover:border-primary/50 transition-colors cursor-pointer"
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
          {file ? (
            <p className="text-sm text-foreground font-medium">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-foreground font-medium">Arraste e solte o arquivo aqui</p>
              <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar (PDF, DOCX)</p>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tipo de documento</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome do fundo</label>
            <input
              value={fundName}
              onChange={(e) => setFundName(e.target.value)}
              placeholder="Ex: Macro Global"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Período</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!file || uploading}
          className="w-full mt-4 bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {uploading ? "Processando..." : "Fazer Upload"}
        </button>
      </div>
    </div>
  );
}
