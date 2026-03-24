import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tickers } = await req.json();
    if (!tickers || !Array.isArray(tickers)) {
      return new Response(JSON.stringify({ error: "tickers array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = {};

    for (const ticker of tickers.slice(0, 20)) {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1mo`,
          { headers: { "User-Agent": "Mozilla/5.0" } }
        );
        if (!res.ok) { results[ticker] = null; continue; }
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        const timestamps = json?.chart?.result?.[0]?.timestamp || [];
        const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];

        if (!meta?.regularMarketPrice) { results[ticker] = null; continue; }

        const price = meta.regularMarketPrice;
        const prevClose = meta.previousClose || price;
        const change1D = ((price - prevClose) / prevClose) * 100;

        const sparklineData = closes
          .filter((c: number | null) => c != null)
          .map((c: number) => ({ value: c }));

        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        let changeMTD = 0;
        for (let i = 0; i < timestamps.length; i++) {
          const d = new Date(timestamps[i] * 1000);
          const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (monthStr === currentMonthStr && closes[i] != null) {
            changeMTD = ((price - closes[i]) / closes[i]) * 100;
            break;
          }
        }

        const chartPrevClose = meta.chartPreviousClose || closes[0] || price;
        const changeYTD = ((price - chartPrevClose) / chartPrevClose) * 100;

        results[ticker] = {
          lastPrice: parseFloat(price.toFixed(2)),
          currency: meta.currency || "USD",
          change1D: parseFloat(change1D.toFixed(2)),
          changeMTD: parseFloat(changeMTD.toFixed(2)),
          changeYTD: parseFloat(changeYTD.toFixed(2)),
          sparklineData: sparklineData.slice(-30),
        };
      } catch (e) {
        results[ticker] = null;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
