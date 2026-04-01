import { useState } from "react";
import { X, Download, FileText, ClipboardCopy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useIsMobile } from "@/hooks/use-mobile";

const GALAPAGOS_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAABYCAYAAADbc6GhAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfqBAERNTXfUZwz";

export interface ArtifactData {
  title: string;
  content: string;
  artifact_type: "report" | "analysis" | "factsheet";
}

interface Props {
  artifact: ArtifactData;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: Props) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);

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

  const handleDownloadPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;

    const htmlContent = artifact.content
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?:^\|.+\|$\n?)+/gm, (block) => {
        const rows = block.trim().split("\n").filter((r) => !/^\|[\s-:|]+\|$/.test(r));
        if (rows.length === 0) return block;
        const parseRow = (row: string) =>
          row.split("|").slice(1, -1).map((c) => c.trim());
        const headerCells = parseRow(rows[0]);
        const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
        const bodyRows = rows.slice(1).map(
          (r) => `<tr>${parseRow(r).map((c) => `<td>${c}</td>`).join("")}</tr>`
        ).join("");
        return `<table>${thead}<tbody>${bodyRows}</tbody></table>`;
      })
      .replace(/(?:^- .+$\n?)+/gm, (block) => {
        const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^- /, "")}</li>`).join("");
        return `<ul>${items}</ul>`;
      })
      .replace(/\n/g, "<br>");

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:absolute;left:-9999px;top:0;width:210mm;";
    wrapper.innerHTML = `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;line-height:1.7;font-size:12px;">
        <style>
          h1{color:#173C82;font-size:22px;border-bottom:2px solid #173C82;padding-bottom:8px}
          h2{color:#173C82;font-size:17px;margin-top:24px}
          h3{color:#173C82;font-size:14px;margin-top:18px}
          table{width:100%;border-collapse:collapse;margin:16px 0;font-size:11px}
          th{background:#173C82;color:white;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em}
          td{padding:6px 12px;border-bottom:1px solid #e5e7eb}
          tr:nth-child(even){background:#f8f9fb}
          ul{margin:8px 0;padding-left:20px}
          li{margin:2px 0}
          blockquote{border-left:3px solid #173C82;padding-left:16px;color:#64748b;margin:16px 0}
        </style>
        <div style="background:#173C82;color:white;padding:16px 24px;display:flex;justify-content:space-between;margin-bottom:24px"><span style="font-size:18px;font-weight:bold">Galapagos Capital Advisory</span><span style="font-size:11px;opacity:0.8">Confidencial</span></div>
        ${htmlContent}
        <div style="margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:10px;text-align:center">Galapagos Capital Advisory LLC — Documento Confidencial — Uso Exclusivo do Cliente</div>
      </div>`;
    document.body.appendChild(wrapper);

    await html2pdf().set({
      margin: 20,
      filename: artifact.title.replace(/\s+/g, "_") + ".pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from(wrapper.firstElementChild as HTMLElement).save();

    document.body.removeChild(wrapper);
  };

  const typeLabel = {
    report: "Relatório",
    analysis: "Análise",
    factsheet: "Factsheet",
  }[artifact.artifact_type] || "Documento";

  return (
    <div
      className={`${
        isMobile
          ? "fixed inset-0 z-50"
          : "w-[520px] shrink-0 border-l border-[#173C82]/20"
      } flex flex-col animate-in slide-in-from-right duration-300`}
      style={{ background: "#F4F7FB" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "#173C82" }}>
        <div className="flex items-center gap-2 min-w-0">
          <img src={GALAPAGOS_LOGO} alt="Galapagos" className="h-7 mr-3" />
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
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin" style={{ background: "#F4F7FB" }}>
        <div className="prose prose-sm max-w-none text-foreground [&_h1]:text-[#173C82] [&_h1]:text-[17px] [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-3 [&_h2]:text-[#173C82] [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-[#173C82] [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-2 [&_p]:text-foreground [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_li]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-[#173C82] [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-max border-collapse text-xs text-foreground">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead style={{ background: "#173C82" }} className="text-white">
                  {children}
                </thead>
              ),
              th: ({ children }) => (
                <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap text-white">
                  {children}
                </th>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-border/50 text-foreground">
                  {children}
                </tbody>
              ),
              tr: ({ children }) => (
                <tr className="odd:bg-white even:bg-[#F4F7FB] transition-colors hover:bg-accent/30">
                  {children}
                </tr>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 align-top font-mono tabular-nums text-foreground whitespace-nowrap">
                  {children}
                </td>
              ),
            }}
          >
            {artifact.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white" style={{ borderTop: "1px solid #173C82" }}>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </button>
        <button
          onClick={handleDownloadMarkdown}
          className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white"
        >
          <FileText className="h-3.5 w-3.5" />
          Download Markdown
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-[#173C82] px-3 py-1.5 text-xs font-medium text-[#173C82] transition-colors hover:bg-[#173C82] hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
