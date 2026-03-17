export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      advisor_chat_history: {
        Row: {
          content: string | null
          created_at: string | null
          filters: Json | null
          id: string
          role: string | null
          session_id: string | null
          sources: Json | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          filters?: Json | null
          id?: string
          role?: string | null
          session_id?: string | null
          sources?: Json | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          filters?: Json | null
          id?: string
          role?: string | null
          session_id?: string | null
          sources?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      asset_knowledge: {
        Row: {
          as_of_date: string | null
          asset_class: string
          created_at: string
          id: string
          isin: string | null
          name: string
          official_thesis: string
          portfolios: string[] | null
          risk_profile: string
          ticker: string
          updated_at: string
          weight_pct: Json | null
        }
        Insert: {
          as_of_date?: string | null
          asset_class: string
          created_at?: string
          id?: string
          isin?: string | null
          name: string
          official_thesis?: string
          portfolios?: string[] | null
          risk_profile?: string
          ticker: string
          updated_at?: string
          weight_pct?: Json | null
        }
        Update: {
          as_of_date?: string | null
          asset_class?: string
          created_at?: string
          id?: string
          isin?: string | null
          name?: string
          official_thesis?: string
          portfolios?: string[] | null
          risk_profile?: string
          ticker?: string
          updated_at?: string
          weight_pct?: Json | null
        }
        Relationships: []
      }
      asset_prices: {
        Row: {
          created_at: string | null
          currency: string
          daily_return: number | null
          date: string
          id: string
          price: number
          ticker: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          daily_return?: number | null
          date: string
          id?: string
          price: number
          ticker: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          daily_return?: number | null
          date?: string
          id?: string
          price?: number
          ticker?: string
        }
        Relationships: []
      }
      daily_holdings: {
        Row: {
          created_at: string | null
          date: string
          id: string
          portfolio_name: string
          ticker: string
          weight_percentage: number
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          portfolio_name: string
          ticker: string
          weight_percentage: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          portfolio_name?: string
          ticker?: string
          weight_percentage?: number
        }
        Relationships: []
      }
      daily_navs: {
        Row: {
          created_at: string | null
          currency: string
          daily_return: number | null
          date: string
          id: string
          nav: number
          portfolio_name: string
          ytd_return: number | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          daily_return?: number | null
          date: string
          id?: string
          nav: number
          portfolio_name: string
          ytd_return?: number | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          daily_return?: number | null
          date?: string
          id?: string
          nav?: number
          portfolio_name?: string
          ytd_return?: number | null
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number | null
          content: string
          created_at: string | null
          document_id: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index?: number | null
          content: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number | null
          content?: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          chunk_count: number | null
          file_url: string | null
          fund_name: string | null
          id: string
          language: string | null
          metadata: Json | null
          name: string
          owner_id: string | null
          period: string | null
          status: string | null
          type: string | null
          uploaded_at: string | null
        }
        Insert: {
          chunk_count?: number | null
          file_url?: string | null
          fund_name?: string | null
          id?: string
          language?: string | null
          metadata?: Json | null
          name: string
          owner_id?: string | null
          period?: string | null
          status?: string | null
          type?: string | null
          uploaded_at?: string | null
        }
        Update: {
          chunk_count?: number | null
          file_url?: string | null
          fund_name?: string | null
          id?: string
          language?: string | null
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          period?: string | null
          status?: string | null
          type?: string | null
          uploaded_at?: string | null
        }
        Relationships: []
      }
      model_allocations: {
        Row: {
          asset_class: string
          color: string | null
          created_at: string
          id: string
          portfolio_name: string
          updated_at: string
          weight_pct: number
        }
        Insert: {
          asset_class: string
          color?: string | null
          created_at?: string
          id?: string
          portfolio_name: string
          updated_at?: string
          weight_pct?: number
        }
        Update: {
          asset_class?: string
          color?: string | null
          created_at?: string
          id?: string
          portfolio_name?: string
          updated_at?: string
          weight_pct?: number
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          asset_class: string
          asset_name: string
          created_at: string
          id: string
          is_active: boolean
          portfolio_name: string
          ticker: string | null
          updated_at: string
          weight_percentage: number
        }
        Insert: {
          asset_class: string
          asset_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          portfolio_name: string
          ticker?: string | null
          updated_at?: string
          weight_percentage?: number
        }
        Update: {
          asset_class?: string
          asset_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          portfolio_name?: string
          ticker?: string | null
          updated_at?: string
          weight_percentage?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_chunks: {
        Args: {
          filter_fund?: string
          filter_type?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "assessor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "assessor"],
    },
  },
} as const
