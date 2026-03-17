import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BENCHMARKS: Record<string, string> = {
  SPY: "S&P 500 (SPY)",
  ACWI: "MSCI World (ACWI)",
  AGG: "Bloomberg Agg Bond (AGG)",
  TLT: "US 20Y Treasury (TLT)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    if (!finnhubKey) {
      return new Response(JSON.stringify({ error: "FINNHUB_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tickers } = await req.json();
    const tickersToFetch = Array.isArray(tickers) && tickers.length > 0
      ? tickers.filter((t: string) => t in BENCHMARKS)
      : Object.keys(BENCHMARKS);

    if (tickersToFetch.length === 0) {
      return new Response(JSON.stringify({ error: "No valid benchmark tickers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = {};
    const now = Math.floor(Date.now() / 1000);
    const oneYearAgo = now - 365 * 24 * 60 * 60;

    for (const ticker of tickersToFetch) {
      try {
        // Fetch candles from Finnhub (daily resolution, 1 year)
        const res = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${oneYearAgo}&to=${now}&token=${finnhubKey}`
        );
        if (!res.ok) {
          results[ticker] = { status: "error", message: `HTTP ${res.status}` };
          continue;
        }
        const data = await res.json();
        if (data.s !== "ok" || !data.c || !data.t) {
          results[ticker] = { status: "no_data" };
          continue;
        }

        // Prepare rows for upsert
        const rows = data.t.map((timestamp: number, i: number) => {
          const d = new Date(timestamp * 1000);
          const dateStr = d.toISOString().split("T")[0];
          return {
            ticker,
            name: BENCHMARKS[ticker],
            date: dateStr,
            price: data.c[i],
          };
        });

        // Upsert in batches
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error } = await supabase.from("benchmark_prices").upsert(batch, {
            onConflict: "ticker,date",
            ignoreDuplicates: false,
          });
          if (error) console.error(`Upsert error for ${ticker}:`, error);
        }

        results[ticker] = { status: "ok", count: rows.length };
      } catch (err) {
        console.error(`Error fetching ${ticker}:`, err);
        results[ticker] = { status: "error", message: String(err) };
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
