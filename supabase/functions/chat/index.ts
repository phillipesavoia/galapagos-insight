import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, filter_type } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const dbUrl = Deno.env.get("DB_URL");
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!dbUrl || !dbKey || !anthropicKey) throw new Error("Missing env vars");

    const supabase = createClient(dbUrl, dbKey);

    // Extract search terms - include short words too (tickers like DTLA)
    const words = query.split(/\s+/).filter((w: string) => w.length >= 2);
    const searchTerms = words.length > 0 ? words : [query.trim()];
    console.log("Search terms:", searchTerms);

    // Strategy 1: Search chunks by content using OR across all terms
    let allChunks: any[] = [];
    for (const term of searchTerms.slice(0, 5)) {
      const { data } = await supabase
        .from("document_chunks")
        .select("id, content, metadata, document_id")
        .ilike("content", `%${term}%`)
        .limit(5);
      if (data) allChunks.push(...data);
    }

    // Strategy 2: Also search by document name/fund_name/metadata for tickers
    let docMatchIds: string[] = [];
    for (const term of searchTerms.slice(0, 3)) {
      const { data: docMatches } = await supabase
        .from("documents")
        .select("id")
        .or(`name.ilike.%${term}%,fund_name.ilike.%${term}%,metadata->>detected_ticker.ilike.%${term}%,metadata->>detected_ticker_exchange.ilike.%${term}%`);
      if (docMatches) docMatchIds.push(...docMatches.map((d: any) => d.id));
    }

    // If we found documents by metadata, fetch their chunks too
    if (docMatchIds.length > 0) {
      const uniqueDocIds = [...new Set(docMatchIds)];
      const { data: metaChunks } = await supabase
        .from("document_chunks")
        .select("id, content, metadata, document_id")
        .in("document_id", uniqueDocIds)
        .limit(10);
      if (metaChunks) allChunks.push(...metaChunks);
    }

    // Deduplicate chunks by id
    const seen = new Set<string>();
    const chunks = allChunks.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, 12);

    console.log(`Found ${chunks.length} unique chunks`);

    // Get document info for sources
    const docIds = [...new Set(chunks.map((c: any) => c.document_id))];
    let documents: any[] = [];
    if (docIds.length > 0) {
      const { data } = await supabase
        .from("documents")
        .select("id, name, fund_name, period, type, metadata")
        .in("id", docIds);
      documents = data || [];

      if (filter_type && filter_type !== "all") {
        documents = documents.filter((d: any) => d.type === filter_type);
      }
    }

    // Build context string
    const filteredDocIds = new Set(documents.map((d: any) => d.id));
    const filteredChunks = chunks.filter((c: any) => filteredDocIds.has(c.document_id));

    const context = filteredChunks.map((c: any) => {
      const doc = documents.find((d: any) => d.id === c.document_id);
      const ticker = doc?.metadata?.detected_ticker_exchange || doc?.metadata?.detected_ticker || "";
      const label = [doc?.fund_name, ticker, doc?.name, doc?.period].filter(Boolean).join(" | ");
      return `[${label}]\n${c.content}`;
    }).join("\n\n---\n\n");

    // Call Claude
    console.log("Calling Claude with context length:", context.length);
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `Você é um assistente especializado em fundos de investimento da Galapagos Capital Advisory.
Responda sempre em português brasileiro de forma profissional e objetiva.
Use apenas as informações dos documentos fornecidos para responder.
Se a informação não estiver nos documentos, diga claramente que não encontrou nos documentos indexados.
Seja direto e preciso. Cite os documentos quando relevante.
Formate sua resposta usando markdown: use **negrito** para métricas importantes, listas com - para itens, e organize bem as informações.`,
        messages: [{
          role: "user",
          content: context
            ? `Documentos encontrados:\n\n${context}\n\n---\nPergunta: ${query}`
            : `Não encontrei documentos relevantes para: "${query}". Informe que não há documentos indexados sobre este tema.`
        }],
      }),
    });

    if (!claudeRes.ok) throw new Error(`Claude error: ${await claudeRes.text()}`);
    const claudeData = await claudeRes.json();
    const answer = claudeData.content?.[0]?.text || "Sem resposta";

    const sources = documents.map((d: any) => ({
      name: d.fund_name || d.name,
      period: d.period || "",
      document_name: d.name,
      ticker: d.metadata?.detected_ticker_exchange || d.metadata?.detected_ticker || "",
    }));

    return new Response(JSON.stringify({ answer, sources }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
