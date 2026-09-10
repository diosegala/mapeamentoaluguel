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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      base_conhecimento: {
        Row: {
          analisado_em: string | null
          ativo: boolean
          caracteres: number | null
          conteudo: string | null
          created_at: string
          erro_sincronizacao: string | null
          id: string
          insights: Json
          ordem: number
          origem: string
          resumo_ia: string | null
          status_sincronizacao: string
          temas: Json
          titulo: string
          trecho: string | null
          ultima_sincronizacao: string | null
          updated_at: string
          url_google_docs: string | null
        }
        Insert: {
          analisado_em?: string | null
          ativo?: boolean
          caracteres?: number | null
          conteudo?: string | null
          created_at?: string
          erro_sincronizacao?: string | null
          id?: string
          insights?: Json
          ordem?: number
          origem?: string
          resumo_ia?: string | null
          status_sincronizacao?: string
          temas?: Json
          titulo: string
          trecho?: string | null
          ultima_sincronizacao?: string | null
          updated_at?: string
          url_google_docs?: string | null
        }
        Update: {
          analisado_em?: string | null
          ativo?: boolean
          caracteres?: number | null
          conteudo?: string | null
          created_at?: string
          erro_sincronizacao?: string | null
          id?: string
          insights?: Json
          ordem?: number
          origem?: string
          resumo_ia?: string | null
          status_sincronizacao?: string
          temas?: Json
          titulo?: string
          trecho?: string | null
          ultima_sincronizacao?: string | null
          updated_at?: string
          url_google_docs?: string | null
        }
        Relationships: []
      }
      configuracoes_agente: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          id: string
          modelo: string
          prompt_sistema: string
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          modelo?: string
          prompt_sistema: string
          updated_at?: string
          versao: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          modelo?: string
          prompt_sistema?: string
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      diagnosticos: {
        Row: {
          cidade: string
          codigo: string
          concluido_em: string | null
          created_at: string
          estado: string
          id: string
          iniciado_em: string | null
          nome_imobiliaria: string
          respostas: Json
          secao_atual: number
          status: string
          updated_at: string
        }
        Insert: {
          cidade: string
          codigo: string
          concluido_em?: string | null
          created_at?: string
          estado: string
          id?: string
          iniciado_em?: string | null
          nome_imobiliaria: string
          respostas?: Json
          secao_atual?: number
          status?: string
          updated_at?: string
        }
        Update: {
          cidade?: string
          codigo?: string
          concluido_em?: string | null
          created_at?: string
          estado?: string
          id?: string
          iniciado_em?: string | null
          nome_imobiliaria?: string
          respostas?: Json
          secao_atual?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      perguntas_formulario: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          descricao: string | null
          id: string
          obrigatoria: boolean
          opcoes: Json
          ordem: number
          permite_outro: boolean
          secao: number
          texto: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatoria?: boolean
          opcoes?: Json
          ordem?: number
          permite_outro?: boolean
          secao: number
          texto: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatoria?: boolean
          opcoes?: Json
          ordem?: number
          permite_outro?: boolean
          secao?: number
          texto?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      relatorios: {
        Row: {
          conteudo: string | null
          created_at: string
          diagnostico_id: string
          documentos_usados: Json
          erro: string | null
          id: string
          modelo: string | null
          prompt_snapshot: string | null
          status: string
          tokens_entrada: number | null
          tokens_saida: number | null
          updated_at: string
          versao: number
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          diagnostico_id: string
          documentos_usados?: Json
          erro?: string | null
          id?: string
          modelo?: string | null
          prompt_snapshot?: string | null
          status?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
          updated_at?: string
          versao?: number
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          diagnostico_id?: string
          documentos_usados?: Json
          erro?: string | null
          id?: string
          modelo?: string | null
          prompt_snapshot?: string | null
          status?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "diagnosticos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      ler_segredo: { Args: { p_nome: string }; Returns: string }
      salvar_segredo: {
        Args: { p_nome: string; p_valor: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
