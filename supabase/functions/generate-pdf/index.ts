import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { html, fileName } = await req.json();

    if (!html) {
      return new Response(JSON.stringify({ error: "html is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const api2pdfKey = Deno.env.get("API2PDF_KEY");
    if (!api2pdfKey) {
      return new Response(JSON.stringify({ error: "API2PDF_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip ECharts CDN and chart init scripts to avoid API2PDF timeout
    // Replace chart divs with a "see interactive version" placeholder
    let pdfHtml = html
      .replace(/<script[^>]*src[^>]*echarts[^>]*><\/script>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?echarts[\s\S]*?<\/script>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?\.setOption\([\s\S]*?<\/script>/gi, '');

    // Replace empty chart divs with styled placeholders
    pdfHtml = pdfHtml.replace(
      /<div\s+id="chart\d+"[^>]*style="[^"]*height:\s*\d+px[^"]*"[^>]*><\/div>/gi,
      '<div style="height:60px;display:flex;align-items:center;justify-content:center;background:#f0f4f8;border-radius:6px;color:#64748b;font-size:11px;font-style:italic;">📊 Gráfico interativo disponível na versão digital</div>'
    );

    const pdfRes = await fetch("https://v2.api2pdf.com/chrome/html", {
      method: "POST",
      headers: {
        "Authorization": api2pdfKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: pdfHtml,
        inlineHtml: true,
        options: {
          landscape: false,
          printBackground: true,
          format: "A4",
          marginTop: "0mm",
          marginBottom: "0mm",
          marginLeft: "0mm",
          marginRight: "0mm",
          delay: 500,
        },
        fileName: fileName || "report.pdf",
      }),
    });

    if (!pdfRes.ok) {
      const errText = await pdfRes.text();
      console.error("API2PDF error:", errText);
      return new Response(JSON.stringify({ error: `PDF generation failed: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfData = await pdfRes.json();

    if (!pdfData?.FileUrl) {
      return new Response(JSON.stringify({ error: "No PDF URL returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ pdfUrl: pdfData.FileUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-pdf error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
