import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Validate auth
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

    // Build chart descriptions for Claude
    let chartDescriptions = "";
    if (chartCalls && chartCalls.length > 0) {
      chartDescriptions = "\n\nCharts to include as inline SVG:\n";
      chartCalls.forEach((tc: any, i: number) => {
        const input = tc.input || {};
        const chartTitle = input.title || input.titulo || input.assetName || `Chart ${i + 1}`;

        if (tc.tool === "renderizar_grafico_barras") {
          const labels = (input.data || []).map((d: any) => d.name || d.label || "");
          const bars = (input.bars || []).map((b: any) => ({
            label: b.label,
            values: (input.data || []).map((d: any) => d[b.dataKey] ?? 0),
          }));
          chartDescriptions += `\n${i + 1}. HORIZONTAL BAR CHART: "${chartTitle}"\n   Labels: ${JSON.stringify(labels)}\n   Series: ${JSON.stringify(bars)}\n   Y-axis: ${input.yAxisLabel || ""}\n`;
        } else if (tc.tool === "renderizar_grafico_linha") {
          const dates = (input.data || []).map((d: any) => d.date || "");
          const lines = (input.lines || []).map((l: any) => ({
            label: l.label,
            values: (input.data || []).map((d: any) => d[l.dataKey] ?? null),
          }));
          chartDescriptions += `\n${i + 1}. LINE CHART: "${chartTitle}"\n   Dates: ${JSON.stringify(dates.slice(0, 10))}... (${dates.length} total)\n   Series: ${JSON.stringify(lines.map((l: any) => ({ label: l.label, sampleValues: l.values.slice(0, 5) })))}\n`;
        } else if (tc.tool === "renderizar_pie_chart") {
          const data = (input.data || []).map((d: any) => ({ name: d.name, value: d.value }));
          chartDescriptions += `\n${i + 1}. PIE/DONUT CHART: "${chartTitle}"\n   Segments: ${JSON.stringify(data)}\n   Donut: ${input.donut !== false}\n`;
        } else if (tc.tool === "renderizar_tabela_retornos") {
          chartDescriptions += `\n${i + 1}. TABLE: "${chartTitle}"\n   Columns: ${JSON.stringify(input.columns)}\n   Rows: ${JSON.stringify((input.rows || []).slice(0, 3))}... (${(input.rows || []).length} total)\n`;
        } else if (tc.tool === "renderizar_flash_factsheet") {
          chartDescriptions += `\n${i + 1}. FACTSHEET CARD: "${input.assetName}" (${input.ticker})\n   Class: ${input.assetClass}, Portfolios: ${(input.portfolios || []).join(", ")}\n   Thesis: ${(input.thesis || "").slice(0, 100)}\n`;
        }
      });
    }

    const systemPrompt = `You are a senior financial report designer for an institutional wealth manager (Galapagos Capital Advisory, Miami). 
Generate complete, self-contained HTML reports at Bloomberg/FactSet quality level.

TECHNICAL STACK:
- Apache ECharts 5 from CDN (https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js)
- ALWAYS use renderer: 'svg' — this is critical for PDF printing
- All chart containers must have explicit pixel height (e.g. style="height:280px")
- Initialize charts with: echarts.init(document.getElementById('id'), null, {renderer: 'svg'})

DESIGN SYSTEM:
- Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif
- Navy: #173C82 | Blue: #0071BB | Light blue: #4a9fd4
- Green: #16a34a | Red: #dc2626 | Amber: #d97706
- Background: #f8fafc | Card: #ffffff | Border: #e2e8f0
- Text primary: #0f172a | Text secondary: #64748b

REPORT STRUCTURE (use this exact layout):
1. Header: full-width navy bar with firm name left, report date/confidential right
2. Sub-header: bright blue bar with report title and base date
3. KPI row: 4 metric cards in a flex row, each with colored left border (red/green based on value)
4. Main content: CSS grid 2-column layout where appropriate
5. Each section in a white card with box-shadow: 0 1px 3px rgba(0,0,0,0.1), border-radius: 8px, padding: 24px
6. Footer with confidentiality notice

CHART QUALITY RULES:
- Bar charts: horizontal, sorted by value descending, colored bars (green positive/red negative), value labels inside or right of bar
- Pie/donut: center label with portfolio name, percentage labels outside, legend below
- All charts must have: grid lines, axis labels, proper margins
- Color palette for multi-series: ['#0071BB','#173C82','#16a34a','#dc2626','#d97706','#4a9fd4','#7c3aed']

PRINT/PDF RULES:
- @media print: all cards break-inside: avoid, colors must print (-webkit-print-color-adjust: exact; print-color-adjust: exact)
- The window.onload script must initialize ALL ECharts after DOM is ready
- Add at end of body: <script>window.addEventListener('load', function(){ /* init all charts */ if(location.search.indexOf('print=1')!==-1){setTimeout(function(){window.print()},1500);} });</script>
- Only trigger print if URL contains '?print=1'

TYPOGRAPHY:
- Section titles: 15px font-weight:600 color:#173C82 border-bottom: 2px solid #173C82
- Table headers: 11px uppercase letter-spacing:0.06em background:#173C82 color:white padding:10px 14px
- Table cells: 13px padding:9px 14px border-bottom:1px solid #e2e8f0
- Positive values: color:#16a34a font-weight:600
- Negative values: color:#dc2626 font-weight:600
- KPI large number: 28px font-weight:700
- Portuguese language for all UI elements

Return ONLY the HTML document starting with <!DOCTYPE html>. No markdown, no backticks, no explanation.`;

    const userMessage = `Generate a professional institutional-quality HTML financial report.

Title: ${title}

Content (markdown with all data):
${content}
${chartDescriptions}

IMPORTANT INSTRUCTIONS:
1. Extract ALL numerical data from the content to build proper ECharts charts with SVG renderer
2. Every chart mentioned in the chartCalls must appear as a proper ECharts chart
3. KPI cards at the top must show the most important 4 metrics from the content
4. Use a 2-column grid layout: narrative/tables on left, charts on right where possible
5. Tables must include ALL rows from the data — do not truncate
6. Negative performance values: red color. Positive: green. Zero: gray.
7. The report must look like it came from a Bloomberg terminal or BlackRock report
8. Include the ECharts CDN script tag in the head
9. All chart div containers need unique IDs (chart1, chart2, etc.)
10. Initialize all charts in a single window.onload function at the bottom of body
11. Be concise — prioritize charts and key tables over lengthy text explanations.
12. CONCISENESS RULE: Maximum 7000 tokens total. Use compact HTML — no verbose inline comments, minimal whitespace, no redundant CSS. Prioritize charts and data tables. Skip lengthy narrative paragraphs — one sentence per insight maximum.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude error:", errText);
      return new Response(JSON.stringify({ error: `Claude error: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect full streamed text
    const reader = claudeRes.body!.getReader();
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

    let html = fullText.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    if (!html || html.length < 100) {
      throw new Error("Claude returned empty HTML");
    }

    // Inline ECharts to make HTML fully self-contained for API2PDF
    let echartsSource = '';
    try {
      const echartsRes = await fetch('https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js');
      if (echartsRes.ok) {
        echartsSource = await echartsRes.text();
      }
    } catch (e) {
      console.warn('Could not fetch ECharts:', e);
    }

    if (echartsSource) {
      html = html.replace(
        /<script[^>]*echarts[^>]*><\/script>/i,
        `<script>${echartsSource}</script>`
      );
    }

    return new Response(JSON.stringify({ html }), {
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
