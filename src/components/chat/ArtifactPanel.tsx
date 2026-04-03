import { useState, useEffect, useRef } from "react";
import { X, Download, FileText, ClipboardCopy, Check, Loader2, ExternalLink, Printer } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

export interface ArtifactData {
  title: string;
  content: string;
  artifact_type: "report" | "analysis" | "factsheet";
  chartCalls?: Array<{ tool: string; input: any }>;
}

interface Props {
  artifact: ArtifactData;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: Props) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPptx, setIsGeneratingPptx] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function generateHtml() {
      setIsGenerating(true);
      setError(null);
      setGeneratedHtml(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('generate-artifact-html', {
          body: {
            title: artifact.title,
            content: artifact.content,
            chartCalls: artifact.chartCalls || [],
          },
        });

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);
        if (!cancelled) {
          setGeneratedHtml(data.html);
          console.log("Generated HTML length:", data.html?.length);
          console.log("Has ECharts script:", data.html?.includes('echarts'));
          console.log("HTML preview:", data.html?.substring(0, 500));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao gerar relatório");
        }
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    }

    generateHtml();
    return () => { cancelled = true; };
  }, [artifact.title, artifact.content, artifact.chartCalls]);

  useEffect(() => {
    if (!generatedHtml) { setIframeUrl(null); return; }
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setIframeUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [generatedHtml]);

  const handleDownloadPPTX = async () => {
    if (!artifact.content) return;
    setIsGeneratingPptx(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-pptx', {
        body: { title: artifact.title, content: artifact.content, chartCalls: artifact.chartCalls || [] }
      });
      if (fnError || !data?.pptx) throw new Error(fnError?.message || "Failed");
      const binary = atob(data.pptx);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName || `${artifact.title.replace(/\s+/g, "_")}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PPTX error:", e);
    } finally {
      setIsGeneratingPptx(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([artifact.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openInNewTab = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const typeLabel = {
    report: "Relatório",
    analysis: "Análise",
    factsheet: "Factsheet",
  }[artifact.artifact_type] || "Documento";

  const loadingHtml = `<!DOCTYPE html>
<html><head><style>
  body { display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F4F7FB; font-family: 'Helvetica Neue', Arial, sans-serif; }
  .loader { text-align: center; color: #173C82; }
  .spinner { width: 40px; height: 40px; border: 4px solid #d1dce8; border-top-color: #173C82; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { font-size: 14px; font-weight: 500; }
</style></head><body>
  <div class="loader"><div class="spinner"></div><p>Gerando relatório...</p></div>
</body></html>`;

  const errorHtml = `<!DOCTYPE html>
<html><head><style>
  body { display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F4F7FB; font-family: 'Helvetica Neue', Arial, sans-serif; }
  .error { text-align: center; color: #e53e3e; max-width: 400px; padding: 24px; }
  h2 { margin-bottom: 8px; font-size: 16px; }
  p { font-size: 13px; color: #666; }
</style></head><body>
  <div class="error"><h2>Erro ao gerar relatório</h2><p>${error || "Tente novamente"}</p></div>
</body></html>`;

  

  return (
    <div
      className={`${
        isMobile
          ? "fixed inset-0 z-50"
          : "w-[520px] shrink-0 border-l border-border"
      } flex flex-col h-full animate-in slide-in-from-right duration-300 bg-background`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "#173C82" }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
            {typeLabel}
          </span>
          <span className="text-sm font-semibold text-white truncate">{artifact.title}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={isGenerating ? undefined : iframeUrl || undefined}
          srcDoc={isGenerating ? loadingHtml : error ? errorHtml : undefined}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Relatório"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ background: "#F4F7FB", borderTop: "1px solid #d1dce8" }}>
        <button
          onClick={handleDownloadPPTX}
          disabled={isGeneratingPptx}
          className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white disabled:opacity-40"
        >
          {isGeneratingPptx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {isGeneratingPptx ? "Gerando PPTX..." : "⬇ Download PPTX"}
        </button>
        <button
          onClick={openInNewTab}
          disabled={!generatedHtml}
          className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          🔗 Ver Relatório
        </button>
        <button
          onClick={handleDownloadMarkdown}
          className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white"
        >
          <FileText className="h-3.5 w-3.5" />
          Markdown
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copied ? "✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
