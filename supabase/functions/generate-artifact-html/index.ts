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

    const systemPrompt = `You are an expert financial report designer for Galapagos Capital Advisory (Miami).
Generate a complete, self-contained HTML report with inline SVG charts.

BRANDING:
- Primary navy: #173C82
- Bright blue: #0071BB
- Accent blue: #4a9fd4
- Positive green: #38a169
- Negative red: #e53e3e
- Background: #F4F7FB
- Text: #1a1a2e

SVG CHART RULES — CRITICAL:
- For horizontal bar charts: ALL bars must go LEFT to RIGHT from a fixed origin line. Negative values use red color but still render as a bar going right (use absolute value for width). NEVER let text overlap bars.
- Bar labels (asset names) go on the LEFT side, values on the RIGHT side of each bar with 8px padding
- Minimum bar height: 28px per item. Calculate total SVG height = number of items × 32 + 60 (for title + padding)
- Always set explicit viewBox and width="100%" height="auto" on every SVG
- Text labels: font-size="12" — never truncate, use full names
- For donut/pie charts: always include a visible legend below the chart
- Add page-break-inside: avoid to every chart container div

PDF PRINT RULES — CRITICAL:
- Add this to your CSS: @media print { .chart-container { page-break-inside: avoid; break-inside: avoid; } svg { overflow: visible !important; } }
- Every section card must have: style="page-break-inside: avoid; break-inside: avoid;"
- Use explicit pixel heights on all SVG elements

LAYOUT:
- Two-column grid for wide sections, single column for tables
- KPI cards in a row at the top
- Each section in a white card with subtle shadow
- Tables: navy headers, alternating rows #F4F7FB/white
- Font: Helvetica Neue, Arial, sans-serif
- Include a header bar with Galapagos Capital Advisory branding
- Include a footer with confidentiality notice
- The HTML must print perfectly — include @media print styles
- Portuguese language for all UI elements

Return ONLY valid HTML — no markdown, no backticks, no explanation.`;
    const userMessage = `Generate a branded HTML report. Be concise — maximum 6000 tokens. Prioritize charts and key tables over lengthy text explanations.

Title: ${title}

Content (in markdown):
${content}${chartDescriptions}

Place each chart/table visualization inline within the relevant section of the report (near the content it relates to). The report should flow naturally with text, tables, and charts integrated together.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 10000,
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
