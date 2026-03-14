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

    // Search chunks using full-text ilike search
    const words = query.split(/\s+/).filter((w: string) => w.length > 3);
    const searchWord = words[0] || query.substring(0, 20);

    let chunksQuery = supabase
      .from("document_chunks")
      .select("id, content, metadata, document_id")
      .ilike("content", `%${searchWord}%`)
      .limit(8);

    const { data: chunks, error: chunksError } = await chunksQuery;
    if (chunksError) throw new Error(`Search failed: ${chunksError.message}`);

    console.log(`Found ${chunks?.length || 0} chunks for word: "${searchWord}"`);

    // Get document info for sources
    const docIds = [...new Set((chunks || []).map((c: any) => c.document_id))];
    let documents: any[] = [];
    if (docIds.length > 0) {
      const { data } = await supabase
        .from("documents")
        .select("id, name, fund_name, period, type")
        .in("id", docIds);
      documents = data || [];

      // Apply filter_type on documents if provided
      if (filter_type && filter_type !== "all") {
        documents = documents.filter((d: any) => d.type === filter_type);
      }
    }

    // Build context string
    const filteredDocIds = new Set(documents.map((d: any) => d.id));
    const filteredChunks = (chunks || []).filter((c: any) => filteredDocIds.has(c.document_id));

    const context = filteredChunks.map((c: any) => {
      const doc = documents.find((d: any) => d.id === c.document_id);
      const label = [doc?.fund_name, doc?.name, doc?.period].filter(Boolean).join(" | ");
      return `[${label}]\n${c.content}`;
    }).join("\n\n---\n\n");

    // Call Claude
    console.log("Calling Claude...");
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
