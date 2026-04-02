import { useState, useMemo } from "react";
import { X, Download, FileText, ClipboardCopy, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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

function markdownToHtml(md: string): string {
  let html = md
    .replace(/^---+$/gm, "<hr>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?:^> .+$\n?)+/gm, (block) => {
      const text = block.replace(/^> /gm, "").trim();
      return `<blockquote>${text}</blockquote>`;
    })
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
    .replace(/(?:^- .+$\n?)+/gm, (block) => {
      const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^- /, "")}</li>`).join("");
      return `<ul>${items}</ul>`;
    })
    .replace(/(?:^\d+\. .+$\n?)+/gm, (block) => {
      const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
      return `<ol>${items}</ol>`;
    })
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");

  if (!html.startsWith("<")) html = `<p>${html}</p>`;
  return html;
}

function stripPreamble(title: string, content: string): string {
  const lines = content.split("\n");
  const preamblePhrases = ["vou montar", "iniciando", "vou preparar", "deixa eu", "vou elaborar", "vou criar", "vou gerar", "vou analisar", "aqui está", "segue abaixo", "preparei"];
  let startIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) { startIdx = i + 1; continue; }
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match && h1Match[1].trim().toLowerCase() === title.trim().toLowerCase()) { startIdx = i + 1; continue; }
    const lower = trimmed.toLowerCase();
    if (preamblePhrases.some(p => lower.includes(p)) && !trimmed.startsWith("##") && !trimmed.startsWith("---")) { startIdx = i + 1; continue; }
    break;
  }

  return lines.slice(startIdx).join("\n").trim();
}

const CHART_COLORS = {
  primary: "#173C82",
  secondary: "#0071BB",
  accent: "#4a9fd4",
  negative: "#e53e3e",
  positive: "#38a169",
  palette: ["#173C82", "#0071BB", "#4a9fd4", "#38a169", "#e53e3e", "#d69e2e", "#805ad5", "#dd6b20"],
};

interface ChartBlock {
  title: string;
  keywords: string[];
  html: string;
  script: string;
}

function buildChartBlocks(chartCalls: Array<{ tool: string; input: any }>): ChartBlock[] {
  if (!chartCalls || chartCalls.length === 0) return [];

  const blocks: ChartBlock[] = [];

  chartCalls.forEach((tc, idx) => {
    const canvasId = `chart_${idx}`;
    const rawTitle = tc.input?.title || tc.input?.titulo || tc.input?.assetName || "";
    const keywords = rawTitle.toLowerCase().split(/[\s\-–—:,/]+/).filter((w: string) => w.length > 2);

    if (tc.tool === "renderizar_tabela_retornos" && tc.input) {
      const { title, columns, rows, colorize } = tc.input;
      const cols = columns || [];
      const dataRows = rows || [];
      const thead = `<tr>${cols.map((c: any) => `<th>${c.label || c.key || c}</th>`).join("")}</tr>`;
      const tbody = dataRows.map((row: any) => {
        const cells = cols.map((c: any) => {
          const key = c.key || c;
          const val = row[key] ?? "";
          const strVal = String(val);
          let style = "";
          if (colorize !== false) {
            if (/^-/.test(strVal)) style = `color: ${CHART_COLORS.negative};`;
            else if (/^\+?\d+(\.\d+)?%$/.test(strVal) && !strVal.startsWith("0")) style = `color: ${CHART_COLORS.positive};`;
          }
          return `<td style="${style}">${strVal}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      blocks.push({ title: title || rawTitle, keywords, html: `<div class="chart-container"><h3>${title || ""}</h3><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`, script: "" });
      return;
    }

    if (tc.tool === "renderizar_flash_factsheet") {
      const { assetName, ticker, assetClass, thesis, portfolios } = tc.input;
      blocks.push({ title: assetName || rawTitle, keywords, html: `<div class="chart-container">
        <h3>${assetName || ""} ${ticker ? `(${ticker})` : ""}</h3>
        <p><strong>Classe:</strong> ${assetClass || ""}</p>
        ${portfolios?.length ? `<p><strong>Portfólios:</strong> ${portfolios.join(", ")}</p>` : ""}
        ${thesis ? `<p><strong>Tese:</strong> ${thesis}</p>` : ""}
      </div>`, script: "" });
      return;
    }

    if (tc.tool === "renderizar_grafico_barras" && tc.input) {
      const { title, data, bars, yAxisLabel } = tc.input;
      const labels = (data || []).map((d: any) => d.name || d.label || "");
      const datasets = (bars || []).map((bar: any, bi: number) => ({
        label: bar.label,
        data: (data || []).map((d: any) => d[bar.dataKey] ?? 0),
        backgroundColor: bar.color || CHART_COLORS.palette[bi % CHART_COLORS.palette.length],
      }));
      blocks.push({ title: title || rawTitle, keywords, html: `<div class="chart-container" style="height:280px"><h3>${title || ""}</h3><canvas id="${canvasId}" height="300"></canvas></div>`, script: `new Chart(document.getElementById('${canvasId}'), {
        type: 'bar',
        data: { labels: ${JSON.stringify(labels)}, datasets: ${JSON.stringify(datasets)} },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: ${datasets.length > 1} } }, scales: { x: { title: { display: ${!!yAxisLabel}, text: ${JSON.stringify(yAxisLabel || "")} } } } }
      });` });
      return;
    }

    if (tc.tool === "renderizar_grafico_linha" && tc.input) {
      const { title, data, lines, yAxisLabel } = tc.input;
      const labels = (data || []).map((d: any) => d.date || "");
      const datasets = (lines || []).map((line: any, li: number) => ({
        label: line.label,
        data: (data || []).map((d: any) => d[line.dataKey] ?? null),
        borderColor: line.color || CHART_COLORS.palette[li % CHART_COLORS.palette.length],
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 0,
      }));
      blocks.push({ title: title || rawTitle, keywords, html: `<div class="chart-container" style="height:280px"><h3>${title || ""}</h3><canvas id="${canvasId}" height="300"></canvas></div>`, script: `new Chart(document.getElementById('${canvasId}'), {
        type: 'line',
        data: { labels: ${JSON.stringify(labels)}, datasets: ${JSON.stringify(datasets)} },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: ${!!yAxisLabel}, text: ${JSON.stringify(yAxisLabel || "")} } } } }
      });` });
      return;
    }

    if (tc.tool === "renderizar_pie_chart" && tc.input) {
      const { title, data, donut } = tc.input;
      const labels = (data || []).map((d: any) => d.name || "");
      const values = (data || []).map((d: any) => d.value ?? 0);
      const colors = (data || []).map((d: any, di: number) => d.color || CHART_COLORS.palette[di % CHART_COLORS.palette.length]);
      blocks.push({ title: title || rawTitle, keywords, html: `<div class="chart-container" style="height:280px"><h3>${title || ""}</h3><canvas id="${canvasId}" height="300"></canvas></div>`, script: `new Chart(document.getElementById('${canvasId}'), {
        type: 'doughnut',
        data: { labels: ${JSON.stringify(labels)}, datasets: [{ data: ${JSON.stringify(values)}, backgroundColor: ${JSON.stringify(colors)} }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: ${donut !== false ? "'50%'" : "0"}, plugins: { legend: { position: 'bottom' } } }
      });` });
      return;
    }
  });

  return blocks;
}

