import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateEmbedding(text: string, googleKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        }),
      }
    );
    if (!res.ok) {
      console.error("Embedding error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.embedding?.values || null;
  } catch (err) {
    console.error("Embedding fetch error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- Auth validation ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, filter_type, filter_fund, session_id } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");

    // --- 1. Semantic vector search (primary) ---
    let allChunks: any[] = [];
    
    if (googleKey) {
      console.log("Generating query embedding...");
      const embedding = await generateEmbedding(query, googleKey);
      
      if (embedding) {
        console.log("Running semantic search via match_chunks...");
        const filterTypeParam = (filter_type && filter_type !== "all") ? filter_type : null;
        const filterFundParam = filter_fund || null;
        const { data: semanticChunks, error: matchError } = await supabase.rpc("match_chunks", {
          query_embedding: JSON.stringify(embedding),
          match_threshold: 0.3,
          match_count: 15,
          filter_type: filterTypeParam,
          filter_fund: filterFundParam,
        });
        
        if (matchError) {
          console.error("match_chunks error:", matchError);
        } else if (semanticChunks && semanticChunks.length > 0) {
          console.log(`Semantic search found ${semanticChunks.length} chunks`);
          allChunks.push(...semanticChunks.map((c: any) => ({
            id: c.id,
            content: c.content,
            metadata: c.metadata,
            document_id: c.document_id,
            similarity: c.similarity,
          })));
        }
      }
    }

    // --- 2. Keyword fallback (if semantic search found nothing or no API key) ---
    if (allChunks.length === 0) {
      console.log("Falling back to keyword search...");
      const words = query.split(/\s+/).filter((w: string) => w.length >= 2);
      const searchTerms = words.length > 0 ? words : [query.trim()];

      for (const term of searchTerms.slice(0, 5)) {
        const { data } = await supabase
          .from("document_chunks")
          .select("id, content, metadata, document_id")
          .ilike("content", `%${term}%`)
          .limit(5);
        if (data) allChunks.push(...data);
      }
    }

    // --- 3. Also search by document metadata (fund name, ticker) ---
    const words = query.split(/\s+/).filter((w: string) => w.length >= 2);
    const searchTerms = words.length > 0 ? words : [query.trim()];
    let docMatchIds: string[] = [];
    for (const term of searchTerms.slice(0, 3)) {
      const { data: docMatches } = await supabase
        .from("documents")
        .select("id")
        .or(`name.ilike.%${term}%,fund_name.ilike.%${term}%,metadata->>detected_ticker.ilike.%${term}%,metadata->>detected_ticker_exchange.ilike.%${term}%`);
      if (docMatches) docMatchIds.push(...docMatches.map((d: any) => d.id));
    }

    if (docMatchIds.length > 0) {
      const uniqueDocIds = [...new Set(docMatchIds)];
      const { data: metaChunks } = await supabase
        .from("document_chunks")
        .select("id, content, metadata, document_id")
        .in("document_id", uniqueDocIds)
        .limit(10);
      if (metaChunks) allChunks.push(...metaChunks);
    }

    // Deduplicate chunks
    const seen = new Set<string>();
    const chunks = allChunks.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, 15);

    console.log(`Total unique chunks: ${chunks.length}`);

    // Get document metadata
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

    const filteredDocIds = new Set(documents.map((d: any) => d.id));
    const filteredChunks = chunks.filter((c: any) => filteredDocIds.has(c.document_id));

    const context = filteredChunks.map((c: any) => {
      const doc = documents.find((d: any) => d.id === c.document_id);
      const ticker = doc?.metadata?.detected_ticker_exchange || doc?.metadata?.detected_ticker || "";
      const label = [doc?.fund_name, ticker, doc?.name, doc?.period].filter(Boolean).join(" | ");
      return `[${label}]\n${c.content}`;
    }).join("\n\n---\n\n");

    const sources = documents.map((d: any) => ({
      name: d.fund_name || d.name,
      period: d.period || "",
      document_name: d.name,
      ticker: d.metadata?.detected_ticker_exchange || d.metadata?.detected_ticker || "",
    }));

    // --- Retrieve last 5 conversation turns for context ---
    let historyMessages: { role: string; content: string }[] = [];
    if (session_id) {
      const { data: historyData } = await supabase
        .from("advisor_chat_history")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", { ascending: false })
        .limit(10); // 5 pairs = 10 messages

      if (historyData && historyData.length > 0) {
        historyMessages = historyData.reverse().map((h: any) => ({
          role: h.role === "user" ? "user" : "assistant",
          content: h.content || "",
        }));
        console.log(`Loaded ${historyMessages.length} history messages for session ${session_id}`);
      }
    }

    // --- Stream Claude response ---
    console.log(`Calling Claude with ${filteredChunks.length} chunks from ${documents.length} documents...`);

    // Build messages array: history + current query with context
    const claudeMessages = [
      ...historyMessages,
      {
        role: "user",
        content: context
          ? `Documentos encontrados:\n\n${context}\n\n---\nPergunta: ${query}`
          : `Não encontrei documentos relevantes para: "${query}". Informe que não há documentos indexados sobre este tema.`,
      },
    ];

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        stream: true,
        system: `Você é um assistente especializado em fundos de investimento da Galapagos Capital Advisory.

Responda sempre em português brasileiro de forma profissional, objetiva e analítica.

Use estritamente as informações dos documentos fornecidos para responder. Se a informação não estiver nos documentos, diga claramente que não encontrou.

REGRAS CRÍTICAS DE EXTRAÇÃO:

1. EXAUSTÃO: Quando questionado sobre múltiplos portfólios, fundos ou ativos, você DEVE extrair e apresentar TODOS os dados disponíveis no contexto. NUNCA resuma, corte, crie 'top 5' ou omita dados por conta própria.

2. FORMATO TABULAR: Sempre que a pergunta envolver atribuição de performance, rentabilidade, exposição ou comparação de múltiplos ativos/portfólios, você DEVE estruturar a resposta obrigatoriamente usando tabelas Markdown, cruzando os ativos com os respectivos portfólios.

3. PRECISÃO: Mantenha todos os números, sinais e casas decimais exatamente como estão nos documentos.`,
        messages: claudeMessages,
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude error: ${errText}`);
    }

    // Transform Claude's SSE stream into our own SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = claudeRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);

              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;

              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "content_block_delta" && event.delta?.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "delta", text: event.delta.text })}\n\n`)
                  );
                }
              } catch {
                // partial JSON, ignore
              }
            }
          }

          // Send sources as final event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
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
