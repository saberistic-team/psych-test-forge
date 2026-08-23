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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      attempts: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          participant_name: string | null
          responses: Json
          scores: Json
          test_id: string
          validity: Json
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          participant_name?: string | null
          responses: Json
          scores: Json
          test_id: string
          validity?: Json
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          participant_name?: string | null
          responses?: Json
          scores?: Json
          test_id?: string
          validity?: Json
        }
        Relationships: [
          {
            foreignKeyName: "attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_earnings: {
        Row: {
          created_at: string
          creator_id: string
          environment: string
          fee_bps: number
          fee_cents: number
          gross_cents: number
          id: string
          month: string
          net_cents: number
          payout_id: string | null
          purchase_id: string
          status: string
          test_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          environment?: string
          fee_bps: number
          fee_cents: number
          gross_cents: number
          id?: string
          month: string
          net_cents: number
          payout_id?: string | null
          purchase_id: string
          status?: string
          test_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          environment?: string
          fee_bps?: number
          fee_cents?: number
          gross_cents?: number
          id?: string
          month?: string
          net_cents?: number
          payout_id?: string | null
          purchase_id?: string
          status?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "listing_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          created_at: string
          creator_id: string
          errors: Json | null
          id: string
          model: string
          path_hint: string
          request: string
          status: string
          temperature: number
          test_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          errors?: Json | null
          id?: string
          model: string
          path_hint?: string
          request: string
          status?: string
          temperature?: number
          test_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          errors?: Json | null
          id?: string
          model?: string
          path_hint?: string
          request?: string
          status?: string
          temperature?: number
          test_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          test_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          test_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_events_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_purchases: {
        Row: {
          amount_cents: number
          buyer_user_id: string | null
          created_at: string
          creator_id: string
          currency: string
          environment: string
          id: string
          mode: string
          participant_id: string
          provider_ref: string
          status: string
          test_id: string
        }
        Insert: {
          amount_cents?: number
          buyer_user_id?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          environment?: string
          id?: string
          mode: string
          participant_id: string
          provider_ref: string
          status?: string
          test_id: string
        }
        Update: {
          amount_cents?: number
          buyer_user_id?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          environment?: string
          id?: string
          mode?: string
          participant_id?: string
          provider_ref?: string
          status?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_purchases_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          country: string | null
          creator_id: string
          details: string
          holder_name: string | null
          method: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          creator_id: string
          details?: string
          holder_name?: string | null
          method?: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          creator_id?: string
          details?: string
          holder_name?: string | null
          method?: string
          updated_at?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          created_at: string
          creator_id: string
          environment: string
          fee_cents: number
          gross_cents: number
          id: string
          month: string
          net_cents: number
          note: string | null
          paid_at: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          environment?: string
          fee_cents?: number
          gross_cents?: number
          id?: string
          month: string
          net_cents?: number
          note?: string | null
          paid_at?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          environment?: string
          fee_cents?: number
          gross_cents?: number
          id?: string
          month?: string
          net_cents?: number
          note?: string | null
          paid_at?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      premium_reports: {
        Row: {
          amount: number | null
          attempt_id: string
          created_at: string
          environment: string
          id: string
          participant_id: string | null
          provider_ref: string | null
          purchased: boolean
        }
        Insert: {
          amount?: number | null
          attempt_id: string
          created_at?: string
          environment?: string
          id?: string
          participant_id?: string | null
          provider_ref?: string | null
          purchased?: boolean
        }
        Update: {
          amount?: number | null
          attempt_id?: string
          created_at?: string
          environment?: string
          id?: string
          participant_id?: string | null
          provider_ref?: string | null
          purchased?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "premium_reports_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing: {
        Row: {
          audience: string
          can_publish: boolean
          features: Json
          monthly_attempts: number | null
          monthly_generations: number | null
          pdf_export: boolean
          plan: string
          price_cents: number
          sort_order: number
          white_label: boolean
        }
        Insert: {
          audience?: string
          can_publish?: boolean
          features?: Json
          monthly_attempts?: number | null
          monthly_generations?: number | null
          pdf_export?: boolean
          plan: string
          price_cents?: number
          sort_order?: number
          white_label?: boolean
        }
        Update: {
          audience?: string
          can_publish?: boolean
          features?: Json
          monthly_attempts?: number | null
          monthly_generations?: number | null
          pdf_export?: boolean
          plan?: string
          price_cents?: number
          sort_order?: number
          white_label?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          billing_cycle_start: string
          created_at: string
          id: string
          name: string | null
          org: string | null
          plan: string
          plan_override: string | null
          revenue_share_bps: number | null
          updated_at: string
        }
        Insert: {
          billing_cycle_start?: string
          created_at?: string
          id: string
          name?: string | null
          org?: string | null
          plan?: string
          plan_override?: string | null
          revenue_share_bps?: number | null
          updated_at?: string
        }
        Update: {
          billing_cycle_start?: string
          created_at?: string
          id?: string
          name?: string | null
          org?: string | null
          plan?: string
          plan_override?: string | null
          revenue_share_bps?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          participant_id: string | null
          plan: string
          price_id: string | null
          provider_customer_id: string | null
          provider_ref: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          participant_id?: string | null
          plan: string
          price_id?: string | null
          provider_customer_id?: string | null
          provider_ref?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          participant_id?: string | null
          plan?: string
          price_id?: string | null
          provider_customer_id?: string | null
          provider_ref?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tests: {
        Row: {
          access_code: string | null
          created_at: string
          creator_id: string
          deleted_at: string | null
          featured: boolean
          hide_attribution: boolean
          id: string
          listed: boolean
          listed_at: string | null
          listing_description: string | null
          price_cents: number
          published: boolean
          sale_mode: string
          slug: string | null
          spec: Json
          tagline: string | null
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          featured?: boolean
          hide_attribution?: boolean
          id?: string
          listed?: boolean
          listed_at?: string | null
          listing_description?: string | null
          price_cents?: number
          published?: boolean
          sale_mode?: string
          slug?: string | null
          spec: Json
          tagline?: string | null
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          access_code?: string | null
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          featured?: boolean
          hide_attribution?: boolean
          id?: string
          listed?: boolean
          listed_at?: string | null
          listing_description?: string | null
          price_cents?: number
          published?: boolean
          sale_mode?: string
          slug?: string | null
          spec?: Json
          tagline?: string | null
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      usage_grants: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          creator_id: string
          environment: string
          id: string
          metric: string
          note: string | null
          period: string | null
          provider_ref: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          creator_id: string
          environment?: string
          id?: string
          metric: string
          note?: string | null
          period?: string | null
          provider_ref?: string | null
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          creator_id?: string
          environment?: string
          id?: string
          metric?: string
          note?: string | null
          period?: string | null
          provider_ref?: string | null
          source?: string
        }
        Relationships: []
      }
      usage_metering: {
        Row: {
          creator_id: string
          id: string
          metric: string
          period: string
          value: number
        }
        Insert: {
          creator_id: string
          id?: string
          metric: string
          period: string
          value?: number
        }
        Update: {
          creator_id?: string
          id?: string
          metric?: string
          period?: string
          value?: number
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "creator"
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
      app_role: ["admin", "creator"],
    },
  },
} as const
