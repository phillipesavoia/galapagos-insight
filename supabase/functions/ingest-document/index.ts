import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let documentId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    documentId = formData.get("document_id") as string;
    const documentName = formData.get("name") as string;
    const documentType = formData.get("type") as string;
    const fundName = formData.get("fund_name") as string;
    const period = formData.get("period") as string;

    if (!file || !documentId) {
      return new Response(
        JSON.stringify({ error: "file and document_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const dbUrl = Deno.env.get("DB_URL");
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY");
    if (!dbUrl || !dbKey) throw new Error("Missing DB_URL or DB_SERVICE_ROLE_KEY");

    supabase = createClient(dbUrl, dbKey);

    // STEP 1: Extract text with Reducto
    console.log("Step 1: Extracting text with Reducto...");
    const reductoKey = Deno.env.get("REDUCTO_API_KEY");
    if (!reductoKey) throw new Error("Missing REDUCTO_API_KEY");

    const arrayBuffer = await file.arrayBuffer();
    const bytesForBase64 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytesForBase64.length; i++) {
      binary += String.fromCharCode(bytesForBase64[i]);
    }
    const base64 = btoa(binary);

    // Convert base64 to binary and upload as FormData
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const formData2 = new FormData();
    formData2.append("file", blob, documentName || "document.pdf");

    const uploadRes = await fetch("https://platform.reducto.ai/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${reductoKey}` },
      // NO Content-Type header — FormData sets it automatically
      body: formData2,
    });

    if (!uploadRes.ok) throw new Error(`Reducto upload failed [${uploadRes.status}]: ${await uploadRes.text()}`);
    const uploadData = await uploadRes.json();
    console.log("Reducto upload response:", JSON.stringify(uploadData));

    // file_id field (not url, not file_url)
    const file_id = uploadData.file_id ?? uploadData.url ?? uploadData.file_url;
    if (!file_id) throw new Error(`No file_id returned: ${JSON.stringify(uploadData)}`);

    const parseRes = await fetch("https://platform.reducto.ai/parse", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${reductoKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_url: file_id,
        options: { table_output_format: "markdown" }
      }),
    });

    if (!parseRes.ok) throw new Error(`Reducto parse failed [${parseRes.status}]: ${await parseRes.text()}`);

    const parseData = await parseRes.json();
    console.log("Parse response keys:", Object.keys(parseData));

    const result = parseData.result ?? parseData;
    let fullText = "";
    if (Array.isArray(result.chunks)) {
      fullText = result.chunks.map((chunk: any) => {
        if (typeof chunk.content === "string") return chunk.content;
        if (chunk.content?.markdown) return chunk.content.markdown;
        if (chunk.content?.text) return chunk.content.text;
        if (Array.isArray(chunk.blocks)) {
          return chunk.blocks.map((b: any) => b.content || "").join("\n");
        }
        return "";
      }).filter((t: string) => t.length > 0).join("\n\n");
    } else if (typeof result.text === "string") {
      fullText = result.text;
    }

    console.log(`Extracted ${fullText.length} characters`);
    if (!fullText || fullText.length < 20) throw new Error("No text extracted from PDF");

    // STEP 2: Extract metadata with Gemini 2.0 Flash
    console.log("Step 2: Extracting metadata with Gemini...");
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!googleKey) throw new Error("Missing GOOGLE_AI_API_KEY");

    const geminiMetaRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this financial document and extract metadata.
Return ONLY a JSON object with these fields:
{
  "detected_fund_name": "fund name or null",
  "detected_period": "YYYY-MM format or null",
  "detected_type": "factsheet|carta_mensal|apresentacao|outro",
  "detected_language": "pt-BR|en-US",
  "summary": "2-3 sentence summary in Portuguese",
  "key_metrics": {}
}

Document text (first 3000 chars):
${fullText.substring(0, 3000)}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    let extractedMetadata: Record<string, unknown> = {};
    if (geminiMetaRes.ok) {
      const geminiData = await geminiMetaRes.json();
      const metaText =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      try {
        const clean = metaText.replace(/```json|```/g, "").trim();
        extractedMetadata = JSON.parse(clean);
      } catch {
        console.log("Metadata parse failed, continuing...");
      }
    } else {
      console.log(
        `Gemini metadata call failed [${geminiMetaRes.status}], continuing...`
      );
      await geminiMetaRes.text(); // consume body
    }

    // STEP 3: Chunk the text
    console.log("Step 3: Chunking text...");
    const chunkSize = 500;
    const overlap = 50;
    const words = fullText.split(/\s+/);
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      if (chunk.trim().length > 50) chunks.push(chunk);
    }
    console.log(`Created ${chunks.length} chunks`);

    // STEP 4: Generate embeddings with Google text-embedding-004
    console.log("Step 4: Generating embeddings...");
    const batchSize = 10;
    const allEmbeddings: { chunk: string; embedding: number[]; index: number }[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batchChunks.map(async (chunk, batchIdx) => {
          const globalIdx = i + batchIdx;
          const embRes = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${googleKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text: chunk }] },
              }),
            }
          );
          if (!embRes.ok) {
            const errText = await embRes.text();
            throw new Error(
              `Embedding failed for chunk ${globalIdx} [${embRes.status}]: ${errText}`
            );
          }
          const embData = await embRes.json();
          return {
            chunk,
            embedding: embData.embedding.values as number[],
            index: globalIdx,
          };
        })
      );
      allEmbeddings.push(...batchResults);
      if (i + batchSize < chunks.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // STEP 5: Store chunks in Supabase
    console.log("Step 5: Storing chunks in Supabase...");
    const chunkRecords = allEmbeddings.map(({ chunk, embedding, index }) => ({
      document_id: documentId,
      content: chunk,
      embedding: `[${embedding.join(",")}]`,
      chunk_index: index,
      metadata: {
        fund_name: fundName || (extractedMetadata as Record<string, unknown>).detected_fund_name,
        period: period || (extractedMetadata as Record<string, unknown>).detected_period,
        document_type: documentType,
        document_name: documentName,
      },
    }));

    // Insert in batches of 50
    for (let i = 0; i < chunkRecords.length; i += 50) {
      const batch = chunkRecords.slice(i, i + 50);
      const { error: chunksError } = await supabase
        .from("document_chunks")
        .insert(batch);
      if (chunksError)
        throw new Error(`Failed to store chunks batch ${i}: ${chunksError.message}`);
    }

    // Update document status
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "indexed",
        chunk_count: chunks.length,
        metadata: extractedMetadata,
      })
      .eq("id", documentId);

    if (updateError)
      throw new Error(`Failed to update document: ${updateError.message}`);

    console.log("Ingestion complete!");
    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        chunks_created: chunks.length,
        metadata: extractedMetadata,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ingest error:", error);

    // Try to mark document as error
    if (documentId && supabase) {
      try {
        await supabase
          .from("documents")
          .update({ status: "error" })
          .eq("id", documentId);
      } catch (e) {
        console.error("Failed to mark document as error:", e);
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
