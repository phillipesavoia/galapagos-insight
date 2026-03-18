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

// --- Live Market Data fetcher ---
async function fetchLiveMarketData(ticker: string, isin: string | null): Promise<any> {
  const apiKey = Deno.env.get("MARKET_DATA_API_KEY");
  if (!apiKey) {
    console.warn("MARKET_DATA_API_KEY not configured — returning placeholder response");
    return {
      status: "api_not_configured",
      message: `A API de dados de mercado ainda não está configurada. Configure a variável MARKET_DATA_API_KEY para habilitar dados em tempo real.`,
      ticker,
      isin: isin || null,
    };
  }

  // Placeholder implementation — replace with actual API call when ready
  // Example APIs: Financial Modeling Prep, Alpha Vantage, Polygon.io, Bloomberg B-PIPE
  const identifier = isin || ticker;
  const apiUrl = `https://api.marketdata.example.com/v1/quote?symbol=${encodeURIComponent(identifier)}&apikey=${apiKey}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Market data API error [${res.status}]:`, errText);
      return {
        status: "api_error",
        message: `Erro ao buscar dados de mercado para ${ticker}: HTTP ${res.status}`,
        ticker,
        isin: isin || null,
      };
    }
    const data = await res.json();
    return {
      status: "success",
      ticker,
      isin: isin || null,
      ...data,
    };
  } catch (err) {
    console.error("Market data fetch error:", err);
    return {
      status: "fetch_error",
      message: `Falha na conexão com API de mercado para ${ticker}`,
      ticker,
      isin: isin || null,
    };
  }
}

// --- Macro Market Context Search via Gemini + Google Search Grounding ---
async function searchMacroMarketContext(query: string, googleKey: string): Promise<any> {
  try {
    console.log(`Searching macro context: "${query}"`);
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
                  text: `Você é um analista macroeconômico sênior. Responda em português brasileiro de forma técnica e concisa.\n\nPesquise e resuma os principais fatores macroeconômicos, geopolíticos e de mercado que explicam o seguinte:\n\n${query}\n\nEstruture sua resposta em:\n1. **Principais Drivers Macro** (políticas monetárias, dados econômicos, decisões de bancos centrais)\n2. **Fatores Geopolíticos** (tensões comerciais, regulação, eventos políticos)\n3. **Dinâmica de Mercado** (fluxos, sentimento, posicionamento técnico)\n4. **Resultados Corporativos / Setoriais** (se aplicável)\n\nSeja factual e cite fontes/datas quando possível. Máximo 400 palavras.`,
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
      const errText = await res.text();
      console.error(`Gemini search error [${res.status}]:`, errText);
      return {
        status: "error",
        message: `Erro na busca macro: HTTP ${res.status}`,
        query,
      };
    }

    const data = await res.json();
    const textParts = data?.candidates?.[0]?.content?.parts || [];
    const textContent = textParts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("\n");

    // Extract grounding metadata (sources)
    const groundingMetadata = data?.candidates?.[0]?.groundingMetadata;
    const searchSuggestions = groundingMetadata?.searchEntryPoint?.renderedContent || null;
    const groundingSources =
      groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || "",
        url: c.web?.uri || "",
      })) || [];

    return {
      status: "success",
      query,
      analysis: textContent,
      sources: groundingSources,
      searchSuggestions,
    };
  } catch (err) {
    console.error("Macro search error:", err);
    return {
      status: "fetch_error",
      message: `Falha na busca de contexto macro para: "${query}"`,
      query,
    };
  }
}

