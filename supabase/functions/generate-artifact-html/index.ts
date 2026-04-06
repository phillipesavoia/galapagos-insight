import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function collectStream(res: Response): Promise<string> {
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude error ${res.status}: ${errText}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const event = JSON.parse(data);
          if (event.type === "content_block_delta" && event.delta?.text) {
            fullText += event.delta.text;
          }
        } catch {}
      }
    }
  }
  return fullText.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const { title, content, chartCalls } = await req.json();

    if (!title || !content) {
      return new Response(JSON.stringify({ error: "title and content required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let chartDescriptions = "";
    if (chartCalls && chartCalls.length > 0) {
      chartDescriptions = "\n\nCharts to include:\n";
      chartCalls.forEach((tc: any, i: number) => {
        const input = tc.input || {};
        const chartTitle = input.title || input.titulo || input.assetName || `Chart ${i + 1}`;
        if (tc.tool === "renderizar_grafico_barras") {
          const labels = (input.data || []).map((d: any) => d.name || d.label || "");
          const bars = (input.bars || []).map((b: any) => ({
            label: b.label,
            values: (input.data || []).map((d: any) => d[b.dataKey] ?? 0),
          }));
          chartDescriptions += `\n${i + 1}. BAR CHART: "${chartTitle}"\n   Labels: ${JSON.stringify(labels)}\n   Series: ${JSON.stringify(bars)}\n`;
        } else if (tc.tool === "renderizar_grafico_linha") {
          const dates = (input.data || []).map((d: any) => d.date || "");
          const lines = (input.lines || []).map((l: any) => ({
            label: l.label,
            values: (input.data || []).map((d: any) => d[l.dataKey] ?? null),
          }));
          chartDescriptions += `\n${i + 1}. LINE CHART: "${chartTitle}"\n   Dates: ${JSON.stringify(dates.slice(0, 10))}... (${dates.length} total)\n   Series: ${JSON.stringify(lines.map((l: any) => ({ label: l.label, sample: l.values.slice(0, 5) })))}\n`;
        } else if (tc.tool === "renderizar_pie_chart") {
          const data = (input.data || []).map((d: any) => ({ name: d.name, value: d.value }));
          chartDescriptions += `\n${i + 1}. PIE CHART: "${chartTitle}"\n   Segments: ${JSON.stringify(data)}\n`;
        } else if (tc.tool === "renderizar_tabela_retornos") {
          chartDescriptions += `\n${i + 1}. TABLE: "${chartTitle}"\n   Columns: ${JSON.stringify(input.columns)}\n   Rows: ${JSON.stringify((input.rows || []).slice(0, 3))}... (${(input.rows || []).length} total)\n`;
        } else if (tc.tool === "renderizar_flash_factsheet") {
          chartDescriptions += `\n${i + 1}. FACTSHEET: "${input.assetName}" (${input.ticker})\n   Class: ${input.assetClass}\n   Thesis: ${(input.thesis || "").slice(0, 100)}\n`;
        }
      });
    }

    const richSystemPrompt = `You are a senior financial report designer for an institutional wealth manager (Galapagos Capital Advisory, Miami). 
Generate complete, self-contained HTML reports at Bloomberg/FactSet quality level.

CRITICAL — INLINE SVG CHARTS ONLY — NO JAVASCRIPT:
Do not use ECharts, Chart.js, or any JavaScript library. Do not include any <script> tags.
Render ALL charts as pure inline SVG elements with hardcoded data values.
For bar charts: use SVG <rect> elements. Put the label text on the LEFT at x=0, right-aligned at x=155, width=155px. Bar starts at x=165. Value label appears to the RIGHT of the bar. Total SVG height = number of items × 36 + 40. Use alternating row backgrounds #f8fafc and #ffffff.
For donut/pie charts: use SVG <path> elements with calculated arc coordinates. Minimum 240px × 240px.
For line charts: use SVG <polyline> elements.
All SVG charts must be self-contained, fully rendered, and require zero JavaScript to display.
Minimum chart container height: bars need 36px each. Never truncate labels.
This is non-negotiable — the output must work in a sandboxed iframe with no external resources.

DESIGN SYSTEM:
- Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif
- Navy: #173C82 | Blue: #0071BB | Light blue: #4a9fd4
- Green: #16a34a | Red: #dc2626 | Amber: #d97706
- Background: #f8fafc | Card: #ffffff | Border: #e2e8f0
- Text primary: #0f172a | Text secondary: #64748b
- Color palette: ['#0071BB','#173C82','#16a34a','#dc2626','#d97706','#4a9fd4','#7c3aed']

REPORT STRUCTURE:
1. Header: full-width navy bar with firm name left, report date right
2. Sub-header: bright blue bar with report title
3. KPI row: 4 metric cards with colored left border
4. Main content: CSS grid 2-column layout
5. Each section in a white card with box-shadow, border-radius: 8px, padding: 24px
6. Footer with confidentiality notice

TYPOGRAPHY:
- Section titles: 15px font-weight:600 color:#173C82
- Table headers: 11px uppercase background:#173C82 color:white
- Positive values: color:#16a34a | Negative: color:#dc2626
- Bar charts: horizontal, sorted descending, green positive/red negative
- Portuguese language for all UI elements

COMPLETENESS IS MANDATORY: You MUST include ALL sections from the content — never stop mid-report. Include every table row, every chart, every section. If the content has 10 sections, the HTML must have 10 sections. Closing tags </body></html> MUST always be present.
CONCISENESS: Compact HTML, no verbose comments, no redundant CSS. Prioritize data over narrative text — one sentence per insight max.
Return ONLY HTML starting with <!DOCTYPE html>.`;

    const pdfSystemPrompt = `You are a financial report designer. Generate a clean HTML report for PDF printing.
NO JavaScript. NO external scripts. NO ECharts. NO canvas.
Use only HTML tables and inline SVG for simple charts.
For bar charts: use SVG <rect> elements. ALWAYS put the label text (asset/portfolio name) on the LEFT side of the bar at x=0, right-aligned at x=155, width=155px fixed. Bar starts at x=165. Value label appears to the RIGHT of the bar. Total SVG height = number of items × 36 + 40. Use alternating row backgrounds #f8fafc and #ffffff.
For pie/donut charts: use SVG circle/path elements.
All SVG charts must be self-contained, fully rendered, and require zero JavaScript to display.
Minimum chart container height: bars need 36px each. Donut charts minimum 240px × 240px. Never truncate labels.
Galapagos Capital Advisory branding: navy #173C82, blue #0071BB, background #F4F7FB.
Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif.
Print-optimized: -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-inside: avoid on all sections.
Structure: navy header bar, blue sub-header, KPI cards row, white cards with shadow for each section.
Table headers: navy background white text. Positive values green #16a34a, negative red #dc2626.
Portuguese language. Max 6000 tokens. Compact HTML.
Return ONLY HTML starting with <!DOCTYPE html>.`;

    const richUserMessage = `Generate a professional HTML financial report using ONLY inline SVG charts (no JavaScript).
Title: ${title}
Content:\n${content}\n${chartDescriptions}
Instructions: Use pure SVG for all charts. KPI cards at top. 2-column grid. All table rows included. Compact output.`;

    const pdfUserMessage = `Generate a clean print-ready HTML report. NO JavaScript.
Title: ${title}
Content:\n${content}\n${chartDescriptions}
Use HTML tables and simple inline SVG bar/pie charts. KPI cards at top. All table rows included. Compact output.`;

    const headers = {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey!,
      "anthropic-version": "2023-06-01",
    };

    const [richResult, pdfResult] = await Promise.all([
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 12000,
          stream: true,
          system: richSystemPrompt,
          messages: [{ role: "user", content: richUserMessage }],
        }),
      }),
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10000,
          stream: true,
          system: pdfSystemPrompt,
          messages: [{ role: "user", content: pdfUserMessage }],
        }),
      }),
    ]);

    const [richHtml, pdfHtml] = await Promise.all([
      collectStream(richResult),
      collectStream(pdfResult),
    ]);

    if (!richHtml || richHtml.length < 100) {
      throw new Error("Claude returned empty HTML");
    }

    const html = richHtml;

    return new Response(JSON.stringify({ html, pdfHtml: pdfHtml || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-artifact-html error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