function injectChartsIntoHtml(htmlContent: string, chartBlocks: ChartBlock[]): { html: string; scripts: string[] } {
  if (chartBlocks.length === 0) return { html: htmlContent, scripts: [] };

  let result = htmlContent;
  const scripts: string[] = [];
  const placed = new Set<number>();

  // Try to place each chart after its matching section
  chartBlocks.forEach((block, idx) => {
    if (block.keywords.length === 0) return;

    // Find matching h2/h3 in the HTML
    const sectionRegex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
    let match: RegExpExecArray | null;
    let bestPos = -1;

    while ((match = sectionRegex.exec(result)) !== null) {
      const sectionText = match[1].toLowerCase().replace(/<[^>]*>/g, "");
      const matchCount = block.keywords.filter(kw => sectionText.includes(kw)).length;
      if (matchCount >= 1) {
        // Find the next closing tag after this header to inject after
        const afterHeader = result.substring(match.index + match[0].length);
        const insertAfterMatch = afterHeader.match(/^[\s\S]*?(<\/table>|<\/ul>|<\/ol>|<\/blockquote>|<\/p>)/);
        if (insertAfterMatch) {
          bestPos = match.index + match[0].length + insertAfterMatch.index! + insertAfterMatch[0].length;
        } else {
          bestPos = match.index + match[0].length;
        }
        break;
      }
    }

    if (bestPos >= 0) {
      result = result.substring(0, bestPos) + "\n" + block.html + "\n" + result.substring(bestPos);
      placed.add(idx);
      if (block.script) scripts.push(block.script);
    }
  });

  // Append unplaced charts at the end
  chartBlocks.forEach((block, idx) => {
    if (!placed.has(idx)) {
      result += "\n" + block.html;
      if (block.script) scripts.push(block.script);
    }
  });

  return { html: result, scripts };
}

