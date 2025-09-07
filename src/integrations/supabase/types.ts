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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      collection_photos: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          photo_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          photo_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_photos_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_photos_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_photo_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_photo_url?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_photo_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gd_token_debug: {
        Row: {
          at: string | null
          err: string | null
          id: number
          ok: boolean | null
          sqlstate: string | null
          step: string | null
          user_id: string | null
        }
        Insert: {
          at?: string | null
          err?: string | null
          id?: number
          ok?: boolean | null
          sqlstate?: string | null
          step?: string | null
          user_id?: string | null
        }
        Update: {
          at?: string | null
          err?: string | null
          id?: number
          ok?: boolean | null
          sqlstate?: string | null
          step?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      google_drive_token_audit: {
        Row: {
          action: string
          id: string
          ip_address: unknown | null
          success: boolean | null
          timestamp: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          id?: string
          ip_address?: unknown | null
          success?: boolean | null
          timestamp?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          id?: string
          ip_address?: unknown | null
          success?: boolean | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_drive_tokens: {
        Row: {
          access_attempts: number | null
          access_token_secret_id: string
          created_at: string
          dedicated_folder_id: string | null
          dedicated_folder_name: string | null
          expires_at: string
          id: string
          last_accessed: string | null
          refresh_token_secret_id: string
          scopes: string[]
          token_last_rotated: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_attempts?: number | null
          access_token_secret_id: string
          created_at?: string
          dedicated_folder_id?: string | null
          dedicated_folder_name?: string | null
          expires_at: string
          id?: string
          last_accessed?: string | null
          refresh_token_secret_id: string
          scopes?: string[]
          token_last_rotated?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_attempts?: number | null
          access_token_secret_id?: string
          created_at?: string
          dedicated_folder_id?: string | null
          dedicated_folder_name?: string | null
          expires_at?: string
          id?: string
          last_accessed?: string | null
          refresh_token_secret_id?: string
          scopes?: string[]
          token_last_rotated?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          color: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          alias: string | null
          id: string
          labels: string[] | null
          media_type: string
          name: string
          original_date: string | null
          upload_date: string
          url: string
          user_id: string
        }
        Insert: {
          alias?: string | null
          id?: string
          labels?: string[] | null
          media_type?: string
          name: string
          original_date?: string | null
          upload_date?: string
          url: string
          user_id: string
        }
        Update: {
          alias?: string | null
          id?: string
          labels?: string[] | null
          media_type?: string
          name?: string
          original_date?: string | null
          upload_date?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_vault_availability: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      cleanup_expired_google_drive_tokens: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_google_drive_tokens_safe: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      gd_token_debug_insert: {
        Args: {
          p_err: string
          p_ok: boolean
          p_sqlstate: string
          p_step: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_final_security_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          message: string
          plaintext_columns_removed: boolean
          security_level: string
          tokens_encrypted: boolean
        }[]
      }
      get_google_drive_connection_info: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          dedicated_folder_id: string
          dedicated_folder_name: string
          expires_at: string
          has_connection: boolean
          is_expired: boolean
        }[]
      }
      get_google_drive_connection_status: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          dedicated_folder_id: string
          dedicated_folder_name: string
          has_connection: boolean
          is_expired: boolean
        }[]
      }
      get_google_drive_token_status: {
        Args: { p_user_id: string }
        Returns: {
          dedicated_folder_id: string
          dedicated_folder_name: string
          expires_at: string
          has_token: boolean
          is_expired: boolean
        }[]
      }
      get_google_drive_tokens_secure: {
        Args: { p_user_id: string }
        Returns: {
          access_token: string
          dedicated_folder_id: string
          dedicated_folder_name: string
          expires_at: string
          refresh_token: string
        }[]
      }
      get_my_google_drive_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          dedicated_folder_id: string
          dedicated_folder_name: string
          expires_at: string
          last_accessed: string
          token_status: string
        }[]
      }
      log_token_access: {
        Args: { p_action: string; p_success?: boolean; p_user_id: string }
        Returns: undefined
      }
      rotate_expired_tokens: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sanitize_sensitive_data: {
        Args: { p_input: string }
        Returns: string
      }
      store_google_drive_tokens_secure: {
        Args: {
          p_access_token: string
          p_expires_at: string
          p_refresh_token: string
          p_scopes: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      store_google_drive_tokens_simple: {
        Args: {
          p_access_token_secret_id: string
          p_expires_at: string
          p_refresh_token_secret_id: string
          p_scopes: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      validate_google_drive_access: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      verify_security_integrity: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          details: string
          status: string
        }[]
      }
      verify_token_security: {
        Args: Record<PropertyKey, never>
        Returns: {
          all_encrypted: boolean
          security_status: string
          total_tokens: number
        }[]
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
    Enums: {},
  },
} as const
