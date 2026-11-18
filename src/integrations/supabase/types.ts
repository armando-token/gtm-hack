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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      gtm_aggregates: {
        Row: {
          created_at: string
          session_id: string
          tenant: string
          version: number
        }
        Insert: {
          created_at?: string
          session_id: string
          tenant: string
          version?: number
        }
        Update: {
          created_at?: string
          session_id?: string
          tenant?: string
          version?: number
        }
        Relationships: []
      }
      gtm_dispatches: {
        Row: {
          created_at: string
          dispatch_time: number
          effect_id: string | null
          id: string
          idempotency_key: string
          intent_id: string
          observed_version: number
          reason: string
          request_hash: string
          session_id: string
          status: string
          tenant: string
        }
        Insert: {
          created_at?: string
          dispatch_time: number
          effect_id?: string | null
          id?: string
          idempotency_key: string
          intent_id: string
          observed_version: number
          reason: string
          request_hash: string
          session_id: string
          status: string
          tenant: string
        }
        Update: {
          created_at?: string
          dispatch_time?: number
          effect_id?: string | null
          id?: string
          idempotency_key?: string
          intent_id?: string
          observed_version?: number
          reason?: string
          request_hash?: string
          session_id?: string
          status?: string
          tenant?: string
        }
        Relationships: []
      }
      gtm_effects: {
        Row: {
          created_at: string
          effect_key: string
          id: string
          intent_id: string
          payload: Json
          session_id: string
          tenant: string
        }
        Insert: {
          created_at?: string
          effect_key: string
          id?: string
          intent_id: string
          payload: Json
          session_id: string
          tenant: string
        }
        Update: {
          created_at?: string
          effect_key?: string
          id?: string
          intent_id?: string
          payload?: Json
          session_id?: string
          tenant?: string
        }
        Relationships: []
      }
      gtm_events: {
        Row: {
          created_at: string
          id: number
          known_time: number
          occurred_time: number
          organization: string
          origin: string
          payload: Json
          payload_hash: string
          registry_version: number
          revision: number
          session_id: string
          source: string
          stream: string
          tenant: string
        }
        Insert: {
          created_at?: string
          id?: number
          known_time: number
          occurred_time: number
          organization: string
          origin?: string
          payload: Json
          payload_hash: string
          registry_version: number
          revision: number
          session_id: string
          source: string
          stream: string
          tenant: string
        }
        Update: {
          created_at?: string
          id?: number
          known_time?: number
          occurred_time?: number
          organization?: string
          origin?: string
          payload?: Json
          payload_hash?: string
          registry_version?: number
          revision?: number
          session_id?: string
          source?: string
          stream?: string
          tenant?: string
        }
        Relationships: []
      }
      gtm_intents: {
        Row: {
          amount_cents: number
          approval: Json
          case_id: string
          created_at: string
          currency: string
          decision_time: number
          id: string
          key: Json
          permission_ref: string
          proof_digest: string
          proposal_digest: string
          proposal_id: string
          registry_version: number
          session_id: string
          status: string
          tenant: string
        }
        Insert: {
          amount_cents: number
          approval: Json
          case_id: string
          created_at?: string
          currency: string
          decision_time: number
          id?: string
          key: Json
          permission_ref: string
          proof_digest: string
          proposal_digest: string
          proposal_id: string
          registry_version: number
          session_id: string
          status?: string
          tenant: string
        }
        Update: {
          amount_cents?: number
          approval?: Json
          case_id?: string
          created_at?: string
          currency?: string
          decision_time?: number
          id?: string
          key?: Json
          permission_ref?: string
          proof_digest?: string
          proposal_digest?: string
          proposal_id?: string
          registry_version?: number
          session_id?: string
          status?: string
          tenant?: string
        }
        Relationships: []
      }
      gtm_payment_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          payload: Json
          receipt_id: string
          session_id: string
          tenant: string
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          payload: Json
          receipt_id: string
          session_id: string
          tenant: string
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          payload?: Json
          receipt_id?: string
          session_id?: string
          tenant?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gtm_append_event: {
        Args: {
          p_hash: string
          p_known: number
          p_occurred: number
          p_org: string
          p_origin: string
          p_payload: Json
          p_revision: number
          p_session: string
          p_source: string
          p_stream: string
          p_tenant: string
        }
        Returns: Json
      }
      gtm_commit_dispatch: {
        Args: {
          p_dispatch_time: number
          p_effect: Json
          p_effect_key: string
          p_expected_version: number
          p_fail_before_commit: boolean
          p_idem: string
          p_intent: string
          p_reason: string
          p_request_hash: string
          p_session: string
          p_status: string
          p_tenant: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