// --- Company/Ticker News Search via Gemini + Google Search Grounding ---
async function getCompanyTickerNews(symbol: string, fromDate: string, toDate: string, googleKey: string): Promise<any> {
  try {
    console.log(`Fetching news for ${symbol} from ${fromDate} to ${toDate}`);
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
                  text: `Você é um analista financeiro sênior. Pesquise e liste as principais notícias, manchetes e eventos corporativos relacionados ao ticker "${symbol}" no período de ${fromDate} a ${toDate}.\n\nEstruture sua resposta em ordem cronológica com:\n- **Data** — Manchete/Evento\n- Breve contexto (1-2 frases) sobre o impacto no preço/mercado\n\nFoque em:\n1. Resultados trimestrais / balanços\n2. Mudanças regulatórias que afetem o ativo\n3. Notícias corporativas relevantes (M&A, guidance, downgrades/upgrades)\n4. Eventos de mercado que moveram o preço significativamente\n\nResponda em português brasileiro. Seja factual. Máximo 500 palavras.`,
                },
              ],
            },
          ],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Gemini news error [${res.status}]:`, errText);
      return { status: "error", message: `Erro ao buscar notícias para ${symbol}: HTTP ${res.status}`, symbol };
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
    console.error("Company news error:", err);
    return {
      status: "fetch_error",
      message: `Falha ao buscar notícias para ${symbol}`,
      symbol,
    };
  }
}

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!googleKey) {
      throw new Error("Missing GOOGLE_AI_API_KEY env var.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars.");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });

    const body = await req.json();
    const { query, messages: rawMessages, systemPrompt, geminiTools, session_id, active_portfolio, active_ticker, filter_type } = body;

    // Support both formats: { query: "..." } from Chat.tsx or { messages: [...] } from other callers
    let messages: any[];
    if (rawMessages && Array.isArray(rawMessages)) {
      messages = rawMessages;
    } else if (query) {
      messages = [{ role: "user", content: query }];
    } else {
      throw new Error("Missing messages or query in request.");
    }

    const claudeMessages = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : m.role,
      content: m.content,
    }));

    function toGeminiMessages(messages: any[]) {
      return messages.map((m: any) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));
    }

    const PRIMARY_MODEL = "gemini-2.5-flash";
    const FALLBACK_MODEL = "gemini-1.5-flash";

    const createGeminiResponse = async (messages: any[], model: string = PRIMARY_MODEL) => {
      const geminiMessages = toGeminiMessages(messages);
      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: geminiMessages,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: geminiTools,
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 4096,
            },
          }),
        },
      );
    };

    const createGeminiResponseWithFallback = async (messages: any[]) => {
      let response = await createGeminiResponse(messages, PRIMARY_MODEL);

      if (!response.ok) {
        const primaryErrorText = await response.text();
        const normalizedError = primaryErrorText.toLowerCase();

        if (response.status === 404 || normalizedError.includes("not found") || normalizedError.includes("no longer available")) {
          console.warn(`Primary model ${PRIMARY_MODEL} not available, falling back to ${FALLBACK_MODEL}`);
          response = await createGeminiResponse(messages, FALLBACK_MODEL);

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

    let initialRes = await createGeminiResponseWithFallback(claudeMessages);

    if (!initialRes.ok) {
      const errText = await initialRes.text();
      throw new Error(`Gemini error: ${errText}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let sources: any[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        const reader = initialRes.body!.getReader();
        let currentText = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            const chunkText = decoder.decode(value);
            currentText += chunkText;

            // Process SSE events
            let eventSeparator = currentText.indexOf("\n\n");
            while (eventSeparator > 0) {
              const event = currentText.substring(0, eventSeparator);
              currentText = currentText.substring(eventSeparator + 2);

              if (event.startsWith("data: ")) {
                const data = JSON.parse(event.substring(6));

                if (data.error) {
                  console.error("Gemini error in stream:", data.error);
                  controller.error(data.error);
                  return;
                }

                if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                  const geminiPart = data.candidates[0].content.parts[0];
                  if (geminiPart.text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: geminiPart.text })}\n\n`));
                  }
                }

                if (data.candidates && data.candidates[0].toolCalls) {
                  const toolCalls = data.candidates[0].toolCalls;
                  for (const toolCall of toolCalls) {
                    if (toolCall.functionCall) {
                      const { name, args } = toolCall.functionCall;

                      // Dispatch tool call and enqueue result
                      let toolResult: any = null;
                      switch (name) {
                        case "fetchLiveMarketData":
                          toolResult = await fetchLiveMarketData(args.ticker, args.isin);
                          break;
                        case "searchMacroMarketContext":
                          toolResult = await searchMacroMarketContext(args.query, googleKey);
                          if (toolResult?.sources) {
                            sources = sources.concat(toolResult.sources);
                          }
                          break;
                        case "getCompanyTickerNews":
                          toolResult = await getCompanyTickerNews(args.symbol, args.fromDate, args.toDate, googleKey);
                          if (toolResult?.sources) {
                            sources = sources.concat(toolResult.sources);
                          }
                          break;
                        default:
                          console.warn("Unknown tool call:", name);
                          toolResult = { status: "error", message: `Tool ${name} not implemented` };
                      }

                      const toolResultString = JSON.stringify(toolResult);
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tool_result", tool_call_id: toolCall.id, content: toolResultString })}\n\n`));
                    }
                  }
                }
              }

              eventSeparator = currentText.indexOf("\n\n");
            }

            // Handle continuation turns if needed
            if (currentText.includes("DONE")) {
              break;
            }

            if (currentText.includes("Continuation")) {
              let currentMessages = [...claudeMessages];
              const lastMessage = currentMessages[currentMessages.length - 1];
              if (lastMessage.role === "model") {
                lastMessage.content += " [CONT]";
              }
              currentMessages.push({ role: "user", content: "Continue" });

              currentResponse = await createGeminiResponseWithFallback(currentMessages);

              if (!currentResponse.ok) {
                const errText = await currentResponse.text();
                console.error("Continuation error:", errText);
                break;
              }
            }
          }

          // Send sources as final event
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
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
