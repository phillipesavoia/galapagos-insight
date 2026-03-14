import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, filter_type, filter_fund } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const dbUrl = Deno.env.get("DB_URL");
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!dbUrl || !dbKey || !anthropicKey) throw new Error("Missing env vars");
    if (!googleKey) throw new Error("Missing GOOGLE_AI_API_KEY for embeddings");

    const supabase = createClient(dbUrl, dbKey);

    // Step 1: Generate embedding for the query
    console.log("Generating query embedding...");
    const embRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: query }] },
          outputDimensionality: 768,
        }),
      }
    );

    if (!embRes.ok) {
      const errText = await embRes.text();
      throw new Error(`Embedding failed [${embRes.status}]: ${errText}`);
    }

    const embData = await embRes.json();
    const queryEmbedding = embData.embedding.values as number[];
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // Step 2: Search using match_chunks vector function
    console.log("Searching with match_chunks...");
    const { data: chunks, error: chunksError } = await supabase.rpc("match_chunks", {
      query_embedding: embeddingStr,
      match_threshold: 0.3,
      match_count: 8,
      filter_type: filter_type && filter_type !== "all" ? filter_type : null,
      filter_fund: filter_fund || null,
    });

    if (chunksError) throw new Error(`Search failed: ${chunksError.message}`);
    console.log(`Found ${chunks?.length || 0} matching chunks`);

    // Step 3: Get document names for sources
    const docIds = [...new Set((chunks || []).map((c: any) => c.document_id))];
    let documents: any[] = [];
    if (docIds.length > 0) {
      const { data } = await supabase
        .from("documents")
        .select("id, name, fund_name, period, type")
        .in("id", docIds);
      documents = data || [];
    }

    // Step 4: Build context
    const context = (chunks || []).map((c: any) => {
      const doc = documents.find((d: any) => d.id === c.document_id);
      return `[${doc?.name || "Documento"} | ${doc?.fund_name || ""} | ${doc?.period || ""} | Similaridade: ${(c.similarity * 100).toFixed(1)}%]\n${c.content}`;
    }).join("\n\n---\n\n");

    // Step 5: Call Claude
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
Seja direto e objetivo. Cite os documentos quando relevante.
Formate sua resposta usando markdown: use **negrito** para métricas importantes, listas com - para itens, e organize bem as informações.`,
        messages: [
          {
            role: "user",
            content: context
              ? `Documentos relevantes encontrados:\n\n${context}\n\n---\nPergunta: ${query}`
              : `Não encontrei documentos relevantes para: ${query}. Por favor, informe que não há documentos indexados sobre este tema.`
          }
        ],
      }),
    });

    if (!claudeRes.ok) throw new Error(`Claude failed: ${await claudeRes.text()}`);
    const claudeData = await claudeRes.json();
    const answer = claudeData.content?.[0]?.text || "Sem resposta";

    // Build sources
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
