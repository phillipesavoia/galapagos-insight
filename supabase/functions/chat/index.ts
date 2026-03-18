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
      const errText = await res.text();
      console.error(`Gemini search error [${res.status}]:`, errText);
      return { status: "error", message: `Erro na busca macro: HTTP ${res.status}`, query };
    }

    const data = await res.json();
    const textParts = data?.candidates?.[0]?.content?.parts || [];
    const textContent = textParts.filter((p: any) => p.text).map((p: any) => p.text).join("\n");

    const groundingMetadata = data?.candidates?.[0]?.groundingMetadata;
    const groundingSources =
      groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || "",
        url: c.web?.uri || "",
      })) || [];

    return { status: "success", query, analysis: textContent, sources: groundingSources };
  } catch (err) {
    console.error("Macro search error:", err);
    return { status: "fetch_error", message: `Falha na busca de contexto macro para: "${query}"`, query };
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
      const errText = await res.text();
      console.error(`Gemini news error [${res.status}]:`, errText);
      return { status: "error", message: `Erro ao buscar notícias para ${symbol}: HTTP ${res.status}`, symbol };
    }

    const data = await res.json();
    const textParts = data?.candidates?.[0]?.content?.parts || [];
    const textContent = textParts.filter((p: any) => p.text).map((p: any) => p.text).join("\n");

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
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars.");

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const {
      query,
      messages: rawMessages,
      systemPrompt: clientSystemPrompt,
      geminiTools,
      session_id,
      active_portfolio,
      active_ticker,
      filter_type,
    } = body;

    let messages: any[];
    if (rawMessages && Array.isArray(rawMessages)) {
      messages = rawMessages;
    } else if (query) {
      messages = [{ role: "user", content: query }];
    } else {
      throw new Error("Missing messages or query in request.");
    }

    // --- RAG: RESTAURANDO A BUSCA VETORIAL NOS DOCUMENTOS (PDFs) ---
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

    // Build holdings per portfolio
    const holdingsMap: Record<string, string[]> = {};
    for (const row of holdingsRes.data || []) {
      const key = row.portfolio_name;
      if (!holdingsMap[key]) holdingsMap[key] = [];
      const contrib =
        row.monthly_contribution != null
          ? ` | Contribuição: ${row.monthly_contribution >= 0 ? "+" : ""}${row.monthly_contribution.toFixed(2)}%`
          : "";
      const ytd =
        row.ytd_return != null ? ` | Retorno YTD: ${row.ytd_return >= 0 ? "+" : ""}${row.ytd_return.toFixed(2)}%` : "";
      const monthly =
        row.monthly_return != null
          ? ` | Retorno Mês: ${row.monthly_return >= 0 ? "+" : ""}${row.monthly_return.toFixed(2)}%`
          : "";
      holdingsMap[key].push(
        `${row.ticker || "N/A"} (${row.asset_name}) — ${row.asset_class}, Peso: ${row.weight_percentage}%${ytd}${monthly}${contrib}`,
      );
    }
    const holdingsText = Object.entries(holdingsMap)
      .map(([k, v]) => `  **${k}:**\n    ${v.join("\n    ")}`)
      .join("\n\n");

    // --- Build system prompt ---
    const GALAPAGOS_SYSTEM_PROMPT = `Você é o Advisor de IA da **Galapagos Capital** — um assistente de investimentos inteligente e profissional.

## IDENTIDADE
- Responda de forma técnica, clara e objetiva, como um gestor experiente.
- Responda SEMPRE em português brasileiro.
- Use Markdown para formatação. Tabelas quando comparar portfólios.

## DADOS DO BANCO DE DADOS (Tabelas de Portfólio)
### Alocação Macro:
${allocText}

### NAVs e Performance (Dados: ${latestDate}):
${navsText}

### Holdings Detalhados:
${holdingsText}

## CONHECIMENTO DOS DOCUMENTOS (PDFs, Lâminas e Manuais)
Leia atentamente os trechos extraídos dos nossos documentos abaixo para responder perguntas sobre teses, detalhes ou atribuições que não estão nas tabelas acima:
${documentContext ? documentContext : "Nenhum documento específico encontrado para esta consulta."}

## REGRAS
1. Baseie-se APENAS em "DADOS DO BANCO DE DADOS" e "CONHECIMENTO DOS DOCUMENTOS". Nunca invente ativos, pesos ou retornos.
2. Se o usuário pedir várias informações e você só tiver parte delas (ex: tem as posições e pesos, mas faltam os retornos), MOSTRE A TABELA COM O QUE TEM e preencha as colunas vazias com "N/A" ou "Indisponível". Não recuse a resposta inteira.
3. Sempre estruture listas de ativos, alocações e retornos em formato de Tabela Markdown clara e legível.
4. Redirecione para o Dashboard apenas se o usuário pedir dados em tempo real ou gráficos.

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