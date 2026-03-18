import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
      },
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

// --- Macro Market Context Search via Gemini + Google Search Grounding ---
async function searchMacroMarketContext(query: string, googleKey: string): Promise<any> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Você é um analista macroeconômico sênior. Responda em português brasileiro de forma técnica e concisa.\n\nPesquise e resuma os principais fatores macroeconômicos, geopolíticos e de mercado que explicam o seguinte:\n\n${query}\n\nSeja factual e cite fontes/datas quando possível. Máximo 400 palavras.`,
                },
              ],
            },
          ],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!res.ok) {
      return { status: "error", message: `Erro na busca macro`, query };
    }

    const data = await res.json();
    const textParts = data?.candidates?.[0]?.content?.parts || [];
    const textContent = textParts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("\n");

    const groundingMetadata = data?.candidates?.[0]?.groundingMetadata;
    const groundingSources =
      groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || "",
        url: c.web?.uri || "",
      })) || [];

    return { status: "success", query, analysis: textContent, sources: groundingSources };
  } catch (err) {
    return { status: "fetch_error", message: `Falha na busca de contexto macro para: "${query}"`, query };
  }
}

// --- Company/Ticker News Search via Gemini + Google Search Grounding ---
async function getCompanyTickerNews(symbol: string, fromDate: string, toDate: string, googleKey: string): Promise<any> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Você é um analista financeiro sênior. Pesquise e liste as principais notícias e eventos corporativos relacionados ao ticker "${symbol}" no período de ${fromDate} a ${toDate}.\n\nResponda em português brasileiro. Seja factual. Máximo 500 palavras.`,
                },
              ],
            },
          ],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
        }),
      },
    );

    if (!res.ok) {
      return { status: "error", message: `Erro ao buscar notícias`, symbol };
    }

    const data = await res.json();
    const textParts = data?.candidates?.[0]?.content?.parts || [];
    const textContent = textParts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("\n");

    const groundingMetadata = data?.candidates?.[0]?.groundingMetadata;
    const groundingSources =
      groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || "",
        url: c.web?.uri || "",
      })) || [];

    return {
      status: "success",
      symbol,
      period: `${fromDate} a ${toDate}`,
      news: textContent,
      sources: groundingSources,
    };
  } catch (err) {
    return { status: "fetch_error", message: `Falha ao buscar notícias para ${symbol}`, symbol };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!googleKey) throw new Error("Missing GOOGLE_AI_API_KEY env var.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // Usar a Service Role Key se disponível para contornar bloqueios de segurança nas leituras de tabelas
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) throw new Error("Missing SUPABASE config vars.");

    // Passar o Header de Autorização do utilizador logado para garantir que os RPCs de segurança funcionam
    const authHeader = req.headers.get("Authorization") || "";

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const body = await req.json();
    const {
      query,
      messages: rawMessages,
      systemPrompt: clientSystemPrompt,
      geminiTools,
      active_portfolio,
      active_ticker,
    } = body;

    let messages: any[];
    if (rawMessages && Array.isArray(rawMessages)) {
      messages = rawMessages;
    } else if (query) {
      messages = [{ role: "user", content: query }];
    } else {
      throw new Error("Missing messages or query in request.");
    }

    // --- RAG: BUSCA VETORIAL NOS DOCUMENTOS (PDFs) ---
    let documentContext = "";
    let documentSources: any[] = [];

    try {
      const queryEmbedding = await generateEmbedding(query, googleKey);
      if (queryEmbedding) {
        const { data: matchedDocs, error: matchError } = await supabaseClient.rpc("match_documents", {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5,
        });

        if (!matchError && matchedDocs && matchedDocs.length > 0) {
          documentContext = matchedDocs
            .map((doc: any) => `[Fonte: ${doc.metadata?.file_name || doc.file_name || "Documento"}]\n${doc.content}`)
            .join("\n\n---\n\n");
          documentSources = matchedDocs.map((doc: any) => ({
            name: doc.metadata?.file_name || doc.file_name || "Documento da Library",
            period: "Data Hub",
            file_url: doc.metadata?.file_url || doc.file_url || null,
          }));
        } else if (matchError) {
          console.error("Vector search erro (RAG):", matchError);
        }
      }
    } catch (ragError) {
      console.error("Erro na execução do RAG:", ragError);
    }

    // --- Fetch live portfolio data from Supabase ---
    const [allocRes, navsRes, holdingsRes] = await Promise.all([
      supabaseClient
        .from("model_allocations")
        .select("portfolio_name, asset_class, weight_pct")
        .order("portfolio_name")
        .order("weight_pct", { ascending: false }),
      supabaseClient
        .from("daily_navs")
        .select("portfolio_name, date, nav, daily_return, ytd_return")
        .order("date", { ascending: false })
        .limit(10),
      supabaseClient
        .from("portfolio_holdings")
        .select(
          "portfolio_name, ticker, asset_name, asset_class, weight_percentage, monthly_contribution, contribution_month, ytd_return, monthly_return",
        )
        .eq("is_active", true)
        .order("portfolio_name")
        .order("weight_percentage", { ascending: false }),
    ]);

    // Logging de Segurança (Visível nos Edge Functions Logs no Supabase)
    console.log(`Dados carregados -> Ativos encontrados: ${holdingsRes.data?.length || 0}`);
    if (holdingsRes.error) console.error("Erro ao carregar ativos:", holdingsRes.error);

    // Build allocation summary
    const allocMap: Record<string, string[]> = {};
    for (const row of allocRes.data || []) {
      const key = row.portfolio_name;
      if (!allocMap[key]) allocMap[key] = [];
      allocMap[key].push(`${row.asset_class}: ${row.weight_pct}%`);
    }
    const allocText = Object.entries(allocMap)
      .map(([k, v]) => `  ${k}: ${v.join(", ")}`)
      .join("\n");

    // Build latest NAVs
    const latestDate = navsRes.data?.[0]?.date || "N/A";
    const navsText = (navsRes.data || [])
      .filter((r: any) => r.date === latestDate)
      .map(
        (r: any) =>
          `  ${r.portfolio_name}: NAV ${r.nav} | Daily ${r.daily_return >= 0 ? "+" : ""}${r.daily_return?.toFixed(2)}% | YTD ${r.ytd_return >= 0 ? "+" : ""}${r.ytd_return?.toFixed(2)}%`,
      )
      .join("\n");

    // Build holdings per portfolio (Tratamento direto do N/A)
    const holdingsMap: Record<string, string[]> = {};
    for (const row of holdingsRes.data || []) {
      const key = row.portfolio_name;
      if (!holdingsMap[key]) holdingsMap[key] = [];

      const contrib =
        row.monthly_contribution != null
          ? ` | Contrib: ${row.monthly_contribution >= 0 ? "+" : ""}${row.monthly_contribution.toFixed(2)}%`
          : " | Contrib: N/A";
      const ytd =
        row.ytd_return != null
          ? ` | Retorno YTD: ${row.ytd_return >= 0 ? "+" : ""}${row.ytd_return.toFixed(2)}%`
          : " | Retorno YTD: N/A";
      const monthly =
        row.monthly_return != null
          ? ` | Retorno Mês: ${row.monthly_return >= 0 ? "+" : ""}${row.monthly_return.toFixed(2)}%`
          : " | Retorno Mês: N/A";

      holdingsMap[key].push(
        `${row.ticker || "N/A"} (${row.asset_name}) — ${row.asset_class}, Peso: ${row.weight_percentage}%${ytd}${monthly}${contrib}`,
      );
    }

    const holdingsText = Object.entries(holdingsMap)
      .map(([k, v]) => `  **${k}:**\n    ${v.join("\n    ")}`)
      .join("\n\n");

    // --- Build system prompt ---
    const GALAPAGOS_SYSTEM_PROMPT = `Você é o Advisor de IA da **Galapagos Capital**. Responda sempre em português brasileiro de forma técnica.

## INSTRUÇÕES CRÍTICAS (LEIA COM ATENÇÃO MÁXIMA)
1. OS DADOS ESTÃO AQUI: Nunca diga que os dados não estão disponíveis se eles constarem nas tabelas abaixo.
2. TABELA OBRIGATÓRIA: Se o usuário pedir as posições de um portfólio (ex: Growth), você TEM de construir a tabela Markdown mostrando os Ativos e Pesos listados na seção de Holdings Detalhados.
3. LIDAR COM VALORES VAZIOS: Se vir "N/A" nos retornos, COPIE O "N/A" para a tabela. Jamais recuse entregar a lista de ativos só porque o retorno está nulo ou N/A.

## DADOS ESTRUTURAIS DO BANCO
### Alocação Macro:
${allocText}
### NAVs e Performance (Dados: ${latestDate}):
${navsText}
### Holdings Detalhados (Lista de Ativos por Portfólio):
${holdingsText}

## CONHECIMENTO DOS DOCUMENTOS (PDFs - FONTE PARA EXPLICAÇÕES E ATRIBUIÇÃO)
Use os trechos abaixo para explicar "por que" a performance aconteceu.
${documentContext ? documentContext : "Nenhum documento específico."}

## ESTRUTURA DA RESPOSTA
1. Se houver documentos, explique a atribuição em um breve parágrafo.
2. Em seguida, APRESENTE A TABELA com todas as posições do portfólio solicitado, extraindo do campo "Holdings Detalhados". Não oculte nenhum ativo.

## CONTEXTO ATIVO
${active_portfolio ? `Portfólio em foco: ${active_portfolio}` : "Nenhum portfólio selecionado"}
${active_ticker ? `Ticker em foco: ${active_ticker}` : ""}`;

    const finalSystemPrompt = clientSystemPrompt || GALAPAGOS_SYSTEM_PROMPT;

    const claudeMessages = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : m.role,
      content: m.content,
    }));

    function toGeminiMessages(msgs: any[]) {
      return msgs.map((m: any) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));
    }

    const PRIMARY_MODEL = "gemini-2.5-flash";
    const FALLBACK_MODEL = "gemini-1.5-flash";

    const createGeminiResponse = async (msgs: any[], model: string = PRIMARY_MODEL) => {
      const geminiMessages = toGeminiMessages(msgs);
      const payload: any = {
        contents: geminiMessages,
        systemInstruction: { parts: [{ text: finalSystemPrompt }] },
        generationConfig: { temperature: 0, maxOutputTokens: 4096 },
      };
      if (geminiTools) payload.tools = geminiTools;

      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    };

    const createGeminiResponseWithFallback = async (msgs: any[]) => {
      let response = await createGeminiResponse(msgs, PRIMARY_MODEL);
      if (!response.ok) {
        const primaryErrorText = await response.text();
        const normalizedError = primaryErrorText.toLowerCase();
        if (response.status === 404 || normalizedError.includes("not found")) {
          response = await createGeminiResponse(msgs, FALLBACK_MODEL);
          if (!response.ok) {
            const fallbackErrorText = await response.text();
            throw new Error(`Gemini error: ${fallbackErrorText}`);
          }
          return response;
        }
        throw new Error(`Gemini error: ${primaryErrorText}`);
      }
      return response;
    };

    const initialRes = await createGeminiResponseWithFallback(claudeMessages);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let sources: any[] = [...documentSources];

    const stream = new ReadableStream({
      async start(controller) {
        const reader = initialRes.body!.getReader();
        let currentText = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            currentText += chunkText;

            let newlineIndex: number;
            while ((newlineIndex = currentText.indexOf("\n")) !== -1) {
              let line = currentText.slice(0, newlineIndex);
              currentText = currentText.slice(newlineIndex + 1);

              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line || line.trim() === "" || line.startsWith(":")) continue;
              if (!line.startsWith("data: ")) continue;

              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") break;

              try {
                const data = JSON.parse(jsonStr);

                if (data.error) {
                  console.error("Gemini error in stream:", data.error);
                  controller.error(data.error);
                  return;
                }

                if (data.candidates?.[0]?.content?.parts) {
                  for (const part of data.candidates[0].content.parts) {
                    if (part.text) {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: "delta", text: part.text })}\n\n`),
                      );
                    }
                  }
                }

                if (data.candidates?.[0]?.content?.parts) {
                  for (const part of data.candidates[0].content.parts) {
                    if (part.functionCall) {
                      const { name, args } = part.functionCall;
                      let toolResult: any = null;
                      switch (name) {
                        case "searchMacroMarketContext":
                          toolResult = await searchMacroMarketContext(args.query, googleKey);
                          if (toolResult?.sources) sources = sources.concat(toolResult.sources);
                          break;
                        case "getCompanyTickerNews":
                          toolResult = await getCompanyTickerNews(args.symbol, args.fromDate, args.toDate, googleKey);
                          if (toolResult?.sources) sources = sources.concat(toolResult.sources);
                          break;
                      }
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: "tool_call", tool: name, input: args })}\n\n`),
                      );
                    }
                  }
                }
              } catch {
                currentText = line + "\n" + currentText;
                break;
              }
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`));
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
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
