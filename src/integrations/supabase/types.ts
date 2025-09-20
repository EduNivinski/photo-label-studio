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
      drive_folders: {
        Row: {
          created_at: string
          drive_id: string | null
          folder_id: string
          name: string
          parent_id: string | null
          path_cached: string | null
          trashed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drive_id?: string | null
          folder_id: string
          name: string
          parent_id?: string | null
          path_cached?: string | null
          trashed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drive_id?: string | null
          folder_id?: string
          name?: string
          parent_id?: string | null
          path_cached?: string | null
          trashed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drive_items: {
        Row: {
          created_at: string
          created_time: string | null
          drive_id: string | null
          file_id: string
          image_meta: Json | null
          last_seen_at: string
          md5_checksum: string | null
          mime_type: string
          modified_time: string | null
          name: string
          parents: string[] | null
          path_cached: string | null
          size: number | null
          status: string
          thumbnail_link: string | null
          trashed: boolean
          updated_at: string
          user_id: string
          video_duration_ms: number | null
          video_height: number | null
          video_meta: Json | null
          video_width: number | null
          web_content_link: string | null
          web_view_link: string | null
        }
        Insert: {
          created_at?: string
          created_time?: string | null
          drive_id?: string | null
          file_id: string
          image_meta?: Json | null
          last_seen_at?: string
          md5_checksum?: string | null
          mime_type: string
          modified_time?: string | null
          name: string
          parents?: string[] | null
          path_cached?: string | null
          size?: number | null
          status?: string
          thumbnail_link?: string | null
          trashed?: boolean
          updated_at?: string
          user_id: string
          video_duration_ms?: number | null
          video_height?: number | null
          video_meta?: Json | null
          video_width?: number | null
          web_content_link?: string | null
          web_view_link?: string | null
        }
        Update: {
          created_at?: string
          created_time?: string | null
          drive_id?: string | null
          file_id?: string
          image_meta?: Json | null
          last_seen_at?: string
          md5_checksum?: string | null
          mime_type?: string
          modified_time?: string | null
          name?: string
          parents?: string[] | null
          path_cached?: string | null
          size?: number | null
          status?: string
          thumbnail_link?: string | null
          trashed?: boolean
          updated_at?: string
          user_id?: string
          video_duration_ms?: number | null
          video_height?: number | null
          video_meta?: Json | null
          video_width?: number | null
          web_content_link?: string | null
          web_view_link?: string | null
        }
        Relationships: []
      }
      drive_oauth_audit: {
        Row: {
          created_at: string
          details: Json | null
          has_access_token: boolean | null
          has_refresh_token: boolean | null
          id: number
          phase: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          has_access_token?: boolean | null
          has_refresh_token?: boolean | null
          id?: number
          phase: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          has_access_token?: boolean | null
          has_refresh_token?: boolean | null
          id?: number
          phase?: string
          user_id?: string
        }
        Relationships: []
      }
      drive_sync_state: {
        Row: {
          last_changes_at: string | null
          last_error: string | null
          last_full_scan_at: string | null
          running: boolean
          start_page_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_changes_at?: string | null
          last_error?: string | null
          last_full_scan_at?: string | null
          running?: boolean
          start_page_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_changes_at?: string | null
          last_error?: string | null
          last_full_scan_at?: string | null
          running?: boolean
          start_page_token?: string | null
          updated_at?: string
          user_id?: string
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
      labels_items: {
        Row: {
          created_at: string
          item_key: string
          label_id: string
          source: string
        }
        Insert: {
          created_at?: string
          item_key: string
          label_id: string
          source: string
        }
        Update: {
          created_at?: string
          item_key?: string
          label_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_items_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
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
      user_drive_meta: {
        Row: {
          dedicated_folder_id: string
          dedicated_folder_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          dedicated_folder_id: string
          dedicated_folder_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          dedicated_folder_id?: string
          dedicated_folder_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_drive_settings: {
        Row: {
          allow_extended_scope: boolean
          drive_folder_id: string | null
          drive_folder_name: string | null
          drive_folder_path: string | null
          scope_granted: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_extended_scope?: boolean
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_folder_path?: string | null
          scope_granted?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_extended_scope?: boolean
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_folder_path?: string | null
          scope_granted?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_drive_tokens: {
        Row: {
          access_token_enc: string
          created_at: string
          expires_at: string
          id: string
          refresh_token_enc: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token_enc: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token_enc?: string
          scope?: string
          updated_at?: string
          user_id?: string
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
      sanitize_sensitive_data: {
        Args: { p_input: string }
        Returns: string
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
