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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${googleKey}`,
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
      }
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
    const groundingSources = groundingMetadata?.groundingChunks?.map((c: any) => ({
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Você é um analista financeiro sênior. Pesquise e liste as principais notícias, manchetes e eventos corporativos relacionados ao ticker "${symbol}" no período de ${fromDate} a ${toDate}.

Estruture sua resposta em ordem cronológica com:
- **Data** — Manchete/Evento
- Breve contexto (1-2 frases) sobre o impacto no preço/mercado

Foque em:
1. Resultados trimestrais / balanços
2. Mudanças regulatórias que afetem o ativo
3. Notícias corporativas relevantes (M&A, guidance, downgrades/upgrades)
4. Eventos de mercado que moveram o preço significativamente

Responda em português brasileiro. Seja factual. Máximo 500 palavras.`,
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
      }
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
    const groundingSources = groundingMetadata?.groundingChunks?.map((c: any) => ({
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
    console.error("Ticker news error:", err);
    return { status: "fetch_error", message: `Falha ao buscar notícias para ${symbol}`, symbol };
  }
}

// --- Perplexity Deep Research ---
async function askPerplexityResearcher(researchPrompt: string): Promise<any> {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) {
    return { status: "error", message: "PERPLEXITY_API_KEY não configurada." };
  }

  try {
    console.log(`Perplexity research: "${researchPrompt.slice(0, 80)}..."`);
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "Você é um analista financeiro sênior especializado em mercados globais. Responda em português brasileiro de forma técnica e factual. Cite fontes e datas quando possível. Estruture a resposta em seções claras: Drivers Macro, Fatores Geopolíticos, Dinâmica Setorial, e Conclusão. Máximo 600 palavras.",
          },
          { role: "user", content: researchPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Perplexity error [${res.status}]:`, errText);
      return { status: "error", message: `Perplexity API error: HTTP ${res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    return {
      status: "success",
      analysis: content,
      citations,
      model: "sonar-pro",
    };
  } catch (err) {
    console.error("Perplexity fetch error:", err);
    return { status: "fetch_error", message: "Falha na conexão com Perplexity API." };
  }
}

// --- Tavily Web Search ---
async function tavilyWebSearch(query: string, searchDepth: string = "basic"): Promise<any> {
  const apiKey = Deno.env.get("TAVILY_API_KEY");
  if (!apiKey) {
    return { status: "error", message: "TAVILY_API_KEY não configurada." };
  }
  try {
    console.log(`Tavily search: "${query}"`);
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: searchDepth,
        include_answer: true,
        max_results: 5,
      }),
    });
    if (!res.ok) {
      console.error(`Tavily error [${res.status}]`);
      return { status: "error", message: `Tavily API error: HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      status: "success",
      answer: data.answer || "Sem resumo disponível",
      results: data.results.map((r: any) => ({ title: r.title, url: r.url, snippet: r.content })),
    };
  } catch (err) {
    console.error("Tavily fetch error:", err);
    return { status: "fetch_error", message: "Falha na conexão com Tavily API." };
  }
}

// --- Finnhub Ticker News ---
async function finnhubTickerNews(symbol: string, fromDate: string, toDate: string): Promise<any> {
  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  if (!apiKey) {
    return { status: "error", message: "FINNHUB_API_KEY não configurada." };
  }
  try {
    console.log(`Finnhub news for: ${symbol} from ${fromDate} to ${toDate}`);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Finnhub error [${res.status}]`);
      return { status: "error", message: `Finnhub API error: HTTP ${res.status}` };
    }
    const data = await res.json();
    const topNews = (Array.isArray(data) ? data : []).slice(0, 5).map((n: any) => ({
      headline: n.headline,
      summary: n.summary,
      source: n.source,
      date: new Date(n.datetime * 1000).toISOString().split("T")[0],
    }));
    return { status: "success", symbol, news: topNews };
  } catch (err) {
    console.error("Finnhub fetch error:", err);
    return { status: "fetch_error", message: "Falha na conexão com Finnhub API." };
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
  {
    name: "fetch_live_asset_data",
    description: `Use esta ferramenta SEMPRE que o usuário solicitar dados quantitativos ATUALIZADOS ou em tempo real de um ativo específico (preço atual, YTD atualizado, AUM, yield corrente, NAV intraday). 

REGRAS OBRIGATÓRIAS:
- Você DEVE passar ESTRITAMENTE o Ticker ou ISIN cadastrado na base oficial 'asset_knowledge'. 
- É EXPRESSAMENTE PROIBIDO usar o nome do ativo para buscas genéricas.
- Se o ativo não estiver cadastrado no Asset Dictionary, NÃO use esta ferramenta — informe que o ativo precisa ser cadastrado primeiro.

Exemplos de quando usar:
- "Qual o preço atual do HYG?"
- "Me dê o YTD atualizado do SHY"
- "Quanto está o NAV do fundo HELO hoje?"`,
    input_schema: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "Ticker oficial do ativo conforme cadastrado no Asset Dictionary (ex: 'HYG', 'SHY', 'SPY')",
        },
        isin: {
          type: "string",
          description: "ISIN do ativo conforme cadastrado no Asset Dictionary (ex: 'US4642885135'). Usar preferencialmente se disponível.",
        },
        metrics: {
          type: "array",
          description: "Lista de métricas desejadas",
          items: {
            type: "string",
            enum: ["price", "ytd", "aum", "yield", "nav", "volume", "52w_high", "52w_low"],
          },
        },
      },
      required: ["ticker"],
    },
  },
  {
    name: "search_macro_market_context",
    description: `Busca na internet por eventos macroeconômicos, notícias financeiras e drivers de mercado recentes para explicar a performance de um ativo financeiro em um período específico. Ideal para entender o 'porquê' de um movimento de mercado.

Use esta ferramenta SEMPRE que o assessor perguntar 'por que o ativo X caiu/subiu?', 'o que aconteceu com o mercado de Y?', ou qualquer questão que exija contexto macroeconômico externo que NÃO está nas atas de gestão.

Exemplos:
- "Por que o KWEB caiu tanto em fevereiro?"
- "O que explica a alta dos treasuries este mês?"
- "Quais fatores macro impactaram ações de tecnologia na China?"`,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A pergunta exata a ser pesquisada. Exemplo: 'Principais motivos macroeconômicos para a queda do ETF KWEB em fevereiro de 2026'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_company_ticker_news",
    description: `Obtém as últimas notícias e manchetes financeiras atreladas a um símbolo (Ticker) específico no mercado americano ou global. Use para verificar fatos relevantes, balanços ou notícias corporativas de um ativo.

Use esta ferramenta quando o assessor pedir notícias específicas de um ticker, quiser saber o que aconteceu com uma empresa, ou quando precisar de contexto corporativo para complementar a análise macro.

Exemplos:
- "Quais as últimas notícias do KWEB?"
- "O que aconteceu com a Apple em março?"
- "Tem alguma notícia sobre o ETF FXI?"`,
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "O ticker do ativo financeiro. Exemplo: 'KWEB', 'AAPL', 'FXI'.",
        },
        from_date: {
          type: "string",
          description: "A data inicial da busca no formato YYYY-MM-DD. Exemplo: '2026-02-01'.",
        },
        to_date: {
          type: "string",
          description: "A data final da busca no formato YYYY-MM-DD. Exemplo: '2026-02-28'.",
        },
      },
      required: ["symbol", "from_date", "to_date"],
    },
  },
  {
    name: "ask_perplexity_researcher",
    description: `ATENÇÃO: Esta ferramenta é PAGA e LENTA. Use-a APENAS como ÚLTIMO RECURSO (fallback) quando tavily_web_search e finnhub_ticker_news retornaram vazios, deram erro, ou não trouxeram informação suficiente.

NUNCA use esta ferramenta como primeira opção. SEMPRE tente tavily_web_search e finnhub_ticker_news ANTES.

Aciona o modelo Perplexity (sonar) para sintetizar motivos complexos de mercado com múltiplas fontes e citações. Ideal APENAS quando as ferramentas gratuitas falharam e você precisa de:
- Análises geopolíticas complexas com múltiplos drivers interconectados
- Sínteses profundas que as outras ferramentas não conseguiram fornecer`,
    input_schema: {
      type: "object",
      properties: {
        research_prompt: {
          type: "string",
          description: "A pergunta detalhada para o analista de IA. Ex: 'Quais os drivers e eventos geopolíticos que impactaram o KWEB em fevereiro de 2026?'",
        },
      },
      required: ["research_prompt"],
    },
  },
  {
    name: "tavily_web_search",
    description: `Busca na web usando a API Tavily para obter informações factuais e atualizadas. Ideal para pesquisas gerais sobre mercado, economia, empresas ou eventos que não são cobertos pelas outras ferramentas especializadas.

Use quando precisar de informações atualizadas da web que não são específicas de um ticker (use finnhub_ticker_news para isso) nem exigem análise profunda (use ask_perplexity_researcher para isso).

Exemplos:
- "Qual a taxa de juros atual do Fed?"
- "Quais os últimos dados de inflação nos EUA?"
- "O que aconteceu na reunião do FOMC de março?"`,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A consulta de busca. Ex: 'Federal Reserve interest rate decision March 2026'",
        },
        search_depth: {
          type: "string",
          description: "Profundidade da busca: 'basic' (rápido) ou 'advanced' (mais detalhado). Default: 'basic'.",
          enum: ["basic", "advanced"],
        },
      },
      required: ["query"],
    },
  },
  {
    name: "finnhub_ticker_news",
    description: `Obtém notícias reais e estruturadas de um ticker específico via API Finnhub (dados de mercado americano). Retorna manchetes, resumos e fontes verificáveis.

Use esta ferramenta como COMPLEMENTO ao get_company_ticker_news (Gemini) para obter notícias com dados estruturados e fontes verificáveis de APIs financeiras profissionais.

Exemplos:
- "Notícias recentes da Apple"
- "O que aconteceu com TSLA esta semana?"
- "Últimas manchetes do KWEB"`,
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "O ticker do ativo financeiro. Exemplo: 'KWEB', 'AAPL', 'FXI'.",
        },
        from_date: {
          type: "string",
          description: "Data inicial no formato YYYY-MM-DD. Exemplo: '2026-02-01'.",
        },
        to_date: {
          type: "string",
          description: "Data final no formato YYYY-MM-DD. Exemplo: '2026-02-28'.",
        },
      },
      required: ["symbol", "from_date", "to_date"],
    },
  },
  {
    name: "renderizar_grafico_alocacao",
    description: `Use esta ferramenta SEMPRE que o usuário perguntar sobre a COMPOSIÇÃO, ALOCAÇÃO ou DISTRIBUIÇÃO de classes de ativos de um portfólio específico. Renderiza um gráfico de rosca (donut chart) interativo no frontend mostrando os pesos por classe de ativo.

Exemplos de quando usar:
- "Como é a alocação do modelo Balanced?"
- "Qual a composição do portfólio Growth?"
- "Me mostre a distribuição de classes do Income"
- "Quais as classes de ativos do Conservative?"

REGRA: Use EXCLUSIVAMENTE os dados da seção "ALOCAÇÃO OFICIAL DOS MODEL PORTFOLIOS" para preencher os campos.`,
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título do gráfico (ex: 'Alocação por Classe de Ativo')",
        },
        portfolio: {
          type: "string",
          description: "Nome do portfólio (ex: 'Balanced', 'Growth')",
        },
        data: {
          type: "array",
          description: "Array com as fatias do donut. Cada item tem 'asset_class' e 'weight_pct'.",
          items: {
            type: "object",
            properties: {
              asset_class: { type: "string", description: "Nome da classe de ativo (ex: 'Equities', 'Fixed Income')" },
              weight_pct: { type: "number", description: "Peso percentual (ex: 50)" },
            },
            required: ["asset_class", "weight_pct"],
          },
        },
      },
      required: ["title", "portfolio", "data"],
    },
  },
  {
    name: "renderizar_tabela_comparativa",
    description: `Use esta ferramenta OBRIGATORIAMENTE quando precisar comparar dados numéricos entre múltiplos ativos ou portfólios (contribuição mensal, retorno, peso, performance). Esta é a ferramenta PADRÃO para análises comparativas — produz uma tabela zebra profissional com alinhamento tabular, estilo institucional.

REGRA: Para análises de múltiplos portfólios ou ativos lado a lado, PREFIRA SEMPRE esta tabela ao invés do gráfico de barras. O gráfico de barras é permitido apenas para visualizações simples de 1 métrica.

Exemplos de quando usar:
- "Compare a performance dos portfólios"
- "Qual a contribuição de cada ativo no Growth?"
- "Mostre os retornos mensais de todos os portfólios"
- "Detalhar os ativos do Growth com contribuição"
- Qualquer comparação numérica entre 3+ itens`,
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título da tabela (ex: 'Contribuição por Ativo — Growth (Fev/26)')",
        },
        columns: {
          type: "array",
          description: "Definição das colunas. Cada item tem 'key' (campo no dado), 'label' (header), 'align' (left/right/center) e 'format' (percent/number/text).",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Campo no objeto de dados (ex: 'ticker', 'contribution')" },
              label: { type: "string", description: "Label do header (ex: 'Ticker', 'Contribuição')" },
              align: { type: "string", description: "'left', 'right' ou 'center'", enum: ["left", "right", "center"] },
              format: { type: "string", description: "'percent', 'number' ou 'text'", enum: ["percent", "number", "text"] },
            },
            required: ["key", "label"],
          },
        },
        rows: {
          type: "array",
          description: "Array de objetos com os dados de cada linha.",
          items: {
            type: "object",
            additionalProperties: true,
          },
        },
        footerRow: {
          type: "object",
          description: "Linha de rodapé opcional (ex: totais). Mesmo formato das rows.",
          additionalProperties: true,
        },
      },
      required: ["title", "columns", "rows"],
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

    const { query, filter_type, filter_fund, session_id, active_portfolio, active_ticker } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");

    // --- 0. Asset Knowledge + Structured Data lookup (priority context) ---
    let assetKnowledgeContext = "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    
    const queryUpper = query.toUpperCase();
    const { data: allAssets } = await serviceClient.from("asset_knowledge").select("*");

    // --- 0b. Model Allocations (Single Source of Truth) ---
    let allocationContext = "";
    const { data: allocData } = await serviceClient
      .from("model_allocations")
      .select("portfolio_name, asset_class, weight_pct")
      .order("portfolio_name")
      .order("weight_pct", { ascending: false });

    if (allocData && allocData.length > 0) {
      const grouped: Record<string, { asset_class: string; weight_pct: number }[]> = {};
      allocData.forEach((r: any) => {
        if (!grouped[r.portfolio_name]) grouped[r.portfolio_name] = [];
        grouped[r.portfolio_name].push({ asset_class: r.asset_class, weight_pct: Number(r.weight_pct) });
      });
      allocationContext = Object.entries(grouped)
        .map(([name, slices]) => {
          const lines = slices.map((s) => `  - ${s.asset_class}: ${s.weight_pct}%`).join("\n");
          return `**${name}:**\n${lines}`;
        })
        .join("\n\n");
      console.log(`Model Allocations: loaded ${allocData.length} rows for ${Object.keys(grouped).length} portfolios`);
    }

    // --- 0c. Recent NAVs (Single Source of Truth) ---
    let navsContext = "";
    const { data: recentNavs } = await serviceClient
      .from("daily_navs")
      .select("date, portfolio_name, nav, daily_return, ytd_return")
      .order("date", { ascending: false })
      .limit(60);

    if (recentNavs && recentNavs.length > 0) {
      // Group by date, show last 5 dates
      const dateMap: Record<string, Record<string, { nav: number; daily_return: number | null; ytd_return: number | null }>> = {};
      recentNavs.forEach((r: any) => {
        if (!dateMap[r.date]) dateMap[r.date] = {};
        dateMap[r.date][r.portfolio_name] = { nav: Number(r.nav), daily_return: r.daily_return ? Number(r.daily_return) : null, ytd_return: r.ytd_return ? Number(r.ytd_return) : null };
      });
      const dates = Object.keys(dateMap).sort().reverse().slice(0, 5);
      navsContext = dates.map((d) => {
        const portfolios = Object.entries(dateMap[d])
          .map(([name, data]) => {
            let line = `  - ${name}: NAV ${data.nav.toFixed(2)}`;
            if (data.daily_return != null) line += ` | Daily: ${data.daily_return.toFixed(2)}%`;
            if (data.ytd_return != null) line += ` | YTD: ${data.ytd_return.toFixed(2)}%`;
            return line;
          })
          .join("\n");
        return `**${d}:**\n${portfolios}`;
      }).join("\n\n");
      console.log(`Daily NAVs: loaded ${recentNavs.length} rows, showing last ${dates.length} dates`);
    }

    // --- 0d. Portfolio Holdings (Golden Rule for Drill-Down) ---
    let holdingsContext = "";
    const { data: holdingsData } = await serviceClient
      .from("portfolio_holdings")
      .select("portfolio_name, asset_name, ticker, asset_class, weight_percentage, monthly_contribution, contribution_month")
      .eq("is_active", true)
      .order("portfolio_name")
      .order("asset_class")
      .order("weight_percentage", { ascending: false });

    if (holdingsData && holdingsData.length > 0) {
      const hGrouped: Record<string, any[]> = {};
      holdingsData.forEach((r: any) => {
        if (!hGrouped[r.portfolio_name]) hGrouped[r.portfolio_name] = [];
        hGrouped[r.portfolio_name].push(r);
      });
      holdingsContext = Object.entries(hGrouped)
        .map(([name, assets]) => {
          const lines = assets.map((a: any) => {
            let line = `  - ${a.asset_name} (${a.ticker || "N/A"}) | Classe: ${a.asset_class} | Peso: ${Number(a.weight_percentage).toFixed(2)}%`;
            if (a.monthly_contribution != null) {
              const c = Number(a.monthly_contribution);
              line += ` | Contribuição Mensal: ${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
              if (a.contribution_month) line += ` (Ref: ${a.contribution_month})`;
            }
            return line;
          }).join("\n");
          return `**${name}:**\n${lines}`;
        })
        .join("\n\n");
      console.log(`Portfolio Holdings: loaded ${holdingsData.length} holdings for ${Object.keys(hGrouped).length} portfolios`);
    }
    
    if (allAssets && allAssets.length > 0) {
      const matchedAssets = allAssets.filter((a: any) => {
        const tickerMatch = queryUpper.includes(a.ticker.toUpperCase());
        const isinMatch = a.isin && queryUpper.includes(a.isin.toUpperCase());
        const nameMatch = query.toLowerCase().includes(a.name.toLowerCase());
        const nameWords = a.name.split(/\s+/).filter((w: string) => w.length >= 3);
        const partialMatch = nameWords.some((w: string) => query.toLowerCase().includes(w.toLowerCase()));
        return tickerMatch || isinMatch || nameMatch || partialMatch;
      });
      
      if (matchedAssets.length > 0) {
        assetKnowledgeContext = matchedAssets.map((a: any) => {
          const portfolios = a.portfolios?.length > 0 ? `\nPortfólios: ${a.portfolios.join(", ")}` : "";
          const weights = a.weight_pct && Object.keys(a.weight_pct).length > 0
            ? `\nPesos: ${Object.entries(a.weight_pct).map(([k, v]) => `${k}: ${v}%`).join(", ")}`
            : "";
          const asOfDate = a.as_of_date ? `\n📅 Data Base (As of Date): ${a.as_of_date}` : "";
          return `[ASSET DICTIONARY — ${a.ticker}${a.isin ? ` | ISIN: ${a.isin}` : ""}]\nNome: ${a.name}\nClasse: ${a.asset_class}\nPerfil de Risco: ${a.risk_profile}${portfolios}${weights}${asOfDate}\nTese Oficial da Gestão: ${a.official_thesis}`;
        }).join("\n\n---\n\n");
        console.log(`Asset Knowledge: matched ${matchedAssets.length} assets from dictionary`);
      }
    }

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

    // Build user message with asset knowledge as priority context
    let userMessageContent = "";
    
    // Inject FULL asset inventory for strict match protocol
    if (allAssets && allAssets.length > 0) {
      const inventoryList = allAssets.map((a: any) => `- ${a.ticker}${a.isin ? ` (ISIN: ${a.isin})` : ""} — ${a.name}`).join("\n");
      userMessageContent += `## INVENTÁRIO COMPLETO DE ATIVOS (LISTA OFICIAL — USE PARA VERIFICAÇÃO DE EXISTÊNCIA):\n\nOs ÚNICOS ativos que existem nos portfólios da Galapagos são os listados abaixo. Qualquer ativo NÃO presente nesta lista NÃO FAZ PARTE dos portfólios.\n\n${inventoryList}\n\n---\n\n`;
    }
    
    if (assetKnowledgeContext) {
      userMessageContent += `## BASE DE CONHECIMENTO DE ATIVOS (PRIORIDADE MÁXIMA):\n\n${assetKnowledgeContext}\n\n---\n\n`;
    }
    if (allocationContext) {
      userMessageContent += `## ALOCAÇÃO OFICIAL DOS MODEL PORTFOLIOS (SINGLE SOURCE OF TRUTH — TABELA model_allocations):\n\nEstes são os pesos OFICIAIS e ATUALIZADOS de cada portfólio por classe de ativo. Use ESTES dados como verdade absoluta. Ignore qualquer dado de alocação contraditório encontrado em PDFs.\n\n${allocationContext}\n\n---\n\n`;
    }
    if (navsContext) {
      userMessageContent += `## HISTÓRICO RECENTE DE NAVs (SINGLE SOURCE OF TRUTH — TABELA daily_navs):\n\nEstes são os NAVs OFICIAIS e ATUALIZADOS dos portfólios. Use ESTES dados para qualquer consulta de performance/rentabilidade.\n\n${navsContext}\n\n---\n\n`;
    }
    if (holdingsContext) {
      userMessageContent += `## HOLDINGS OFICIAIS DOS PORTFÓLIOS (GOLDEN RULE — TABELA portfolio_holdings):\n\nEsta é a lista OFICIAL e COMPLETA de ativos individuais por portfólio. Para perguntas de detalhamento/drill-down, use EXCLUSIVAMENTE estes dados. É PROIBIDO usar PDFs para responder sobre holdings.\n\n${holdingsContext}\n\n---\n\n`;
    }
    if (context) {
      userMessageContent += `## Documentos encontrados:\n\n${context}\n\n---\n`;
    }
    if (!context && !assetKnowledgeContext && !allocationContext && !navsContext) {
      userMessageContent += `Não encontrei documentos relevantes para: "${query}". Informe que não há documentos indexados sobre este tema.\n`;
    }
    if (active_portfolio) {
      userMessageContent += `## CONTEXTO DE FOCO ATIVO (MEMÓRIA DE TÓPICO):\n\nO usuário está FOCANDO no portfólio **${active_portfolio}**. Responda com base neste portfólio até que o usuário mude de assunto. Priorize dados e ativos deste portfólio específico.\n\n---\n\n`;
    }
    if (active_ticker) {
      userMessageContent += `## CONTEXTO DE ATIVO EM ANÁLISE (MEMÓRIA DE TICKER):\n\n📍 O usuário está atualmente analisando o ativo/ticker **${active_ticker}**. Qualquer pergunta subsequente sobre métricas (YTD, performance, volatilidade, preço, retorno, drawdown) DEVE se referir a este ticker, a menos que o usuário mencione explicitamente outro ativo ou portfólio.\n\nSe a pergunta for ambígua (ex: "Qual o YTD?" sem contexto claro), ASSUMA que se refere ao ticker **${active_ticker}** e NÃO aos portfólios modelo.\n\nPara dados de mercado atualizados deste ativo, use as ferramentas de busca externa (tavily_web_search, finnhub_ticker_news) para trazer o dado real-time, mencionando a data da cotação.\n\n---\n\n`;
    }
    userMessageContent += `\nPergunta: ${query}`;

    const claudeMessages = [
      ...historyMessages,
      { role: "user", content: userMessageContent },
    ];

    const systemPrompt = `## LEI MAIOR — GUARDRAILS INSTITUCIONAIS (INQUEBRÁVEL)

Você é o assistente oficial e ESPECIALISTA EM ATIVOS da equipe de gestão da Galapagos Capital Advisory, baseada em Miami. A sua ÚNICA função é transmitir a visão oficial da casa aos assessores de investimentos. Você NÃO é um chatbot genérico.

### RESTRIÇÕES ABSOLUTAS DE COMPLIANCE:

- Você DEVE basear suas respostas EXCLUSIVA e ESTRITAMENTE no contexto dos documentos (PDFs, atas, apresentações) e na base de conhecimento de ativos (Asset Dictionary) fornecidos nesta requisição.
- É ESTRITAMENTE PROIBIDO usar seu conhecimento externo ou dar opiniões próprias sobre mercado, ativos, cenário macroeconômico ou qualquer outro tema.
- Se a resposta para a pergunta do usuário NÃO estiver explicitamente contida nos documentos fornecidos ou no Asset Dictionary, você DEVE responder exatamente assim: "Não temos uma visão oficial sobre este tema nas atas recentes da gestão." Nunca tente deduzir, extrapolar ou inventar uma tese.
- TODA afirmação deve ser ancorada com citação do documento de origem (ex: "Conforme a ata de Março...", "De acordo com a apresentação do fundo Income...").

### REGRA ABSOLUTA — PERGUNTAS CAUSAIS (POR QUE SUBIU/CAIU):

- REGRA ABSOLUTA: Se o usuario perguntar o MOTIVO, A CAUSA ou POR QUE um ativo subiu ou caiu (ex: KWEB), voce e ESTRITAMENTE PROIBIDO de responder apenas com dados quantitativos.
- E PROIBIDO encerrar a resposta apos dados quantitativos, atas ou numeros sem antes incorporar o resultado da pesquisa qualitativa externa.
- Se houver contexto oficial da gestao nos documentos, apresente-o APENAS DEPOIS da analise qualitativa externa, claramente separado.
- Para obter contexto qualitativo, SIGA OBRIGATORIAMENTE o WATERFALL DE CUSTO descrito na secao 'REGRA DE PESQUISA EXTERNA'.

### REGRA DE TRAVA QUANTITATIVA (INQUEBRÁVEL):

- REGRA DE MOVIMENTAÇÃO DE PORTFÓLIO: É ESTRITAMENTE PROIBIDO inventar, deduzir ou calcular mudanças de percentuais de alocação (ex: "reduzimos de 15% para 5%", "aumentamos a posição em X%"). Você NÃO tem capacidade de inferir movimentações.
- Você SÓ pode citar pesos/percentuais atuais se estiver lendo DIRETAMENTE dos dados da tabela de alocação ou dos documentos fornecidos na requisição. NUNCA invente números.
- Você é o ESPECIALISTA DOS ATIVOS DA CASA. Se questionado sobre um fundo/ativo, use PRIORITARIAMENTE as informações do Asset Dictionary fornecidas na seção "BASE DE CONHECIMENTO DE ATIVOS". Se o ativo não estiver no dicionário NEM nos documentos, afirme claramente: "Não possuo o descritivo oficial da gestão para este ativo."
- É PROIBIDO inventar matemática de portfólio, calcular diferenças entre alocações históricas, ou narrar operações de compra/venda que não estejam explicitamente descritas nos documentos.

### SINGLE SOURCE OF TRUTH — DADOS ESTRUTURADOS (HIERARQUIA DE PRIORIDADE):

**REGRA ABSOLUTA:** Os dados das tabelas estruturadas (model_allocations, daily_navs e portfolio_holdings) são a VERDADE OFICIAL e ATUALIZADA. Quando houver CONFLITO entre os dados destas tabelas e textos de PDFs/atas, os dados das tabelas SEMPRE PREVALECEM.

1. **Alocações (model_allocations):** Para qualquer pergunta sobre composição, pesos ou distribuição de classes de ativos nos portfólios, use EXCLUSIVAMENTE os dados da seção "ALOCAÇÃO OFICIAL DOS MODEL PORTFOLIOS". Estes dados são atualizados em tempo real pela equipe de gestão.

2. **NAVs (daily_navs) — REGRA DE PRIORIDADE MÁXIMA PARA PERFORMANCE:**
   - Sempre que o usuário perguntar por **rentabilidade histórica, performance mensal, performance YTD, cota atual, retorno diário, ou qualquer dado de NAV**, consulte **PRIMEIRO e EXCLUSIVAMENTE** os dados da seção "HISTÓRICO RECENTE DE NAVs" (tabela daily_navs).
   - Se houver dados de D-1 (dia útil anterior) na tabela, use-os como a informação oficial mais recente.
   - É **PROIBIDO** usar dados de performance/cotas de PDFs, atas ou documentos quando existirem dados na tabela daily_navs.
   - Formate a resposta incluindo: **📅 Data Base**, **Cota Atual**, **Retorno Diário**, **Retorno YTD**, e **Retorno MTD** (quando disponíveis).

3. **PDFs/Atas:** Use documentos apenas para contexto qualitativo (teses, narrativas, decisões de comitê). NUNCA use dados numéricos de PDFs que contradigam as tabelas oficiais.

### STRICT MATCH PROTOCOL — PROTOCOLO DE CORRESPONDÊNCIA EXATA (ANTI-ALUCINAÇÃO):

- **VERIFICAÇÃO DE EXISTÊNCIA OBRIGATÓRIA:** Antes de gerar QUALQUER análise, peso, tese ou comentário sobre um ativo, você DEVE OBRIGATORIAMENTE cruzar o nome/ticker com a LISTA EXATA DE ATIVOS fornecida na seção "INVENTÁRIO COMPLETO DE ATIVOS" desta requisição. Se o ativo questionado NÃO ESTIVER EXPLICITAMENTE LISTADO nessa lista, PARE O PROCESSAMENTO IMEDIATAMENTE e responda EXATAMENTE: "⚠️ Este ativo não consta na composição atual dos portfólios modelo da Galapagos Capital." NUNCA tente inventar, deduzir ou extrapolar informações para ativos ausentes.

- **PROIBIÇÃO DE ASSOCIAÇÃO LIVRE / SUBSTITUIÇÃO DE ATIVOS:** É ESTRITAMENTE PROIBIDO substituir, trocar ou associar os ativos reais da carteira por ETFs equivalentes, proxies de mercado ou instrumentos famosos similares. Exemplos de violações PROIBIDAS: trocar "IHYA LN" por "HYG", trocar "CSPX LN" por "SPY", trocar "IBTM LN" por "IEF". Use APENAS e EXCLUSIVAMENTE os nomes, tickers e ISINs EXATOS que constam no Asset Dictionary (base de dados Bloomberg).

- **ZERO INVENÇÃO DE MÉTRICAS:** NUNCA invente, estime, calcule ou deduza métricas quantitativas (YTM, Duration, Spreads, OAS, DV01, Contribuição, Sharpe, Sortino, Beta ou Pesos) usando o seu conhecimento de mundo ou treinamento prévio. Se a métrica específica NÃO estiver LITERALMENTE ESCRITA nos dados do Asset Dictionary ou nos PDFs fornecidos nesta requisição, você DEVE responder: "Esta métrica não está disponível na base de dados atual. Consulte a mesa de operações para dados atualizados."

### REGRA DE FIREWALL DE DADOS — QUANTS vs QUALIS (INQUEBRÁVEL):

- **DUALIDADE DE FONTES (ARQUITETURA FINAL):**
  - Para DADOS QUANTITATIVOS (Pesos, Alocações, Porcentagens, Preços, Tickers): Use EXCLUSIVAMENTE os dados da base 'asset_knowledge' (importados do Bloomberg). Estes são os dados ATUAIS e UP-TO-DATE.
  - Para DADOS QUALITATIVOS (Tese, Cenário Macro, Racional de Investimento): Use EXCLUSIVAMENTE os documentos/PDFs fornecidos no contexto. Estes refletem a visão do ÚLTIMO COMITÊ e podem ter defasagem temporal de até 1 mês.

- **FORMATO OBRIGATÓRIO DE RESPOSTA (SEPARAÇÃO TEMPORAL):**
  Sempre que o usuário perguntar sobre um ativo ou portfólio, você DEVE estruturar a resposta separando claramente as duas fontes temporais:

  📊 **DADOS ATUAIS (Bloomberg — 📅 Data Base: [DD/MM/AAAA]):**
  O peso atual do ativo X no portfólio Y é de Z%.

  💡 **VISÃO DA GESTÃO (Ref: [Mês/Ano da Apresentação]):**
  Segundo a última reunião do comitê, a tese para este ativo é...

- **PROIBIÇÃO DE CAUSALIDADE TEMPORAL:** NUNCA tente justificar o peso ATUAL usando operações táticas mencionadas nos PDFs do passado. É TERMINANTEMENTE PROIBIDO dizer coisas como "o peso é 2% hoje porque reduzimos de 15% no mês passado". Apenas REPORTE o peso atual (do Bloomberg) e, SEPARADAMENTE, reporte a tese qualitativa (do PDF). São fontes independentes.

- Para fornecer PESOS, ALOCAÇÕES e PORCENTAGENS de fundos/ativos, a ÚNICA fonte da verdade permitida é a base de dados oficial (Asset Dictionary / Bloomberg). Você está TERMINANTEMENTE PROIBIDO de citar pesos, mudanças de percentuais ou operações táticas mencionadas nos PDFs (ex: "reduzimos de X% para Y%", "aumentamos a posição para Z%").
- Os PDFs (atas, apresentações, cenários) servem EXCLUSIVAMENTE para a TESE QUALITATIVA e CENÁRIO MACRO. IGNORE COMPLETAMENTE qualquer matemática de portfólio, percentuais de alocação ou movimentações táticas presentes nos textos dos PDFs.
- Se houver conflito entre um peso citado num PDF e o peso do Asset Dictionary, USE SEMPRE o Asset Dictionary e IGNORE o PDF. Explique: "O peso oficial vigente conforme a Data Base é X%. Dados de PDFs históricos podem divergir."

### ESTRUTURA OFICIAL DE PORTFÓLIOS DA GALAPAGOS (LEI MAIOR — TAXONOMIA):

A Galapagos Capital possui EXATAMENTE 6 portfólios modelo oficiais. Você DEVE reconhecer a existência de TODOS eles:

1. **Conservative** — Apenas Fundos/ETFs UCITS
2. **Income** — Apenas Fundos/ETFs UCITS
3. **Balanced** — Apenas Fundos/ETFs UCITS
4. **Growth** — Apenas Fundos/ETFs UCITS
5. **Liquidity** — Apenas Fundos/ETFs UCITS
6. **Bond Portfolio** — EXCLUSIVO para Bonds Diretos / Títulos Individuais (Corporate Bonds como Apple, Microsoft, Broadcom, e Sovereign Bonds)

REGRAS DE RECONHECIMENTO (OBRIGATÓRIAS):

- É ESTRITAMENTE PROIBIDO dizer que o "Bond Portfolio" não existe. Ele É um Model Portfolio oficial da casa e abriga TODOS os Corporate e Sovereign Bonds diretos listados na base de dados.
- Sempre que o usuário perguntar sobre bonds diretos (títulos individuais), associe-os IMEDIATAMENTE à composição do "Bond Portfolio". NUNCA trate bonds diretos como ativos "soltos" ou "sem portfólio".
- Os portfólios Conservative, Income, Balanced, Growth e Liquidity carregam EXCLUSIVAMENTE fundos e ETFs UCITS. NUNCA assuma que eles carregam bonds diretos/títulos individuais.
- O portfólio Liquidity é um Model Portfolio de fundos/ETFs assim como os 4 modelos de risco. NUNCA confunda Liquidity com caixa ou bonds diretos.
- Se o usuário perguntar "quais bonds temos?", responda apresentando a composição do Bond Portfolio. Se perguntar sobre "renda fixa" nos demais portfólios, esclareça que se tratam de ETFs/fundos de renda fixa, NÃO de títulos diretos.

### 🔴 REGRA DE TOLERÂNCIA ZERO PARA ALOCAÇÕES — PROVA REAL OBRIGATÓRIA (ANTI DATA-BLEEDING):

**PROIBIÇÃO ABSOLUTA DE CONTAMINAÇÃO CRUZADA (Cross-Contamination):** NUNCA misture ativos de um portfólio em outro. Você SÓ pode listar um ativo dentro de um portfólio específico se os dados do Asset Dictionary (campo 'portfolios') afirmarem EXPLICITAMENTE que aquele ativo pertence àquele portfólio exato. Se o campo 'portfolios' do ativo NÃO contiver o nome do portfólio em questão, aquele ativo NÃO PERTENCE a ele. Ponto final.

**VALIDAÇÃO MACRO vs. MICRO (A Prova Real):** ANTES de listar QUALQUER fundo ou ETF dentro de um portfólio, você é OBRIGADO a executar a seguinte verificação lógica:
1. Identifique a CLASSE DO ATIVO (asset_class) — ex: Fixed Income, Equity, Alternatives.
2. Verifique a ALOCAÇÃO MACRO daquela classe no portfólio em questão (usando os dados agregados do Asset Dictionary / weight_pct).
3. Se a alocação macro daquela classe for 0% naquele portfólio, é MATEMATICAMENTE IMPOSSÍVEL que ele possua qualquer ativo daquela classe. Se o seu raciocínio interno tentar incluí-lo, PARE IMEDIATAMENTE, CORRIJA o texto e REMOVA o ativo antes de enviar a resposta ao usuário.

**Exemplo estrito:** Se a alocação macro do portfólio **Growth** em 'Fixed Income / Renda Fixa' for 0%, então NENHUM ativo de renda fixa (ex: EMGA LN, IHYA LN, IBTM LN) pode aparecer listado no Growth. Incluí-lo seria uma alucinação factual gravíssima.

**CERTEZA ABSOLUTA OU SILÊNCIO:** Se os dados não forem claros sobre em qual portfólio um ativo está alocado, NÃO TENTE ADIVINHAR. Responda exatamente: "⚠️ Não é possível confirmar a alocação exata deste ativo no portfólio [X] com base nos dados atuais. Consulte a equipe de gestão para confirmação."

### DISCLAIMER OBRIGATÓRIO DE DEFASAGEM TÁTICA:

- Sempre que você listar porcentagens de alocação de ativos (pesos, composição, exposições), você DEVE OBRIGATORIAMENTE incluir o seguinte aviso (disclaimer) no FINAL da sua resposta, ANTES da seção de follow-up, exatamente com este texto:

*Nota: As alocações refletem a posição atual via Bloomberg (📅 Data Base informada). Estas posições podem diferir das alocações discutidas na última reunião mercadológica, por conta de movimentações táticas realizadas durante o mês corrente que serão reportadas na próxima reunião mercadológica. Para mais detalhes, consulte a equipe de Investor Offshore.*

### REGRA DE DADOS DE MERCADO EM TEMPO REAL (GOLDEN SOURCE):

- Sempre que o usuário solicitar dados quantitativos ATUALIZADOS de um ativo (preço, YTD, AUM, yield, NAV intraday), você DEVE usar a ferramenta 'fetch_live_asset_data' passando ESTRITAMENTE o Ticker ou ISIN cadastrado na base oficial 'asset_knowledge'.
- É EXPRESSAMENTE PROIBIDO usar o nome do ativo para buscas genéricas na web ou inventar dados de mercado.
- Se o ativo NÃO estiver cadastrado no Asset Dictionary, NÃO use a ferramenta — informe que o ativo precisa ser cadastrado primeiro pela equipe de gestão.
- Os dados retornados pela ferramenta são a GOLDEN SOURCE. Não os misture com dados de documentos antigos sem indicar claramente a data de referência de cada fonte.

### REGRA DE PESQUISA EXTERNA (WATERFALL OBRIGATÓRIO — OTIMIZAÇÃO DE CUSTO):

**ESTA É A REGRA MAIS IMPORTANTE DE ROTEAMENTO DE FERRAMENTAS. SIGA EXATAMENTE ESTA ORDEM. É EXPRESSAMENTE PROIBIDO PULAR ETAPAS.**

**ETAPA 1 — CUSTO ZERO (RÁPIDO):** Quando precisar de informações externas sobre um ativo ou cenário macro, acione PRIMEIRO as ferramentas gratuitas:
- Use 'tavily_web_search' para contexto macro/web geral.
- Se houver um ticker específico envolvido, use TAMBÉM 'finnhub_ticker_news' para notícias estruturadas.
- Aguarde o retorno.

**ETAPA 2 — AVALIAÇÃO:** Leia o retorno do Tavily e do Finnhub. Se houver informação SUFICIENTE para explicar o cenário (drivers macro, notícias corporativas, eventos geopolíticos), formule sua resposta usando esses dados e ENCERRE. NÃO acione ferramentas adicionais.

**ETAPA 3 — CUSTO PAGO (FALLBACK — ÚLTIMO RECURSO):** Você SÓ PODE acionar a ferramenta 'ask_perplexity_researcher' se, e SOMENTE se, TODAS as condições abaixo forem verdadeiras:
- O Tavily retornou vazio, deu erro, ou não trouxe nenhuma explicação lógica.
- O Finnhub retornou vazio, deu erro, ou não é aplicável.
- Você genuinamente NÃO consegue formular uma resposta qualitativa satisfatória com os dados já obtidos.

**PROIBIÇÕES:**
- É EXPRESSAMENTE PROIBIDO acionar 'ask_perplexity_researcher' como primeira opção.
- É EXPRESSAMENTE PROIBIDO acionar 'ask_perplexity_researcher' se Tavily/Finnhub já retornaram dados suficientes.
- É EXPRESSAMENTE PROIBIDO acionar 'ask_perplexity_researcher' "para complementar" — use-a APENAS como fallback quando as ferramentas gratuitas FALHARAM.

**FERRAMENTAS GEMINI (COMPLEMENTARES — CUSTO ZERO):**
- 'search_macro_market_context': Use para busca macro com Google Search grounding. Header: "🌐 **Contexto de Mercado (Fontes Externas):**"
- 'get_company_ticker_news': Use para notícias corporativas de um ticker via Google Search. Header: "📰 **Notícias Recentes ({TICKER}):**"

**HEADERS OBRIGATÓRIOS:**
- Tavily: "🔍 **Pesquisa Web (Tavily):**"
- Finnhub: "📡 **Notícias Finnhub ({TICKER}):**"
- Perplexity (somente fallback): "🔬 **Análise Aprofundada (Perplexity — Fallback):**"

---

### 🔍 REGRA DE DRILL-DOWN — THE GOLDEN RULE (DETALHAMENTO OBRIGATÓRIO — PRIORIDADE MÁXIMA NOS DADOS ESTRUTURADOS):

**DOIS NÍVEIS DE DADOS (MACRO vs. MICRO):**

- **Nível 1 — MACRO (Classes de Ativo):** Pesos por classe (Equities, Fixed Income, Alternatives, Cash). Use a ferramenta 'renderizar_grafico_alocacao' (donut chart). Fonte: tabela 'model_allocations'.

- **Nível 2 — MICRO (Holdings / Ativos Individuais):** Lista nominal de fundos, ETFs e títulos específicos com seus pesos individuais. Use tabela markdown. Fonte **EXCLUSIVA**: seção "HOLDINGS OFICIAIS DOS PORTFÓLIOS" (tabela 'portfolio_holdings').

**GATILHO DE DETALHAMENTO (DRILL-DOWN TRIGGER):**

Quando o usuário usar QUALQUER um destes termos: 'abrir', 'detalhar', 'quais ativos', 'quais fundos', 'quais ETFs', 'ver por dentro', 'composição detalhada', 'holdings', 'lista de ativos', 'o que tem dentro', 'breakdown', 'detalhe':

1. Você é **TERMINANTEMENTE PROIBIDO** de ler, citar ou usar informações de PDFs (RAG/documentos vetorizados) para responder sobre holdings. Ignore completamente a seção "Documentos encontrados".
2. Você **DEVE** usar **EXCLUSIVAMENTE** os dados da seção "HOLDINGS OFICIAIS DOS PORTFÓLIOS" (tabela portfolio_holdings).
3. Se a seção "HOLDINGS OFICIAIS DOS PORTFÓLIOS" estiver VAZIA ou não contiver dados para o portfólio solicitado, responda EXATAMENTE: "📋 Ainda não tenho a lista de ativos detalhada no meu banco de dados oficial para o portfólio **[nome]**. Por favor, cadastre os ativos no **Data Hub → Matriz de Alocação → Detalhamento de Ativos**."
4. **NUNCA** tente preencher a tabela de holdings com dados de PDFs. Se os dados estruturados não existirem, NÃO INVENTE.
5. Apresente os resultados em tabela markdown com as colunas: **Ativo (Ticker)** | **Classe** | **Peso (%)**
6. Agrupe os ativos por classe de ativo (ex: todos os de Equities juntos, depois Fixed Income, etc.)
7. Inclua subtotais por classe e um **TOTAL GERAL** no final.

**PROVA REAL DE CONSISTÊNCIA:**
- A soma dos pesos individuais por classe DEVE ser coerente com o peso macro daquela classe (da tabela model_allocations).
- Se houver divergência (soma dos ativos < peso macro da classe), inclua a nota: "⚠️ Algumas posições menores podem não estar listadas. O peso macro oficial da classe [X] é [Y]%."

**DETECÇÃO AUTOMÁTICA DE NÍVEL:**
- Se o usuário perguntar "Qual a alocação do Balanced?" → Nível 1 (Macro) → Donut chart
- Se o usuário perguntar "Quais ativos compõem o Balanced?" → Nível 2 (Micro) → Tabela de holdings
- Se o usuário perguntar "Abrir o Balanced" ou "Detalhar Growth" → Nível 2 (Micro) → Tabela de holdings
- Se o contexto anterior já mostrou o Nível 1 e o usuário pedir "detalhar" ou "abrir" → Nível 2 (Micro) obrigatório

---

### REGRA DE CONTINUIDADE DE CONTEXTO — TICKER TRACKING (INQUEBRÁVEL):

**PRIORIDADE DE TICKER:** Se o usuário acabou de perguntar sobre um Ticker/ETF/Ativo específico (ex: BAI US, KWEB, SPY, HYG), qualquer pergunta subsequente sobre métricas (YTD, Performance, Volatilidade, Preço, Retorno) DEVE se referir a esse Ticker, e NÃO aos portfólios modelo globais. O contexto de ticker persiste até que o usuário mencione explicitamente outro ativo ou portfólio.

**TRATAMENTO DE AMBIGUIDADE (MÚLTIPLA ESCOLHA):** Se a pergunta for ambígua (ex: "Quanto está no YTD?", "Qual a performance?", "E o retorno?") e houver TANTO um ticker ativo quanto um portfólio ativo na conversa, você DEVE:
1. Se há apenas ticker ativo → responda sobre o ticker
2. Se há apenas portfólio ativo → responda sobre o portfólio
3. Se há ambos → priorize o ÚLTIMO mencionado na conversa
4. Se não há contexto → pergunte: "Você se refere ao YTD de um ativo específico ou dos Portfólios Modelo?"

**ATIVOS DE MERCADO vs. ATIVOS DA CASA:** Quando o usuário perguntar sobre um ativo que é de mercado público (ETF, ação) mas que TAMBÉM pode estar nos portfólios da casa:
- Para dados quantitativos de MERCADO (preço, YTD de mercado, cotação): Use as ferramentas de busca externa (tavily_web_search, finnhub_ticker_news) para trazer o dado real-time. NÃO aplique o "Aviso de Defasagem" — esse aviso é APENAS para dados dos portfólios modelo.
- Para dados de POSIÇÃO na casa (peso, contribuição): Use os dados estruturados do portfolio_holdings.

**NAVEGAÇÃO FLUIDA:** O sistema mantém o foco no ticker/ativo até o usuário explicitamente mudar para outro tema. Não reinicie o contexto desnecessariamente.

---

## REGRAS OPERACIONAIS

Responda sempre em português brasileiro de forma técnica, analítica e ultra-direta, utilizando jargões de mercado financeiro apropriados.

### REGRA ESTRITA DE RESPOSTA: CONSULTA DE PERFORMANCE (DIRETRIZ ABSOLUTA — ORDEM OBRIGATÓRIA):

**Contexto:** Você atua no "Advisor Chat" dentro da plataforma Galapagos Connect. Seu objetivo é fornecer dados precisos das atas de gestão e garantir que os assessores utilizem as ferramentas analíticas corretas do painel.

**Gatilho:** Qualquer consulta do assessor sobre performance, rentabilidade, retornos, resultado, YTD, MTD, drawdown ou solicitação de dados atualizados dos Model Portfolios (ex: "Qual a rentabilidade atualizada até o dia X?").

**REGRA INQUEBRÁVEL: Você NÃO PODE exibir gráficos, tabelas de dados ou números de performance sem ANTES fornecer os Passos 1 e 2 abaixo. A ordem é SEQUENCIAL e OBRIGATÓRIA.**

**Passo 1 — Aviso de Defasagem (PRIMEIRO, SEMPRE):**
Informe IMEDIATAMENTE que os documentos e atas de gestão mais recentes contêm apenas os retornos consolidados até o final do mês imediatamente anterior ao atual. É ESTRITAMENTE PROIBIDO tentar calcular ou fornecer no chat a rentabilidade do mês corrente em andamento.

**Passo 2 — Direcionamento Analítico (OBRIGATÓRIO, ANTES DOS DADOS):**
Escreva EXATAMENTE a seguinte frase logo após o aviso de defasagem, ANTES de qualquer número ou gráfico:

"💡 Para acessar dados de performance mais recentes (atualização diária) e a atribuição detalhada por classe de ativos, por favor, acesse a tab de **Performance Analítica** no menu lateral esquerdo."

**Passo 3 — Exibição dos Dados (SOMENTE APÓS Passos 1 e 2):**
Apenas APÓS concluir o Passo 1 e o Passo 2, apresente os números consolidados de fechamento do mês anterior (Retorno do Mês e YTD) e renderize o componente visual do gráfico usando a ferramenta 'renderizar_grafico_barras'.

**Passo 4 — Sufixo Final (HARDCODED — NUNCA OMITIR):**
Após os dados e gráficos, COPIE LITERALMENTE o bloco abaixo no final da resposta:

📊 **Para dados de performance mais recentes (D-1), cotações atualizadas e métricas de risco em tempo real, acesse o [Dashboard] ou a aba [Performance Analítica] no menu lateral.**

**Passo 5 — Alerta de Moeda Base:**
Todos os portfólios modelo operam em ambiente Offshore. Inclua: "📌 Moeda base: USD (Offshore)".

1. EXAUSTÃO TOTAL: Quando questionado sobre múltiplos portfólios (Conservative, Income, Balanced, Growth) ou ativos, você DEVE extrair e apresentar TODOS os dados disponíveis. NUNCA resuma, corte, crie 'top 5' ou omita dados por conta própria.

2. TABELA COMPARATIVA OBRIGATÓRIA PARA MÚLTIPLOS ITENS: Quando a resposta contiver dados numéricos comparativos entre 3+ portfólios ou ativos (performance, retorno, contribuição, peso, YTD, MTD, etc.), você DEVE OBRIGATORIAMENTE usar a ferramenta 'renderizar_tabela_comparativa' para enviar os dados estruturados em formato de tabela zebra profissional com alinhamento tabular. O gráfico de barras ('renderizar_grafico_barras') é permitido APENAS para visualizações simples de 1-2 métricas. Para análises completas com múltiplas colunas (ticker, classe, peso, contribuição), USE SEMPRE a tabela comparativa. NUNCA use tabelas markdown — use sempre a ferramenta.

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

11. REGRA DE FONTES/CITAÇÕES (PROIBIÇÃO ABSOLUTA): É ESTRITAMENTE PROIBIDO gerar uma seção de 'Fontes', 'Referências', '📎 Fontes:', links de arquivos ou qualquer listagem de PDFs/documentos no final da sua resposta. NÃO adicione emojis de clipe (📎) nem liste os documentos utilizados. O sistema frontend já exibe automaticamente os documentos consultados em um componente visual separado (accordion). Termine sua resposta diretamente no conteúdo analítico, sem nenhum rodapé de fontes.

12. PERGUNTAS DE FOLLOW-UP: Ao final de TODA resposta (após as fontes), inclua uma seção '💡 **Explorar mais:**' com 2-3 perguntas curtas e relevantes que o assessor poderia fazer em seguida para aprofundar a análise. As perguntas devem ser específicas ao contexto da resposta atual e aos dados disponíveis nos documentos. Formato:

💡 **Explorar mais:**
1. [Pergunta específica relacionada ao tema]
2. [Pergunta que aprofunda ou compara com outro portfólio/ativo]
3. [Pergunta sobre risco, alocação ou performance complementar]`;

    // First Claude call — may produce tool_use blocks
    const createClaudeResponse = async (messages: any[]) => {
      return await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          temperature: 0,
          stream: true,
          system: systemPrompt,
          tools: TOOLS,
          messages,
        }),
      });
    };

    const initialClaudeRes = await createClaudeResponse(claudeMessages);

    if (!initialClaudeRes.ok) {
      const errText = await initialClaudeRes.text();
      throw new Error(`Claude error: ${errText}`);
    }

    // We need to handle server-side tools in a multi-step loop
    // For UI tools (chart, factsheet), we stream to the client

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to process a Claude SSE stream
        async function processStream(
          claudeRes: Response,
          handleServerTool: boolean,
        ): Promise<{ needsToolResult: boolean; toolId: string; toolName: string; toolInput: any } | null> {
          const reader = claudeRes.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let currentToolId = "";
          let currentToolName = "";
          let toolInputJson = "";
          let serverToolCall: { id: string; name: string; input: any } | null = null;

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

                if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta?.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "delta", text: event.delta.text })}\n\n`)
                  );
                }

                if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
                  currentToolId = event.content_block.id || "";
                  currentToolName = event.content_block.name || "";
                  toolInputJson = "";
                }

                if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
                  toolInputJson += event.delta.partial_json || "";
                }

                if (event.type === "content_block_stop" && currentToolName) {
                  try {
                    const toolInput = JSON.parse(toolInputJson);

                    if (handleServerTool && (
                      currentToolName === "fetch_live_asset_data" ||
                      currentToolName === "search_macro_market_context" ||
                      currentToolName === "get_company_ticker_news" ||
                      currentToolName === "ask_perplexity_researcher" ||
                      currentToolName === "tavily_web_search" ||
                      currentToolName === "finnhub_ticker_news"
                    )) {
                      serverToolCall = { id: currentToolId, name: currentToolName, input: toolInput };
                    } else {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                          type: "tool_call",
                          tool: currentToolName,
                          input: toolInput,
                        })}\n\n`)
                      );
                    }
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

          if (serverToolCall) {
            return {
              needsToolResult: true,
              toolId: serverToolCall.id,
              toolName: serverToolCall.name,
              toolInput: serverToolCall.input,
            };
          }
          return null;
        }

        async function executeServerTool(toolName: string, toolInput: any) {
          if (toolName === "fetch_live_asset_data") {
            console.log(`Executing fetch_live_asset_data for ticker: ${toolInput.ticker}`);
            return await fetchLiveMarketData(toolInput.ticker, toolInput.isin || null);
          }
          if (toolName === "search_macro_market_context") {
            console.log(`Executing search_macro_market_context: "${toolInput.query}"`);
            if (!googleKey) {
              return { status: "error", message: "GOOGLE_AI_API_KEY não configurada para busca macro." };
            }
            return await searchMacroMarketContext(toolInput.query, googleKey);
          }
          if (toolName === "get_company_ticker_news") {
            console.log(`Executing get_company_ticker_news for: ${toolInput.symbol}`);
            if (!googleKey) {
              return { status: "error", message: "GOOGLE_AI_API_KEY não configurada para busca de notícias." };
            }
            return await getCompanyTickerNews(toolInput.symbol, toolInput.from_date, toolInput.to_date, googleKey);
          }
          if (toolName === "ask_perplexity_researcher") {
            console.log(`Executing ask_perplexity_researcher`);
            return await askPerplexityResearcher(toolInput.research_prompt);
          }
          if (toolName === "tavily_web_search") {
            console.log(`Executing tavily_web_search: "${toolInput.query}"`);
            return await tavilyWebSearch(toolInput.query, toolInput.search_depth || "basic");
          }
          if (toolName === "finnhub_ticker_news") {
            console.log(`Executing finnhub_ticker_news for: ${toolInput.symbol}`);
            return await finnhubTickerNews(toolInput.symbol, toolInput.from_date, toolInput.to_date);
          }
          return { status: "error", message: `Ferramenta de servidor não suportada: ${toolName}` };
        }

        try {
          let currentMessages = [...claudeMessages];
          let currentResponse: Response = initialClaudeRes;
          const maxSteps = 5;

          for (let step = 0; step < maxSteps; step++) {
            const toolResult = await processStream(currentResponse, true);

            if (!toolResult?.needsToolResult) {
              break;
            }

            // Emit tool_pending event so frontend shows a spinner
            const toolLabels: Record<string, string> = {
              "fetch_live_asset_data": "Buscando dados de mercado...",
              "search_macro_market_context": "Pesquisando contexto macroeconômico...",
              "get_company_ticker_news": "Buscando notícias do ativo...",
              "ask_perplexity_researcher": "Analisando cenário de mercado na web...",
              "tavily_web_search": "Pesquisando na web...",
              "finnhub_ticker_news": "Buscando notícias financeiras...",
            };
            const pendingLabel = toolLabels[toolResult.toolName] || "Processando ferramenta...";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "tool_pending", tool: toolResult.toolName, label: pendingLabel })}\n\n`)
            );

            const toolResultData = await executeServerTool(toolResult.toolName, toolResult.toolInput);

            currentMessages = [
              ...currentMessages,
              {
                role: "assistant",
                content: [
                  { type: "tool_use", id: toolResult.toolId, name: toolResult.toolName, input: toolResult.toolInput },
                ],
              },
              {
                role: "user",
                content: [
                  { type: "tool_result", tool_use_id: toolResult.toolId, content: JSON.stringify(toolResultData) },
                ],
              },
            ];

            currentResponse = await createClaudeResponse(currentMessages);

            if (!currentResponse.ok) {
              const errText = await currentResponse.text();
              console.error("Continuation error:", errText);
              break;
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
