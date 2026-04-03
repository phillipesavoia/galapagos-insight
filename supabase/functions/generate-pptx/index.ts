import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pptxgen from "https://esm.sh/pptxgenjs@3.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const C = {
  navy: "173C82",
  blue: "0071BB",
  lightBlue: "4a9fd4",
  snow: "F4F7FB",
  white: "FFFFFF",
  green: "16a34a",
  red: "dc2626",
  amber: "d97706",
  gray: "64748b",
  darkText: "0f172a",
  border: "e2e8f0",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const { title, content, chartCalls } = await req.json();

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const extractRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        system: "Extract structured data from financial report markdown. Return ONLY valid JSON, no explanation.",
        messages: [{
          role: "user",
          content: `Extract this report data into JSON with this exact structure:
{
  "portfolio": "portfolio name",
  "period": "Fevereiro 2026",
  "kpis": [{"label": "...", "value": "...", "sub": "...", "color": "green|red|blue"}],
  "performance": [{"name": "...", "fev": 0.0, "ytd": 0.0}],
  "composition": [{"name": "...", "value": 0.0}],
  "topHoldings": [{"ticker": "...", "name": "...", "weight": 0.0, "perf": 0.0}],
  "topContributors": [{"name": "...", "contrib": 0.0, "weight": 0.0}],
  "topDetractors": [{"name": "...", "contrib": 0.0, "weight": 0.0}],
  "summary": "2-3 sentence executive summary"
}

Report content:
${content.substring(0, 4000)}`
        }]
      })
    });

    const extractData = await extractRes.json();
    let reportData: any = {};
    try {
      const jsonText = extractData.content?.[0]?.text || "{}";
      reportData = JSON.parse(jsonText.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      reportData = { portfolio: title, period: "Fevereiro 2026", kpis: [], performance: [], composition: [], topHoldings: [], topContributors: [], topDetractors: [], summary: "" };
    }

    const pres = new pptxgen();
    pres.layout = "LAYOUT_WIDE";

    const W = 13.3, H = 7.5;

    // ── SLIDE 1: COVER ──
    const cover = pres.addSlide();
    cover.background = { color: C.navy };
    cover.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.08, fill: { color: C.blue }, line: { color: C.blue } });
    cover.addText("GALAPAGOS CAPITAL ADVISORY", {
      x: 0.5, y: 0.3, w: 8, h: 0.4, fontSize: 11, bold: true, color: "AABFE0", charSpacing: 4, fontFace: "Calibri", margin: 0
    });
    cover.addText(title, {
      x: 0.5, y: 1.8, w: W - 1, h: 1.8, fontSize: 40, bold: true, color: C.white, fontFace: "Calibri", margin: 0
    });
    cover.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 3.8, w: 2.8, h: 0.45, fill: { color: C.blue }, line: { color: C.blue } });
    cover.addText(reportData.period || "Fevereiro 2026", {
      x: 0.5, y: 3.8, w: 2.8, h: 0.45, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle", margin: 0
    });
    cover.addShape(pres.shapes.RECTANGLE, { x: 0, y: H - 0.6, w: W, h: 0.6, fill: { color: "0D2558" }, line: { color: "0D2558" } });
    cover.addText("Miami, FL  ·  Wealth Management & Portfolio Advisory  ·  Documento Confidencial", {
      x: 0.5, y: H - 0.6, w: W - 1, h: 0.6, fontSize: 9, color: "7A9CC5", valign: "middle", margin: 0
    });

    // ── SLIDE 2: KPIs ──
    const kpiSlide = pres.addSlide();
    kpiSlide.background = { color: C.snow };
    kpiSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.65, fill: { color: C.navy }, line: { color: C.navy } });
    kpiSlide.addText("GALAPAGOS CAPITAL ADVISORY", { x: 0.4, y: 0, w: 6, h: 0.65, fontSize: 9, bold: true, color: "AABFE0", charSpacing: 3, valign: "middle", margin: 0 });
    kpiSlide.addText(reportData.period || "Fevereiro 2026", { x: W - 2.5, y: 0, w: 2.2, h: 0.65, fontSize: 9, color: "AABFE0", align: "right", valign: "middle", margin: 0 });
    kpiSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.65, w: W, h: 0.45, fill: { color: C.blue }, line: { color: C.blue } });
    kpiSlide.addText(title, { x: 0.4, y: 0.65, w: W - 0.8, h: 0.45, fontSize: 13, bold: true, color: C.white, valign: "middle", margin: 0 });

    const kpis = reportData.kpis || [];
    const cardW = (W - 1.0) / Math.max(kpis.length, 1);
    kpis.slice(0, 4).forEach((kpi: any, i: number) => {
      const x = 0.5 + i * cardW;
      const accentColor = kpi.color === "red" ? C.red : kpi.color === "green" ? C.green : C.blue;
      kpiSlide.addShape(pres.shapes.RECTANGLE, { x, y: 1.3, w: cardW - 0.15, h: 1.4, fill: { color: C.white }, line: { color: C.border }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.08 } });
      kpiSlide.addShape(pres.shapes.RECTANGLE, { x, y: 1.3, w: 0.06, h: 1.4, fill: { color: accentColor }, line: { color: accentColor } });
      kpiSlide.addText(kpi.label?.toUpperCase() || "", { x: x + 0.15, y: 1.35, w: cardW - 0.35, h: 0.25, fontSize: 8, bold: true, color: C.gray, charSpacing: 1, margin: 0 });
      kpiSlide.addText(kpi.value || "", { x: x + 0.15, y: 1.62, w: cardW - 0.35, h: 0.65, fontSize: 28, bold: true, color: accentColor, margin: 0 });
      kpiSlide.addText(kpi.sub || "", { x: x + 0.15, y: 2.3, w: cardW - 0.35, h: 0.3, fontSize: 9, color: C.gray, margin: 0 });
    });

    // ── SLIDE 3: PERFORMANCE ──
    const perfSlide = pres.addSlide();
    perfSlide.background = { color: C.snow };
    perfSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.65, fill: { color: C.navy }, line: { color: C.navy } });
    perfSlide.addText("GALAPAGOS CAPITAL ADVISORY", { x: 0.4, y: 0, w: 6, h: 0.65, fontSize: 9, bold: true, color: "AABFE0", charSpacing: 3, valign: "middle", margin: 0 });
    perfSlide.addText(reportData.period || "Fevereiro 2026", { x: W - 2.5, y: 0, w: 2.2, h: 0.65, fontSize: 9, color: "AABFE0", align: "right", valign: "middle", margin: 0 });
    perfSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.65, w: W, h: 0.45, fill: { color: C.blue }, line: { color: C.blue } });
    perfSlide.addText("Performance — Comparativo da Grade", { x: 0.4, y: 0.65, w: W - 0.8, h: 0.45, fontSize: 13, bold: true, color: C.white, valign: "middle", margin: 0 });

    const perf = reportData.performance || [];
    if (perf.length > 0) {
      perfSlide.addChart(pres.charts.BAR, [{
        name: "Fev/26",
        labels: perf.map((p: any) => p.name),
        values: perf.map((p: any) => p.fev || 0)
      }], {
        x: 0.5, y: 1.3, w: 5.8, h: 3.2,
        barDir: "bar",
        chartColors: perf.map((p: any) => (p.fev || 0) >= 0 ? "16a34a" : "dc2626"),
        chartArea: { fill: { color: C.white } },
        catAxisLabelColor: C.darkText,
        valAxisLabelColor: C.gray,
        valGridLine: { color: C.border, size: 0.5 },
        catGridLine: { style: "none" },
        showValue: true,
        dataLabelColor: C.darkText,
        showLegend: false,
        showTitle: true,
        title: "Retorno Fevereiro 2026 (%)",
        titleColor: C.navy,
        titleFontSize: 11,
      });

      perfSlide.addChart(pres.charts.BAR, [{
        name: "YTD 2026",
        labels: perf.map((p: any) => p.name),
        values: perf.map((p: any) => p.ytd || 0)
      }], {
        x: 7.0, y: 1.3, w: 5.8, h: 3.2,
        barDir: "bar",
        chartColors: [C.blue],
        chartArea: { fill: { color: C.white } },
        catAxisLabelColor: C.darkText,
        valAxisLabelColor: C.gray,
        valGridLine: { color: C.border, size: 0.5 },
        catGridLine: { style: "none" },
        showValue: true,
        dataLabelColor: C.darkText,
        showLegend: false,
        showTitle: true,
        title: "Retorno YTD 2026 (%)",
        titleColor: C.navy,
        titleFontSize: 11,
      });
    }

    // ── SLIDE 4: COMPOSIÇÃO ──
    const compSlide = pres.addSlide();
    compSlide.background = { color: C.snow };
    compSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.65, fill: { color: C.navy }, line: { color: C.navy } });
    compSlide.addText("GALAPAGOS CAPITAL ADVISORY", { x: 0.4, y: 0, w: 6, h: 0.65, fontSize: 9, bold: true, color: "AABFE0", charSpacing: 3, valign: "middle", margin: 0 });
    compSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.65, w: W, h: 0.45, fill: { color: C.blue }, line: { color: C.blue } });
    compSlide.addText("Composição & Look-Through", { x: 0.4, y: 0.65, w: W - 0.8, h: 0.45, fontSize: 13, bold: true, color: C.white, valign: "middle", margin: 0 });

    const comp = reportData.composition || [];
    if (comp.length > 0) {
      compSlide.addChart(pres.charts.DOUGHNUT, [{
        name: "Composição",
        labels: comp.map((c: any) => c.name),
        values: comp.map((c: any) => c.value)
      }], {
        x: 0.5, y: 1.2, w: 4.5, h: 4.0,
        chartColors: ["173C82", "0071BB", "4a9fd4", "16a34a", "d97706", "7c3aed", "dc2626"],
        showPercent: true,
        showLegend: true,
        legendPos: "r",
        chartArea: { fill: { color: C.white } },
        showTitle: true,
        title: "Composição Nível 1",
        titleColor: C.navy,
        titleFontSize: 11,
      });
    }

    const holdings = reportData.topHoldings || [];
    if (holdings.length > 0) {
      const tableRows: any[][] = [
        [
          { text: "ATIVO", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 9 } },
          { text: "TICKER", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 9 } },
          { text: "PESO %", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 9, align: "right" } },
          { text: "PERF %", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 9, align: "right" } },
        ],
        ...holdings.slice(0, 8).map((h: any, i: number) => [
          { text: h.name || "", options: { fontSize: 9, fill: { color: i % 2 === 0 ? C.white : C.snow } } },
          { text: h.ticker || "", options: { fontSize: 9, bold: true, color: C.blue, fill: { color: i % 2 === 0 ? C.white : C.snow } } },
          { text: `${(h.weight || 0).toFixed(2)}%`, options: { fontSize: 9, align: "right", fill: { color: i % 2 === 0 ? C.white : C.snow } } },
          { text: `${(h.perf || 0) >= 0 ? "+" : ""}${(h.perf || 0).toFixed(2)}%`, options: { fontSize: 9, align: "right", color: (h.perf || 0) >= 0 ? C.green : C.red, bold: true, fill: { color: i % 2 === 0 ? C.white : C.snow } } },
        ])
      ];
      compSlide.addTable(tableRows, {
        x: 5.3, y: 1.2, w: 7.5,
        colW: [3.5, 1.2, 1.2, 1.2],
        border: { pt: 0.5, color: C.border },
      });
    }

    // ── SLIDE 5: ATTRIBUTION ──
    const attrSlide = pres.addSlide();
    attrSlide.background = { color: C.snow };
    attrSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.65, fill: { color: C.navy }, line: { color: C.navy } });
    attrSlide.addText("GALAPAGOS CAPITAL ADVISORY", { x: 0.4, y: 0, w: 6, h: 0.65, fontSize: 9, bold: true, color: "AABFE0", charSpacing: 3, valign: "middle", margin: 0 });
    attrSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.65, w: W, h: 0.45, fill: { color: C.blue }, line: { color: C.blue } });
    attrSlide.addText("Attribution — Contribuidores & Detratores", { x: 0.4, y: 0.65, w: W - 0.8, h: 0.45, fontSize: 13, bold: true, color: C.white, valign: "middle", margin: 0 });

    const contributors = reportData.topContributors || [];
    const detractors = reportData.topDetractors || [];

    if (contributors.length > 0 || detractors.length > 0) {
      const allAttr = [
        ...contributors.map((c: any) => ({ ...c, type: "contrib" })),
        ...detractors.map((d: any) => ({ ...d, type: "detract" }))
      ];
      attrSlide.addChart(pres.charts.BAR, [{
        name: "Contribuição (pp)",
        labels: allAttr.map((a: any) => a.name),
        values: allAttr.map((a: any) => a.contrib || 0)
      }], {
        x: 0.5, y: 1.2, w: 7.5, h: 4.5,
        barDir: "bar",
        chartColors: allAttr.map((a: any) => a.type === "contrib" ? "16a34a" : "dc2626"),
        chartArea: { fill: { color: C.white } },
        catAxisLabelColor: C.darkText,
        valAxisLabelColor: C.gray,
        valGridLine: { color: C.border, size: 0.5 },
        catGridLine: { style: "none" },
        showValue: true,
        dataLabelColor: C.darkText,
        showLegend: false,
        showTitle: true,
        title: "Contribuição ao Retorno (pp) — Fevereiro 2026",
        titleColor: C.navy,
        titleFontSize: 11,
      });
    }

    // ── SLIDE 6: SÍNTESE ──
    const synthSlide = pres.addSlide();
    synthSlide.background = { color: C.navy };
    synthSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.08, fill: { color: C.blue }, line: { color: C.blue } });
    synthSlide.addText("GALAPAGOS CAPITAL ADVISORY", { x: 0.5, y: 0.3, w: 8, h: 0.4, fontSize: 10, bold: true, color: "AABFE0", charSpacing: 4, margin: 0 });
    synthSlide.addText("Síntese Executiva", { x: 0.5, y: 1.2, w: W - 1, h: 0.7, fontSize: 28, bold: true, color: C.white, margin: 0 });
    synthSlide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 2.1, w: W - 1, h: 0.04, fill: { color: C.blue }, line: { color: C.blue } });
    synthSlide.addText(reportData.summary || "", { x: 0.5, y: 2.3, w: W - 1, h: 2.5, fontSize: 14, color: "C8D8F0", fontFace: "Calibri", margin: 0 });
    synthSlide.addShape(pres.shapes.RECTANGLE, { x: 0, y: H - 0.6, w: W, h: 0.6, fill: { color: "0D2558" }, line: { color: "0D2558" } });
    synthSlide.addText("Galapagos Capital Advisory LLC  ·  Documento Confidencial  ·  Uso Exclusivo do Cliente", {
      x: 0.5, y: H - 0.6, w: W - 1, h: 0.6, fontSize: 8, color: "7A9CC5", valign: "middle", margin: 0
    });

    const pptxBuffer = await pres.write({ outputType: "arraybuffer" });
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pptxBuffer as ArrayBuffer)));

    return new Response(JSON.stringify({ pptx: base64, fileName: `${title.replace(/\s+/g, "_")}.pptx` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-pptx error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
