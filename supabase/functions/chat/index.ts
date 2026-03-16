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

const TOOLS = [
  {
    name: "renderizar_grafico_barras",
    description: `Use esta ferramenta SEMPRE que precisar comparar dados numéricos entre ativos ou portfólios (ex: YTD, retorno mensal, drawdown, peso, contribuição). Em vez de criar uma tabela markdown, chame esta ferramenta com os dados estruturados para que o frontend renderize um gráfico de barras interativo. 
    
Exemplos de quando usar:
- "Compare a performance YTD dos portfólios"
- "Qual o drawdown máximo de cada fundo?"  
- "Mostre os pesos dos ativos no portfólio Growth"
- Qualquer comparação numérica entre 2+ itens`,
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título descritivo do gráfico (ex: 'Performance YTD por Portfólio')",
        },
        data: {
          type: "array",
          description: "Array de objetos com os dados. Cada objeto deve ter 'name' (label) e um ou mais campos numéricos.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome/label do item (ex: nome do ativo ou portfólio)" },
            },
            required: ["name"],
            additionalProperties: true,
          },
        },
        bars: {
          type: "array",
          description: "Array definindo quais campos numéricos renderizar como barras.",
          items: {
            type: "object",
            properties: {
              dataKey: { type: "string", description: "Nome do campo numérico no objeto de dados" },
              label: { type: "string", description: "Label legível para a legenda" },
              color: { type: "string", description: "Cor hex opcional (ex: '#10b981')" },
            },
            required: ["dataKey", "label"],
          },
        },
        yAxisLabel: {
          type: "string",
          description: "Label do eixo Y (ex: '%', 'USD', 'bps')",
        },
      },
      required: ["title", "data", "bars"],
    },
  },
  {
    name: "renderizar_flash_factsheet",
    description: `Use esta ferramenta SEMPRE que o usuário pedir informações detalhadas, características, tese ou perfil de um ativo/fundo específico. Em vez de escrever textos longos, chame esta ferramenta para renderizar um card visual estilo Factsheet no frontend.

Exemplos de quando usar:
- "Me fale sobre o ativo X"
- "Qual a tese do fundo Y?"
- "Detalhe as características do ETF Z"
- "Explique a posição em crédito high yield"
- Qualquer pedido focado em UM ativo/fundo específico`,
    input_schema: {
      type: "object",
      properties: {
        assetName: {
          type: "string",
          description: "Nome completo do ativo ou fundo (ex: 'iShares USD Treasury Bond 1-3yr ETF')",
        },
        ticker: {
          type: "string",
          description: "Ticker do ativo se disponível (ex: 'SHY', 'HYG'). Deixe vazio se não houver.",
        },
        assetClass: {
          type: "string",
          description: "Classe do ativo (ex: 'Fixed Income', 'Equities', 'Alternatives', 'Cash & Equivalents', 'Commodities')",
        },
        portfolios: {
          type: "array",
          description: "Lista dos portfólios onde o ativo está presente",
          items: { type: "string" },
        },
        radarMetrics: {
          type: "array",
          description: "Métricas para o gráfico radar. Cada item tem 'metric' (nome) e 'score' (0-10).",
          items: {
            type: "object",
            properties: {
              metric: { type: "string", description: "Nome da métrica (ex: 'Risco', 'Liquidez', 'Retorno Esperado', 'Correlação S&P')" },
              score: { type: "number", description: "Nota de 0 a 10" },
            },
            required: ["metric", "score"],
          },
        },
        thesis: {
          type: "string",
          description: "Tese resumida do ativo na carteira (máximo 2 frases curtas explicando o racional da posição)",
        },
      },
      required: ["assetName", "assetClass", "portfolios", "radarMetrics", "thesis"],
    },
  },
];

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

    // --- 2. Keyword fallback ---
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

    // --- 3. Document metadata search ---
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
        .select("id, name, fund_name, period, type, metadata, file_url")
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
      file_url: d.file_url || null,
    }));

    // --- Retrieve conversation history ---
    let historyMessages: { role: string; content: string }[] = [];
    if (session_id) {
      const { data: historyData } = await supabase
        .from("advisor_chat_history")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (historyData && historyData.length > 0) {
        historyMessages = historyData.reverse().map((h: any) => ({
          role: h.role === "user" ? "user" : "assistant",
          content: h.content || "",
        }));
        console.log(`Loaded ${historyMessages.length} history messages for session ${session_id}`);
      }
    }

    // --- Stream Claude response with tool calling ---
    console.log(`Calling Claude with ${filteredChunks.length} chunks, tools enabled...`);

    const claudeMessages = [
      ...historyMessages,
      {
        role: "user",
        content: context
          ? `Documentos encontrados:\n\n${context}\n\n---\nPergunta: ${query}`
          : `Não encontrei documentos relevantes para: "${query}". Informe que não há documentos indexados sobre este tema.`,
      },
    ];

    const systemPrompt = `Você é um assistente técnico e quantitativo da Galapagos Capital Advisory, desenvolvido exclusivamente para dar suporte diário a assessores de investimentos no Brasil.

Responda sempre em português brasileiro de forma técnica, analítica e ultra-direta, utilizando jargões de mercado financeiro apropriados.

Use estritamente as informações dos documentos fornecidos. Se a informação não estiver lá, diga claramente que não encontrou.

REGRAS CRÍTICAS:

1. EXAUSTÃO TOTAL: Quando questionado sobre múltiplos portfólios (Conservative, Income, Balanced, Growth) ou ativos, você DEVE extrair e apresentar TODOS os dados disponíveis. NUNCA resuma, corte, crie 'top 5' ou omita dados por conta própria.

2. GRÁFICOS EM VEZ DE TABELAS: Quando a pergunta envolver comparação numérica entre ativos ou portfólios (performance, retorno, drawdown, peso, contribuição), você DEVE usar a ferramenta 'renderizar_grafico_barras' para enviar os dados estruturados. O frontend renderizará um gráfico de barras interativo. NUNCA crie tabelas markdown para dados comparativos numéricos — use SEMPRE a ferramenta de gráfico.

3. FOCO NO ASSESSOR: Entregue os números diretos, motivos de alterações nos modelos e impactos na performance, sem linguagem comercial.

4. INVESTIMENTOS GLOBAIS/OFFSHORE: Lembre-se que todos os portfólios e ativos são investimentos globais/offshore. Mantenha os jargões originais do mercado internacional em inglês (ex: YTD, Drawdown, Yield, Duration) e referencie valores sempre em Dólar (USD), a menos que o documento especifique outra moeda.

5. REGRA DE LISTAGEM DE ATIVOS: Quando o usuário pedir para listar ativos por características qualitativas (ex: correlação, risco, tese), NUNCA crie tabelas com colunas de textos longos. Em vez disso:
   a) Use bullet points textuais curtos para explicar a tese de cada ativo.
   b) O objetivo é a leitura dinâmica do assessor.

6. REGRA DE FORMATAÇÃO PARA UI ESTREITA: A interface do chat é estreita. É ESTRITAMENTE PROIBIDO gerar tabelas markdown com mais de 3 colunas. Para dados numéricos comparativos, USE A FERRAMENTA renderizar_grafico_barras. Para informações qualitativas, use bullet points:

- **[Nome do Ativo]** ([Classe]) | Métrica: [X%]
  ↳ Portfólios: [Conservative, Income, ...]
  ↳ [Breve comentário]

7. COMBINAÇÃO TEXTO + GRÁFICO: Você pode e deve combinar texto explicativo com chamadas de ferramentas. Primeiro explique brevemente o contexto/análise em bullet points, depois chame a ferramenta com os dados numéricos para visualização gráfica.

8. FLASH FACTSHEET: Quando o usuário perguntar sobre um ativo/fundo ESPECÍFICO (tese, características, perfil, detalhes), USE OBRIGATORIAMENTE a ferramenta 'renderizar_flash_factsheet'. Preencha as métricas do radar com notas de 0 a 10 baseando-se nos dados dos documentos. As métricas padrão são: Risco/Volatilidade, Liquidez, Expectativa de Retorno, Correlação S&P. Adicione métricas extras se relevante (ex: Duration, Yield). A tese deve ser ultra-concisa (máx 2 frases).

9. REGRA DE COMPOSIÇÃO E PESOS: Sempre que o usuário pedir a quebra de um portfólio, exposições (como moedas, setores, classes) ou pesos de ativos, você DEVE OBRIGATORIAMENTE estruturar a resposta com Subtotais por categoria e um Total Geral exato. Use estritamente a seguinte hierarquia visual:

### **[Nome da Categoria] (Subtotal: X%)**
- **[Nome do Ativo]**: Y% (Breve comentário)
- **[Nome do Ativo]**: Z% (Breve comentário)

### **TOTAL DA EXPOSIÇÃO [TEMA]: [Soma exata dos Subtotais]%**

A matemática deve ser precisa, e o visual deve parecer um extrato de alocação de mesa de operações.

10. DATA DE REFERÊNCIA: Sempre que apresentar métricas de performance (retorno, volatilidade, drawdown, Sharpe, YTD, etc.) ou dados de alocação/pesos, você DEVE incluir a data de referência dos dados no início da resposta ou junto às métricas, no formato '📅 Dados ref.: DD/MM/AAAA' (ou o período correspondente, ex: 'Jan-Dez 2024'). Extraia a data dos metadados do documento (campo 'period') ou do conteúdo dos chunks. Se a data exata não estiver disponível, indique claramente 'Data de referência não identificada nos documentos'.

11. CITAÇÃO DE FONTES: Ao final de TODA resposta, você DEVE incluir uma seção '📎 **Fontes:**' listando o nome exato de cada documento utilizado para compor a resposta. Use o formato:

📎 **Fontes:**
- [Nome exato do documento] (Fundo: [fund_name], Período: [period])

Liste apenas os documentos efetivamente citados/usados. Isso garante rastreabilidade total para o assessor.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        stream: true,
        system: systemPrompt,
        tools: TOOLS,
        messages: claudeMessages,
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude error: ${errText}`);
    }

    // Transform Claude's SSE stream into our custom SSE stream
    // Handle both text deltas and tool_use blocks
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = claudeRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        
        // Track tool use blocks being built
        let currentToolId = "";
        let currentToolName = "";
        let toolInputJson = "";

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

                // Text delta
                if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta?.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "delta", text: event.delta.text })}\n\n`)
                  );
                }

                // Tool use block start
                if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
                  currentToolId = event.content_block.id || "";
                  currentToolName = event.content_block.name || "";
                  toolInputJson = "";
                }

                // Tool input delta (JSON string chunks)
                if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
                  toolInputJson += event.delta.partial_json || "";
                }

                // Content block stop — if we were building a tool call, emit it
                if (event.type === "content_block_stop" && currentToolName) {
                  try {
                    const toolInput = JSON.parse(toolInputJson);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        type: "tool_call",
                        tool: currentToolName,
                        input: toolInput,
                      })}\n\n`)
                    );
                  } catch (e) {
                    console.error("Failed to parse tool input JSON:", e, toolInputJson);
                  }
                  currentToolId = "";
                  currentToolName = "";
                  toolInputJson = "";
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
