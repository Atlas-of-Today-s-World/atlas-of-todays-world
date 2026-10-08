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
      allowed_emails: {
        Row: {
          added_at: string
          added_by: string | null
          note: string
          value: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          note?: string
          value: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          note?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_emails_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allowed_emails_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approver_authors: {
        Row: {
          author_id: string
          user_id: string
        }
        Insert: {
          author_id: string
          user_id: string
        }
        Update: {
          author_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approver_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approver_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approver_authors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approver_authors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approver_countries: {
        Row: {
          country_iso3: string
          user_id: string
        }
        Insert: {
          country_iso3: string
          user_id: string
        }
        Update: {
          country_iso3?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approver_countries_country"
            columns: ["country_iso3"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["iso3"]
          },
          {
            foreignKeyName: "approver_countries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approver_countries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          actor_email: string | null
          at: string
          detail: Json
          id: number
          target: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_email?: string | null
          at?: string
          detail?: Json
          id?: never
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_email?: string | null
          at?: string
          detail?: Json
          id?: never
          target?: string | null
        }
        Relationships: []
      }
      authors: {
        Row: {
          bio: string
          created_at: string
          id: string
          name: string
          photo_url: string | null
          positionality: string
          profile_id: string | null
          slug: string
        }
        Insert: {
          bio?: string
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          positionality?: string
          profile_id?: string | null
          slug: string
        }
        Update: {
          bio?: string
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          positionality?: string
          profile_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "authors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          bbox: number[] | null
          blurb: string | null
          featured_indicators: string[]
          iso3: string
          lat: number | null
          lon: number | null
          name: string
          name_formal: string | null
          population: number | null
          profile_html: string
          region_slug: string | null
          slug: string
          tagline: string
          territory_note: string | null
          un_subregion: string | null
          updated_at: string
        }
        Insert: {
          bbox?: number[] | null
          blurb?: string | null
          featured_indicators?: string[]
          iso3: string
          lat?: number | null
          lon?: number | null
          name: string
          name_formal?: string | null
          population?: number | null
          profile_html?: string
          region_slug?: string | null
          slug: string
          tagline?: string
          territory_note?: string | null
          un_subregion?: string | null
          updated_at?: string
        }
        Update: {
          bbox?: number[] | null
          blurb?: string | null
          featured_indicators?: string[]
          iso3?: string
          lat?: number | null
          lon?: number | null
          name?: string
          name_formal?: string | null
          population?: number | null
          profile_html?: string
          region_slug?: string | null
          slug?: string
          tagline?: string
          territory_note?: string | null
          un_subregion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "countries_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
        ]
      }
      entries: {
        Row: {
          hero_background: string | null
          updated_by: string | null
          articles_label: string | null
          learn_more_label: string | null
          map_layers: string[]
          template_id: string | null
          approved_at: string | null
          approved_by: string | null
          area_id: string | null
          author_id: string | null
          author_name: string | null
          body_html: string
          category: string
          cover_credit: string | null
          cover_url: string | null
          created_at: string
          geo_summary: string | null
          id: string
          kind: string
          locale: string
          noindex: boolean
          og_image_url: string | null
          owner_id: string | null
          publish_at: string | null
          published_on: string | null
          reading_minutes: number | null
          region_slug: string | null
          review_note: string | null
          scheduled_by: string | null
          search: unknown
          seo_description: string | null
          seo_keywords: string[]
          seo_title: string | null
          slug: string
          special_slug: string | null
          status: string
          summary: string
          summary_points: string[]
          title: string
          translation_of: string | null
          updated_at: string
        }
        Insert: {
          hero_background?: string | null
          updated_by?: string | null
          articles_label?: string | null
          learn_more_label?: string | null
          map_layers?: string[]
          template_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          area_id?: string | null
          author_id?: string | null
          author_name?: string | null
          body_html?: string
          category: string
          cover_credit?: string | null
          cover_url?: string | null
          created_at?: string
          geo_summary?: string | null
          id?: string
          kind?: string
          locale?: string
          noindex?: boolean
          og_image_url?: string | null
          owner_id?: string | null
          publish_at?: string | null
          published_on?: string | null
          reading_minutes?: number | null
          region_slug?: string | null
          review_note?: string | null
          scheduled_by?: string | null
          search?: unknown
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          slug: string
          special_slug?: string | null
          status?: string
          summary?: string
          summary_points?: string[]
          title: string
          translation_of?: string | null
          updated_at?: string
        }
        Update: {
          hero_background?: string | null
          updated_by?: string | null
          articles_label?: string | null
          learn_more_label?: string | null
          map_layers?: string[]
          template_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          area_id?: string | null
          author_id?: string | null
          author_name?: string | null
          body_html?: string
          category?: string
          cover_credit?: string | null
          cover_url?: string | null
          created_at?: string
          geo_summary?: string | null
          id?: string
          kind?: string
          locale?: string
          noindex?: boolean
          og_image_url?: string | null
          owner_id?: string | null
          publish_at?: string | null
          published_on?: string | null
          reading_minutes?: number | null
          region_slug?: string | null
          review_note?: string | null
          scheduled_by?: string | null
          search?: unknown
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          slug?: string
          special_slug?: string | null
          status?: string
          summary?: string
          summary_points?: string[]
          title?: string
          translation_of?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "topic_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "map_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "entries_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_special_slug_fkey"
            columns: ["special_slug"]
            isOneToOne: false
            referencedRelation: "special_regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "entries_translation_of_fkey"
            columns: ["translation_of"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_chapters: {
        Row: {
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
          tile_background: string | null
          audio_url: string | null
          body_html: string
          entry_id: string
          id: string
          illustration_credit: string | null
          illustration_url: string | null
          position: number
          summary_points: string[]
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          tile_background?: string | null
          audio_url?: string | null
          body_html?: string
          entry_id: string
          id?: string
          illustration_credit?: string | null
          illustration_url?: string | null
          position: number
          summary_points?: string[]
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          tile_background?: string | null
          audio_url?: string | null
          body_html?: string
          entry_id?: string
          id?: string
          illustration_credit?: string | null
          illustration_url?: string | null
          position?: number
          summary_points?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_chapters_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_countries: {
        Row: {
          country_iso3: string
          entry_id: string
        }
        Insert: {
          country_iso3: string
          entry_id: string
        }
        Update: {
          country_iso3?: string
          entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_countries_country_iso3_fkey"
            columns: ["country_iso3"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["iso3"]
          },
          {
            foreignKeyName: "entry_countries_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_faq: {
        Row: {
          answer: string
          entry_id: string
          id: string
          position: number
          question: string
        }
        Insert: {
          answer: string
          entry_id: string
          id?: string
          position: number
          question: string
        }
        Update: {
          answer?: string
          entry_id?: string
          id?: string
          position?: number
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_faq_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_revisions: {
        Row: {
          entry_id: string
          id: number
          saved_at: string
          saved_by: string | null
          snapshot: Json
        }
        Insert: {
          entry_id: string
          id?: never
          saved_at?: string
          saved_by?: string | null
          snapshot: Json
        }
        Update: {
          entry_id?: string
          id?: never
          saved_at?: string
          saved_by?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "entry_revisions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_revisions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_revisions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_tile_notes: {
        Row: {
          body_html: string
          entry_id: string
          tile_id: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          entry_id: string
          tile_id: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          entry_id?: string
          tile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_tile_notes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_tile_notes_tile_id_fkey"
            columns: ["tile_id"]
            isOneToOne: false
            referencedRelation: "learn_more_tiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer: string
          id: string
          position: number
          question: string
          region_slug: string | null
          special_slug: string | null
        }
        Insert: {
          answer: string
          id?: string
          position?: number
          question: string
          region_slug?: string | null
          special_slug?: string | null
        }
        Update: {
          answer?: string
          id?: string
          position?: number
          question?: string
          region_slug?: string | null
          special_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_items_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "faq_items_special_slug_fkey"
            columns: ["special_slug"]
            isOneToOne: false
            referencedRelation: "special_regions"
            referencedColumns: ["slug"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          note: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          note?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          note?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      home_featured: {
        Row: {
          first_chapter: string | null
          id: number
          second_chapter: string | null
          updated_at: string
        }
        Insert: {
          first_chapter?: string | null
          id?: number
          second_chapter?: string | null
          updated_at?: string
        }
        Update: {
          first_chapter?: string | null
          id?: number
          second_chapter?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      indicator_categories: {
        Row: {
          color: string
          indicator_id: string
          label: string
          value: number
        }
        Insert: {
          color: string
          indicator_id: string
          label: string
          value: number
        }
        Update: {
          color?: string
          indicator_id?: string
          label?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "indicator_categories_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_styles: {
        Row: {
          domain_max: number | null
          domain_min: number | null
          indicator_id: string
          preset: string
          reverse: boolean
          saturation: number
          steps: number
          stops: string[]
          updated_at: string
        }
        Insert: {
          domain_max?: number | null
          domain_min?: number | null
          indicator_id: string
          preset?: string
          reverse?: boolean
          saturation?: number
          steps?: number
          stops?: string[]
          updated_at?: string
        }
        Update: {
          domain_max?: number | null
          domain_min?: number | null
          indicator_id?: string
          preset?: string
          reverse?: boolean
          saturation?: number
          steps?: number
          stops?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_styles_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: true
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_values: {
        Row: {
          country_iso3: string
          indicator_id: string
          is_manual: boolean
          note: string | null
          source_note: string | null
          updated_at: string
          updated_by: string | null
          value: number
          year: number | null
        }
        Insert: {
          country_iso3: string
          indicator_id: string
          is_manual?: boolean
          note?: string | null
          source_note?: string | null
          updated_at?: string
          updated_by?: string | null
          value: number
          year?: number | null
        }
        Update: {
          country_iso3?: string
          indicator_id?: string
          is_manual?: boolean
          note?: string | null
          source_note?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_values_country_iso3_fkey"
            columns: ["country_iso3"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["iso3"]
          },
          {
            foreignKeyName: "indicator_values_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_values_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_values_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          created_by: string | null
          decimals: number
          description: string
          domain_max: number | null
          domain_min: number | null
          higher_is_better: boolean
          id: string
          is_custom: boolean
          label: string
          latest_year: number | null
          position: number
          ramp: string[]
          scale: string
          short_label: string
          source: string
          source_url: string | null
          type: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_by?: string | null
          decimals?: number
          description?: string
          domain_max?: number | null
          domain_min?: number | null
          higher_is_better?: boolean
          id: string
          is_custom?: boolean
          label: string
          latest_year?: number | null
          position?: number
          ramp?: string[]
          scale?: string
          short_label?: string
          source?: string
          source_url?: string | null
          type?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_by?: string | null
          decimals?: number
          description?: string
          domain_max?: number | null
          domain_min?: number | null
          higher_is_better?: boolean
          id?: string
          is_custom?: boolean
          label?: string
          latest_year?: number | null
          position?: number
          ramp?: string[]
          scale?: string
          short_label?: string
          source?: string
          source_url?: string | null
          type?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicators_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicators_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_profile_grants: {
        Row: {
          tx: number
          user_id: string
        }
        Insert: {
          tx?: number
          user_id: string
        }
        Update: {
          tx?: number
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          approval_global: boolean
          approver_authors: string[]
          approver_countries: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          note: string
          revoked_at: string | null
          role_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          approval_global?: boolean
          approver_authors?: string[]
          approver_countries?: string[]
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          note?: string
          revoked_at?: string | null
          role_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          approval_global?: boolean
          approver_authors?: string[]
          approver_countries?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          note?: string
          revoked_at?: string | null
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_more_tiles: {
        Row: {
          background: string | null
          description: string
          entry_id: string | null
          icon: string
          id: string
          image_credit: string | null
          image_url: string | null
          label: string
          legacy_kind: string | null
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          background?: string | null
          description?: string
          entry_id?: string | null
          icon?: string
          id?: string
          image_credit?: string | null
          image_url?: string | null
          label: string
          legacy_kind?: string | null
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          background?: string | null
          description?: string
          entry_id?: string | null
          icon?: string
          id?: string
          image_credit?: string | null
          image_url?: string | null
          label?: string
          legacy_kind?: string | null
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_more_tiles_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      map_areas: {
        Row: {
          country_iso3: string | null
          created_at: string
          created_by: string | null
          fill: string
          geometry: Json
          id: string
          label: string
          name: string
          note: string
          slug: string
          stroke: string
          updated_at: string
        }
        Insert: {
          country_iso3?: string | null
          created_at?: string
          created_by?: string | null
          fill: string
          geometry: Json
          id?: string
          label?: string
          name: string
          note?: string
          slug: string
          stroke: string
          updated_at?: string
        }
        Update: {
          country_iso3?: string | null
          created_at?: string
          created_by?: string | null
          fill?: string
          geometry?: Json
          id?: string
          label?: string
          name?: string
          note?: string
          slug?: string
          stroke?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_areas_country_iso3_fkey"
            columns: ["country_iso3"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["iso3"]
          },
          {
            foreignKeyName: "map_areas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_areas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          complimentary: boolean
          current_period_end: string | null
          monthly_amount_cents: number | null
          plan: string
          started_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          complimentary?: boolean
          current_period_end?: string | null
          monthly_amount_cents?: number | null
          plan?: string
          started_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          complimentary?: boolean
          current_period_end?: string | null
          monthly_amount_cents?: number | null
          plan?: string
          started_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views_daily: {
        Row: {
          day: string
          user_id: string
          views: number
        }
        Insert: {
          day?: string
          user_id: string
          views?: number
        }
        Update: {
          day?: string
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "page_views_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portrait_metrics: {
        Row: {
          country_iso3: string | null
          description: string
          id: string
          label: string
          period: string | null
          position: number
          region_slug: string | null
          source: string
          source_url: string | null
          special_slug: string | null
          value: string
          year: number | null
        }
        Insert: {
          country_iso3?: string | null
          description?: string
          id?: string
          label: string
          period?: string | null
          position?: number
          region_slug?: string | null
          source: string
          source_url?: string | null
          special_slug?: string | null
          value: string
          year?: number | null
        }
        Update: {
          country_iso3?: string | null
          description?: string
          id?: string
          label?: string
          period?: string | null
          position?: number
          region_slug?: string | null
          source?: string
          source_url?: string | null
          special_slug?: string | null
          value?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portrait_metrics_country_iso3_fkey"
            columns: ["country_iso3"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["iso3"]
          },
          {
            foreignKeyName: "portrait_metrics_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "portrait_metrics_special_slug_fkey"
            columns: ["special_slug"]
            isOneToOne: false
            referencedRelation: "special_regions"
            referencedColumns: ["slug"]
          },
        ]
      }
      preview_links: {
        Row: {
          created_at: string
          created_by: string | null
          entry_id: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_id: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "preview_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preview_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preview_links_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_global: boolean
          blocked_note: string | null
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          kind: string
          last_seen_at: string | null
          name: string
          phone: string | null
          role_id: string
          status: string
        }
        Insert: {
          approval_global?: boolean
          blocked_note?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          id: string
          kind?: string
          last_seen_at?: string | null
          name?: string
          phone?: string | null
          role_id?: string
          status?: string
        }
        Update: {
          approval_global?: boolean
          blocked_note?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          kind?: string
          last_seen_at?: string | null
          name?: string
          phone?: string | null
          role_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      redirects: {
        Row: {
          created_at: string
          created_by: string | null
          from_path: string
          id: string
          permanent: boolean
          to_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_path: string
          id?: string
          permanent?: boolean
          to_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_path?: string
          id?: string
          permanent?: boolean
          to_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          show_metrics: boolean
          center_lat: number
          center_lon: number
          content_status: string
          fill: string
          hero_credit: string
          hero_url: string | null
          intro: string
          name: string
          portrait_status: string
          position: number
          slug: string
          stroke: string
          summary: string
          tagline: string
          timeline_subtitle: string | null
          timeline_title: string | null
          updated_at: string
          zoom: number
        }
        Insert: {
          show_metrics?: boolean
          center_lat: number
          center_lon: number
          content_status?: string
          fill: string
          hero_credit?: string
          hero_url?: string | null
          intro?: string
          name: string
          portrait_status?: string
          position?: number
          slug: string
          stroke: string
          summary?: string
          tagline?: string
          timeline_subtitle?: string | null
          timeline_title?: string | null
          updated_at?: string
          zoom?: number
        }
        Update: {
          show_metrics?: boolean
          center_lat?: number
          center_lon?: number
          content_status?: string
          fill?: string
          hero_credit?: string
          hero_url?: string | null
          intro?: string
          name?: string
          portrait_status?: string
          position?: number
          slug?: string
          stroke?: string
          summary?: string
          tagline?: string
          timeline_subtitle?: string | null
          timeline_title?: string | null
          updated_at?: string
          zoom?: number
        }
        Relationships: []
      }
      resources: {
        Row: {
          description: string
          entry_id: string | null
          id: string
          image_url: string | null
          kind: string | null
          position: number
          region_slug: string | null
          source: string
          special_slug: string | null
          tile_id: string | null
          title: string
          url: string
        }
        Insert: {
          description?: string
          entry_id?: string | null
          id?: string
          image_url?: string | null
          kind?: string | null
          position?: number
          region_slug?: string | null
          source?: string
          special_slug?: string | null
          tile_id?: string | null
          title: string
          url: string
        }
        Update: {
          description?: string
          entry_id?: string | null
          id?: string
          image_url?: string | null
          kind?: string | null
          position?: number
          region_slug?: string | null
          source?: string
          special_slug?: string | null
          tile_id?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "resources_special_slug_fkey"
            columns: ["special_slug"]
            isOneToOne: false
            referencedRelation: "special_regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "resources_tile_id_fkey"
            columns: ["tile_id"]
            isOneToOne: false
            referencedRelation: "learn_more_tiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          actions: string
          role_id: string
          section: string
        }
        Insert: {
          actions: string
          role_id: string
          section: string
        }
        Update: {
          actions?: string
          role_id?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          approval_scope: string
          created_at: string
          id: string
          locked: boolean
          name: string
          news_scope: string
          note: string
          position: number
        }
        Insert: {
          approval_scope?: string
          created_at?: string
          id: string
          locked?: boolean
          name: string
          news_scope?: string
          note?: string
          position?: number
        }
        Update: {
          approval_scope?: string
          created_at?: string
          id?: string
          locked?: boolean
          name?: string
          news_scope?: string
          note?: string
          position?: number
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          id: number
          impersonation: boolean
          invite_only: boolean
          lock_after: number
          require_2fa_roles: string[]
          session_hours: number
        }
        Insert: {
          id?: number
          impersonation?: boolean
          invite_only?: boolean
          lock_after?: number
          require_2fa_roles?: string[]
          session_hours?: number
        }
        Update: {
          id?: number
          impersonation?: boolean
          invite_only?: boolean
          lock_after?: number
          require_2fa_roles?: string[]
          session_hours?: number
        }
        Relationships: []
      }
      site_theme: {
        Row: {
          border: number
          id: number
          region_colors: Json
          saturation: number
          updated_at: string
        }
        Insert: {
          border?: number
          id?: number
          region_colors?: Json
          saturation?: number
          updated_at?: string
        }
        Update: {
          border?: number
          id?: number
          region_colors?: Json
          saturation?: number
          updated_at?: string
        }
        Relationships: []
      }
      special_region_countries: {
        Row: {
          country_iso3: string
          special_slug: string
        }
        Insert: {
          country_iso3: string
          special_slug: string
        }
        Update: {
          country_iso3?: string
          special_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_region_countries_country_iso3_fkey"
            columns: ["country_iso3"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["iso3"]
          },
          {
            foreignKeyName: "special_region_countries_special_slug_fkey"
            columns: ["special_slug"]
            isOneToOne: false
            referencedRelation: "special_regions"
            referencedColumns: ["slug"]
          },
        ]
      }
      special_regions: {
        Row: {
          center_lat: number
          center_lon: number
          content_status: string
          created_by: string | null
          fill: string
          hero_credit: string
          hero_url: string | null
          intro: string
          kind: string
          name: string
          slug: string
          stroke: string
          subtitle: string
          summary: string
          timeline_subtitle: string | null
          timeline_title: string | null
          updated_at: string
          zoom: number
        }
        Insert: {
          center_lat: number
          center_lon: number
          content_status?: string
          created_by?: string | null
          fill: string
          hero_credit?: string
          hero_url?: string | null
          intro?: string
          kind?: string
          name: string
          slug: string
          stroke: string
          subtitle?: string
          summary?: string
          timeline_subtitle?: string | null
          timeline_title?: string | null
          updated_at?: string
          zoom?: number
        }
        Update: {
          center_lat?: number
          center_lon?: number
          content_status?: string
          created_by?: string | null
          fill?: string
          hero_credit?: string
          hero_url?: string | null
          intro?: string
          kind?: string
          name?: string
          slug?: string
          stroke?: string
          subtitle?: string
          summary?: string
          timeline_subtitle?: string | null
          timeline_title?: string | null
          updated_at?: string
          zoom?: number
        }
        Relationships: [
          {
            foreignKeyName: "special_regions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_regions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_template_tiles: {
        Row: {
          background: string | null
          description: string
          icon: string
          id: string
          image_credit: string | null
          image_url: string | null
          label: string
          position: number
          slug: string
          template_id: string
        }
        Insert: {
          background?: string | null
          description?: string
          icon?: string
          id?: string
          image_credit?: string | null
          image_url?: string | null
          label: string
          position?: number
          slug: string
          template_id: string
        }
        Update: {
          background?: string | null
          description?: string
          icon?: string
          id?: string
          image_credit?: string | null
          image_url?: string | null
          label?: string
          position?: number
          slug?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_template_tiles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "topic_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_templates: {
        Row: {
          articles_label: string
          description: string
          id: string
          is_default: boolean
          learn_more_label: string
          name: string
          updated_at: string
        }
        Insert: {
          articles_label?: string
          description?: string
          id?: string
          is_default?: boolean
          learn_more_label?: string
          name: string
          updated_at?: string
        }
        Update: {
          articles_label?: string
          description?: string
          id?: string
          is_default?: boolean
          learn_more_label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          body: string
          date_label: string
          id: string
          image_url: string | null
          position: number
          region_slug: string | null
          special_slug: string | null
          title: string
        }
        Insert: {
          body?: string
          date_label: string
          id?: string
          image_url?: string | null
          position?: number
          region_slug?: string | null
          special_slug?: string | null
          title: string
        }
        Update: {
          body?: string
          date_label?: string
          id?: string
          image_url?: string | null
          position?: number
          region_slug?: string | null
          special_slug?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "timeline_events_special_slug_fkey"
            columns: ["special_slug"]
            isOneToOne: false
            referencedRelation: "special_regions"
            referencedColumns: ["slug"]
          },
        ]
      }
      translations: {
        Row: {
          entity: string
          entity_key: string
          field: string
          locale: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          entity: string
          entity_key: string
          field: string
          locale: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          entity?: string
          entity_key?: string
          field?: string
          locale?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_embeds: {
        Row: {
          caption: string
          id: string
          position: number
          provider: string
          region_slug: string | null
          special_slug: string | null
          title: string
          url: string
        }
        Insert: {
          caption?: string
          id?: string
          position?: number
          provider: string
          region_slug?: string | null
          special_slug?: string | null
          title: string
          url: string
        }
        Update: {
          caption?: string
          id?: string
          position?: number
          provider?: string
          region_slug?: string | null
          special_slug?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_embeds_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "visual_embeds_special_slug_fkey"
            columns: ["special_slug"]
            isOneToOne: false
            referencedRelation: "special_regions"
            referencedColumns: ["slug"]
          },
        ]
      }
      volunteer_applications: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          notified_at: string | null
          status: string
          topics: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string
          name: string
          notified_at?: string | null
          status?: string
          topics?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          notified_at?: string | null
          status?: string
          topics?: string
          updated_at?: string
        }
        Relationships: []
      }
      volunteer_settings: {
        Row: {
          id: number
          notify_email: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          notify_email?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          notify_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      members_overview: {
        Row: {
          complimentary: boolean | null
          current_period_end: string | null
          email: string | null
          id: string | null
          joined_at: string | null
          kind: string | null
          last_seen_at: string | null
          membership_status: string | null
          name: string | null
          pages_read: number | null
          paying_since: string | null
          plan: string | null
          role_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation_for: { Args: { p_user: string }; Returns: string }
      approve_entry: { Args: { p_entry: string }; Returns: undefined }
      can_approve_entry: { Args: { p_entry: string }; Returns: boolean }
      can_edit_entry: { Args: { p_owner: string }; Returns: boolean }
      can_edit_portrait_metric: {
        Args: { p_special: string }
        Returns: boolean
      }
      can_read_entry: { Args: { p_entry: string }; Returns: boolean }
      can_read_unpublished: { Args: { p_owner: string }; Returns: boolean }
      can_write_entry: { Args: { p_entry: string }; Returns: boolean }
      claim_invitation: { Args: never; Returns: string }
      create_entry_translation: {
        Args: { p_entry: string; p_locale: string }
        Returns: string
      }
      create_preview_link: {
        Args: { p_entry: string; p_hours: number }
        Returns: string
      }
      entry_preview: {
        Args: { p_token: string }
        Returns: {
          author_name: string
          body_html: string
          category: string
          countries: string[]
          cover_credit: string
          cover_url: string
          expires_at: string
          published_on: string
          reading_minutes: number
          region_slug: string
          slug: string
          special_slug: string
          status: string
          summary: string
          title: string
          updated_at: string
        }[]
      }
      entry_preview_parts: {
        Args: { p_token: string }
        Returns: {
          articles_label: string | null
          author: Json
          chapters: Json
          kind: string
          learn_more_label: string | null
          notes: Json
          resources: Json
          summary_points: string[]
          tiles: Json
        }[]
      }
      has_perm: {
        Args: { p_action: string; p_section: string }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_polygon: { Args: { g: Json }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      may_approve_entry_as: {
        Args: { p_entry: string; p_user: string }
        Returns: boolean
      }
      mfa_ok: { Args: never; Returns: boolean }
      mfa_status: { Args: never; Returns: Json }
      my_permissions: {
        Args: never
        Returns: {
          actions: string
          section: string
        }[]
      }
      my_role: {
        Args: never
        Returns: {
          approval_scope: string
          created_at: string
          id: string
          locked: boolean
          name: string
          news_scope: string
          note: string
          position: number
        }
        SetofOptions: {
          from: "*"
          to: "roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      patron_stats: {
        Args: never
        Returns: {
          monthly_cents: number
          patrons: number
        }[]
      }
      planned_entries: {
        Args: never
        Returns: {
          category: string
          countries: string[]
          region_slug: string
          special_slug: string
          title: string
        }[]
      }
      portrait: { Args: { p_kind: string; p_slug: string }; Returns: Json }
      prune_entry_revisions: { Args: never; Returns: number }
      publish_due_entries: { Args: never; Returns: number }
      purge_audit_log: { Args: never; Returns: number }
      record_page_view: { Args: never; Returns: undefined }
      apply_topic_template: {
        Args: { p_entry: string; p_remove_missing?: boolean; p_template: string }
        Returns: undefined
      }
      replace_tiles: {
        Args: { p_entry: string | null; p_items: Json; p_template: string | null }
        Returns: undefined
      }
      save_topic_as_template: {
        Args: { p_entry: string; p_name: string }
        Returns: string
      }
      set_default_topic_template: {
        Args: { p_template: string }
        Returns: undefined
      }
      staff_name: { Args: { p_profile: string }; Returns: string }
      replace_entry_parts: {
        Args: { p_entry: string; p_items: Json; p_part: string }
        Returns: undefined
      }
      replace_portrait_items: {
        Args: {
          p_collection: string
          p_items: Json
          p_kind: string
          p_slug: string
        }
        Returns: undefined
      }
      role_holder_counts: {
        Args: never
        Returns: {
          holders: number
          role_id: string
        }[]
      }
      schedule_entry: {
        Args: { p_at: string; p_entry: string }
        Returns: undefined
      }
      search: {
        Args: { p_limit?: number; p_text: string }
        Returns: {
          id: string
          kind: string
          rank: number
          subtitle: string
          title: string
          url: string
        }[]
      }
      search_query: { Args: { p_text: string }; Returns: unknown }
      send_back_entry: {
        Args: { p_entry: string; p_note: string }
        Returns: undefined
      }
      short_items: {
        Args: { p_items: number; p_len: number; p_values: string[] }
        Returns: boolean
      }
      slugify_text: { Args: { p_text: string }; Returns: string }
      submit_entry: { Args: { p_entry: string }; Returns: undefined }
      submit_volunteer_application: {
        Args: { p_email: string; p_message: string; p_name: string; p_topics: string }
        Returns: undefined
      }
      translation_section: { Args: { p_entity: string }; Returns: string }
      unpublish_entry: { Args: { p_entry: string }; Returns: undefined }
      unschedule_entry: { Args: { p_entry: string }; Returns: undefined }
      write_audit: {
        Args: { p_action: string; p_detail?: Json; p_target: string }
        Returns: undefined
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
