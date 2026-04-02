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

RULES:
- Return ONLY valid HTML — no markdown, no explanation, no code fences
- ALL CSS must be inline in a <style> tag
- ALL charts must be rendered as inline SVG with proper colors, labels, and values
- For bar charts: use horizontal bars with labels and values
- For line charts: use SVG polyline/path with axis labels
- For pie/donut charts: use SVG circle/path segments with legend
- Tables must have the navy header style
- Include a header bar with Galapagos Capital Advisory branding
- Include a footer with confidentiality notice
- The HTML must print perfectly — include @media print styles
- Portuguese language for all UI elements
- Font: Helvetica Neue, Arial, sans-serif
- Make the report look institutional and professional`;

    const userMessage = `Generate a branded HTML report.

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
        max_tokens: 16000,
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

    const claudeData = await claudeRes.json();
    const textBlock = (claudeData?.content || []).find((b: any) => b.type === "text");
    let html = textBlock?.text || "";

    // Strip markdown code fences if Claude wrapped the HTML
    html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

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
