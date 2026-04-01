import { useState, useMemo } from "react";
import { X, Download, FileText, ClipboardCopy, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ArtifactData {
  title: string;
  content: string;
  artifact_type: "report" | "analysis" | "factsheet";
}

interface Props {
  artifact: ArtifactData;
  onClose: () => void;
}

function markdownToHtml(md: string): string {
  let html = md
    // Horizontal rules
    .replace(/^---+$/gm, "<hr>")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Blockquotes
    .replace(/(?:^> .+$\n?)+/gm, (block) => {
      const text = block.replace(/^> /gm, "").trim();
      return `<blockquote>${text}</blockquote>`;
    })
    // Tables
    .replace(/(?:^\|.+\|$\n?)+/gm, (block) => {
      const rows = block.trim().split("\n").filter((r) => !/^\|[\s\-:|]+\|$/.test(r));
      if (rows.length === 0) return block;
      const parseRow = (row: string) => row.split("|").slice(1, -1).map((c) => c.trim());
      const headerCells = parseRow(rows[0]);
      const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
      const bodyRows = rows.slice(1).map(
        (r) => `<tr>${parseRow(r).map((c) => `<td>${c}</td>`).join("")}</tr>`
      ).join("");
      return `<table>${thead}<tbody>${bodyRows}</tbody></table>`;
    })
    // Unordered lists
    .replace(/(?:^- .+$\n?)+/gm, (block) => {
      const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^- /, "")}</li>`).join("");
      return `<ul>${items}</ul>`;
    })
    // Ordered lists
    .replace(/(?:^\d+\. .+$\n?)+/gm, (block) => {
      const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
      return `<ol>${items}</ol>`;
    })
    // Paragraphs (double newlines)
    .replace(/\n{2,}/g, "</p><p>")
    // Single newlines to <br>
    .replace(/\n/g, "<br>");

  // Wrap in paragraph tags if not already wrapped
  if (!html.startsWith("<")) html = `<p>${html}</p>`;

  return html;
}

function buildFactsheetHtml(title: string, content: string): string {
  const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const htmlContent = markdownToHtml(content);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #F4F7FB; color: #1a1a2e; font-size: 13px; line-height: 1.6; }
  .header { background: #173C82; color: white; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; }
  .header-left { display: flex; flex-direction: column; }
  .header-brand { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; margin-bottom: 2px; }
  .header-title { font-size: 18px; font-weight: 700; }
  .header-right { font-size: 10px; opacity: 0.65; text-align: right; }
  .content { padding: 24px 28px; }
  h1 { color: #173C82; font-size: 16px; font-weight: 700; border-bottom: 2px solid #173C82; padding-bottom: 6px; margin: 24px 0 12px; }
  h2 { color: #173C82; font-size: 14px; font-weight: 700; border-left: 4px solid #0071BB; padding-left: 10px; margin: 20px 0 10px; }
  h3 { color: #0071BB; font-size: 13px; font-weight: 600; margin: 16px 0 8px; }
  p { margin-bottom: 10px; color: #2d3748; }
  strong { color: #173C82; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  th { background: #173C82; color: white; padding: 9px 14px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  td { padding: 8px 14px; border-bottom: 1px solid #e8edf5; font-size: 12px; }
  tr:nth-child(even) td { background: #F4F7FB; }
  tr:last-child td { border-bottom: none; }
  ul, ol { padding-left: 18px; margin-bottom: 10px; }
  li { margin-bottom: 4px; color: #2d3748; }
  blockquote { border-left: 4px solid #0071BB; padding: 8px 16px; background: #eef3fb; margin: 12px 0; border-radius: 0 6px 6px 0; color: #173C82; font-style: italic; }
  hr { border: none; border-top: 1px solid #d1dce8; margin: 20px 0; }
  .footer { margin-top: 32px; padding: 12px 28px; border-top: 1px solid #d1dce8; background: #F4F7FB; text-align: center; font-size: 10px; color: #94a3b8; }
  @media print { body { background: white; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-brand">Galapagos Capital Advisory</div>
      <div class="header-title">${title}</div>
    </div>
    <div class="header-right">Documento Confidencial<br>${date}</div>
  </div>
  <div class="content">${htmlContent}</div>
  <div class="footer">Galapagos Capital Advisory LLC — Documento Confidencial — Uso Exclusivo do Cliente</div>
</body>
</html>`;
}

export function ArtifactPanel({ artifact, onClose }: Props) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);

  const factsheetHtml = useMemo(
    () => buildFactsheetHtml(artifact.title, artifact.content),
    [artifact.title, artifact.content]
  );

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

  const handleDownloadPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(factsheetHtml);
    win.document.close();
    win.onload = () => {
      setTimeout(() => win.print(), 400);
    };
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
          : "w-[520px] shrink-0 border-l border-border"
      } flex flex-col animate-in slide-in-from-right duration-300 bg-background`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "#173C82" }}>
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

      {/* Body — iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          srcDoc={factsheetHtml}
          title={artifact.title}
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 bg-background" style={{ borderTop: "1px solid #173C82" }}>
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
