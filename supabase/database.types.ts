export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      casts: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          revision: number;
          snapshot: Json;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_id: string;
          revision?: number;
          snapshot: Json;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          revision?: number;
          snapshot?: Json;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      entitlements: {
        Row: {
          plan: string;
          updated_at: string;
          user_id: string;
          valid_until: string | null;
          verified_source: string;
        };
        Insert: {
          plan?: string;
          updated_at?: string;
          user_id: string;
          valid_until?: string | null;
          verified_source: string;
        };
        Update: {
          plan?: string;
          updated_at?: string;
          user_id?: string;
          valid_until?: string | null;
          verified_source?: string;
        };
        Relationships: [];
      };
      project_commands: {
        Row: {
          actor_id: string | null;
          base_revision: number;
          command_id: string;
          created_at: string;
          payload_hash: string;
          project_id: string;
          result_revision: number;
        };
        Insert: {
          actor_id?: string | null;
          base_revision: number;
          command_id: string;
          created_at?: string;
          payload_hash: string;
          project_id: string;
          result_revision: number;
        };
        Update: {
          actor_id?: string | null;
          base_revision?: number;
          command_id?: string;
          created_at?: string;
          payload_hash?: string;
          project_id?: string;
          result_revision?: number;
        };
        Relationships: [
          {
            foreignKeyName: "project_commands_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          created_at: string;
          project_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          project_id: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          project_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_publications: {
        Row: {
          created_at: string;
          id: string;
          includes_media: boolean;
          project_id: string;
          snapshot: Json;
          source_revision: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          includes_media?: boolean;
          project_id: string;
          snapshot: Json;
          source_revision: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          includes_media?: boolean;
          project_id?: string;
          snapshot?: Json;
          source_revision?: number;
        };
        Relationships: [
          {
            foreignKeyName: "project_publications_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_share_links: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          publication_id: string;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          publication_id: string;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          publication_id?: string;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_share_links_publication_id_fkey";
            columns: ["publication_id"];
            isOneToOne: false;
            referencedRelation: "project_publications";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          owner_id: string;
          revision: number;
          schema_version: number;
          snapshot: Json;
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          owner_id: string;
          revision?: number;
          schema_version?: number;
          snapshot: Json;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          owner_id?: string;
          revision?: number;
          schema_version?: number;
          snapshot?: Json;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      archive_project: {
        Args: { p_archived: boolean; p_project_id: string };
        Returns: Json;
      };
      create_project: {
        Args: { p_project_id?: string; p_snapshot: Json; p_title: string };
        Returns: Json;
      };
      create_share_link: {
        Args: { p_expires_at?: string; p_publication_id: string };
        Returns: Json;
      };
      publish_project: {
        Args: {
          p_base_revision: number;
          p_include_media?: boolean;
          p_project_id: string;
        };
        Returns: Json;
      };
      read_share: { Args: { p_token: string }; Returns: Json };
      revoke_share_link: { Args: { p_link_id: string }; Returns: undefined };
      save_cast: {
        Args: {
          p_base_revision?: number;
          p_cast_id: string;
          p_snapshot: Json;
          p_title: string;
        };
        Returns: Json;
      };
      save_project: {
        Args: {
          p_base_revision: number;
          p_command_id: string;
          p_project_id: string;
          p_snapshot: Json;
        };
        Returns: Json;
      };
      set_project_member: {
        Args: { p_project_id: string; p_role: string; p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
