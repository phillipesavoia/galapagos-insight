import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Document {
  id: string;
  name: string;
  type: string | null;
  fund_name: string | null;
  period: string | null;
  status: string | null;
  chunk_count: number | null;
  uploaded_at: string | null;
  metadata: Record<string, unknown> | null;
}

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, type, fund_name, period, status, chunk_count, uploaded_at, metadata")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching documents:", error);
      toast({ title: "Erro ao carregar documentos", variant: "destructive" });
    } else {
      setDocuments((data as Document[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Realtime subscription replaces polling
  useEffect(() => {
    const channel = supabase
      .channel("documents-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "documents" },
        (payload) => {
          setDocuments((prev) =>
            prev.map((doc) =>
              doc.id === payload.new.id ? { ...doc, ...(payload.new as Document) } : doc
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "documents" },
        () => {
          fetchDocuments();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "documents" },
        (payload) => {
          setDocuments((prev) => prev.filter((doc) => doc.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDocuments]);

  const uploadDocument = async (
    file: File,
    meta: { name: string; type: string; fund_name: string; period: string }
  ) => {
    // 1. Insert document record
    const { data: { user } } = await supabase.auth.getUser();
    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        name: meta.name || file.name,
        type: meta.type,
        fund_name: meta.fund_name,
        period: meta.period,
        status: "processing",
        owner_id: user?.id,
      })
      .select()
      .single();

    if (insertError || !doc) {
      toast({ title: "Erro ao criar documento", description: insertError?.message, variant: "destructive" });
      return false;
    }

    // 2. Call edge function with auth token
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_id", doc.id);
    formData.append("name", meta.name || file.name);
    formData.append("type", meta.type);
    formData.append("fund_name", meta.fund_name);
    formData.append("period", meta.period);

    toast({ title: "Processando documento...", description: "Isso pode levar alguns segundos." });

    const { data: { session } } = await supabase.auth.getSession();
    const ingestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`;
    const resp = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: formData,
    });

    const fnError = !resp.ok ? { message: `HTTP ${resp.status}` } : null;

    if (fnError) {
      toast({ title: "Erro no processamento", description: fnError.message, variant: "destructive" });
      return false;
    }

    toast({ title: "Documento indexado com sucesso!" });
    await fetchDocuments();
    return true;
  };

  const deleteDocument = async (id: string) => {
    // Delete chunks first, then document
    await supabase.from("document_chunks").delete().eq("document_id", id);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Documento excluído" });
      await fetchDocuments();
    }
  };

  return { documents, loading, fetchDocuments, uploadDocument, deleteDocument };
}