function buildFactsheetHtml(title: string, content: string, chartCalls?: Array<{ tool: string; input: any }>): string {
  const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  let cleanedContent = stripPreamble(title, content);

  // Strip "Explorar mais" section and everything after it
  cleanedContent = cleanedContent.replace(/💡\s*\*?\*?Explorar mais:?\*?\*?[\s\S]*$/m, '').trim();

  const htmlContent = markdownToHtml(cleanedContent);
  const chartBlocks = buildChartBlocks(chartCalls || []);
  const { html: finalHtml, scripts } = injectChartsIntoHtml(htmlContent, chartBlocks);

  const chartScriptTag = scripts.length > 0
    ? `<script src="https://cdn.jsdelivr.net/npm/chart.js?v=4"></script><script data-chart="true">
var chartScriptEl=document.querySelector('script[src*="chart.js"]');
function initCharts(){${scripts.join("\n")}}
if(chartScriptEl){chartScriptEl.addEventListener('load',function(){setTimeout(initCharts,200)});}else{setTimeout(initCharts,200);}
</script>`
    : "";

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
  .chart-container { margin: 16px 0 24px; padding: 16px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .chart-container h3 { margin-top: 0; margin-bottom: 12px; }
  .chart-container canvas { width: 100% !important; max-height: 320px; }
  .footer { margin-top: 32px; padding: 12px 28px; border-top: 1px solid #d1dce8; background: #F4F7FB; text-align: center; font-size: 10px; color: #94a3b8; }
  @media print { body { background: white; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .chart-container { break-inside: avoid; } }
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
  <div class="content">
    ${finalHtml}
  </div>
  <div class="footer">Galapagos Capital Advisory LLC — Documento Confidencial — Uso Exclusivo do Cliente</div>
  ${chartScriptTag}
</body>
</html>`;
}

export function ArtifactPanel({ artifact, onClose }: Props) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);

  const factsheetHtml = useMemo(
    () => buildFactsheetHtml(artifact.title, artifact.content, artifact.chartCalls),
    [artifact.title, artifact.content, artifact.chartCalls]
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
    const printHtml = factsheetHtml.replace(
      '</body>',
      `<script>
window.addEventListener('load', function() {
  function convertCanvasAndPrint() {
    setTimeout(function() {
      var canvases = document.querySelectorAll('canvas');
      canvases.forEach(function(canvas) {
        try {
          var img = document.createElement('img');
          img.src = canvas.toDataURL('image/png');
          img.style.cssText = canvas.style.cssText;
          img.style.width = '100%';
          img.style.maxHeight = '300px';
          canvas.parentNode.replaceChild(img, canvas);
        } catch(e) {}
      });
      setTimeout(function() { window.print(); }, 300);
    }, 1500);
  }
  var chartScripts = document.querySelectorAll('script[data-chart]');
  if (chartScripts.length === 0) {
    window.print();
    return;
  }
  convertCanvasAndPrint();
});
</script></body>`
    );
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(printHtml);
    win.document.close();
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
          srcDoc={factsheetHtml}
          title={artifact.title}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ background: "#F4F7FB", borderTop: "1px solid #d1dce8" }}>
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
