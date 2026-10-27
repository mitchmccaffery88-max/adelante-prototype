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
      account_support_items: {
        Row: {
          account_id: string
          created_at: string
          id: string
          org_id: string
          request_code: string
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          org_id: string
          request_code: string
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          org_id?: string
          request_code?: string
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_support_items_org_id_account_id_fkey"
            columns: ["org_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "account_support_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          id: string
          kind: string
          org_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          id?: string
          kind: string
          org_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      acting_role_sessions: {
        Row: {
          account_id: string
          created_at: string
          ended_at: string | null
          id: string
          org_id: string
          role: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          org_id: string
          role: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          org_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acting_role_sessions_org_id_account_id_fkey"
            columns: ["org_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "acting_role_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      advocate_links: {
        Row: {
          advocate_id: string
          consent_record_id: string
          created_at: string
          id: string
          org_id: string
          patient_id: string
          scope: string[]
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          advocate_id: string
          consent_record_id: string
          created_at?: string
          id?: string
          org_id: string
          patient_id: string
          scope: string[]
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          advocate_id?: string
          consent_record_id?: string
          created_at?: string
          id?: string
          org_id?: string
          patient_id?: string
          scope?: string[]
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advocate_links_org_id_advocate_id_fkey"
            columns: ["org_id", "advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "advocate_links_org_id_consent_record_id_fkey"
            columns: ["org_id", "consent_record_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "advocate_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advocate_links_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      advocates: {
        Row: {
          account_id: string
          created_at: string
          id: string
          name: string
          org_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advocates_org_id_account_id_fkey"
            columns: ["org_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "advocates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action_code: string
          actor_account_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          id: string
          metadata: Json
          org_id: string
          outcome: string
          patient_id: string | null
          registry_version: string
          simulated: boolean
          updated_at: string
        }
        Insert: {
          action_code: string
          actor_account_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          org_id: string
          outcome: string
          patient_id?: string | null
          registry_version: string
          simulated?: boolean
          updated_at?: string
        }
        Update: {
          action_code?: string
          actor_account_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          outcome?: string
          patient_id?: string | null
          registry_version?: string
          simulated?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_actor_account_id_fkey"
            columns: ["org_id", "actor_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      care_team_assignments: {
        Row: {
          assignment_kind: string
          created_at: string
          ends_at: string | null
          id: string
          org_id: string
          patient_id: string
          role: string
          site_id: string
          staff_member_id: string
          starts_at: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          assignment_kind: string
          created_at?: string
          ends_at?: string | null
          id?: string
          org_id: string
          patient_id: string
          role: string
          site_id: string
          staff_member_id: string
          starts_at: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          assignment_kind?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          org_id?: string
          patient_id?: string
          role?: string
          site_id?: string
          staff_member_id?: string
          starts_at?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_team_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_team_assignments_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "care_team_assignments_org_id_site_id_fkey"
            columns: ["org_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "care_team_assignments_org_id_staff_member_id_fkey"
            columns: ["org_id", "staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consent_type: string
          created_at: string
          effective_at: string
          expires_at: string | null
          expires_on_event: string | null
          expiry_event_occurred_at: string | null
          id: string
          items: string[] | null
          legacy_unverified: boolean
          needs_review_after_merge: boolean
          org_id: string
          part2_elements: Json
          patient_id: string
          purpose_code: string
          recipients: Json
          signature_method: string
          signed_at: string
          signed_by_kind: string
          status: string
          supersedes_id: string | null
          synthetic: boolean
          updated_at: string
          version_id: string | null
        }
        Insert: {
          consent_type: string
          created_at?: string
          effective_at: string
          expires_at?: string | null
          expires_on_event?: string | null
          expiry_event_occurred_at?: string | null
          id?: string
          items?: string[] | null
          legacy_unverified?: boolean
          needs_review_after_merge?: boolean
          org_id: string
          part2_elements?: Json
          patient_id: string
          purpose_code: string
          recipients?: Json
          signature_method: string
          signed_at: string
          signed_by_kind: string
          status: string
          supersedes_id?: string | null
          synthetic?: boolean
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          consent_type?: string
          created_at?: string
          effective_at?: string
          expires_at?: string | null
          expires_on_event?: string | null
          expiry_event_occurred_at?: string | null
          id?: string
          items?: string[] | null
          legacy_unverified?: boolean
          needs_review_after_merge?: boolean
          org_id?: string
          part2_elements?: Json
          patient_id?: string
          purpose_code?: string
          recipients?: Json
          signature_method?: string
          signed_at?: string
          signed_by_kind?: string
          status?: string
          supersedes_id?: string | null
          synthetic?: boolean
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "consent_records_org_id_supersedes_id_fkey"
            columns: ["org_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "consent_records_org_id_version_id_fkey"
            columns: ["org_id", "version_id"]
            isOneToOne: false
            referencedRelation: "consent_versions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      consent_signed_copies: {
        Row: {
          consent_record_id: string
          created_at: string
          id: string
          org_id: string
          sha256: string
          storage_pointer: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          consent_record_id: string
          created_at?: string
          id?: string
          org_id: string
          sha256: string
          storage_pointer: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          consent_record_id?: string
          created_at?: string
          id?: string
          org_id?: string
          sha256?: string
          storage_pointer?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_signed_copies_org_id_consent_record_id_fkey"
            columns: ["org_id", "consent_record_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "consent_signed_copies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_versions: {
        Row: {
          content_en: string
          content_es: string | null
          counsel_draft: boolean
          created_at: string
          form_key: string
          id: string
          org_id: string
          published: boolean
          sha256: string
          spanish_review_status: string
          updated_at: string
          version: number
        }
        Insert: {
          content_en: string
          content_es?: string | null
          counsel_draft?: boolean
          created_at?: string
          form_key: string
          id?: string
          org_id: string
          published?: boolean
          sha256: string
          spanish_review_status?: string
          updated_at?: string
          version: number
        }
        Update: {
          content_en?: string
          content_es?: string | null
          counsel_draft?: boolean
          created_at?: string
          form_key?: string
          id?: string
          org_id?: string
          published?: boolean
          sha256?: string
          spanish_review_status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      county_programs: {
        Row: {
          configuration: Json
          county_code: string
          created_at: string
          draft: boolean
          id: string
          org_id: string
          program_id: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          county_code: string
          created_at?: string
          draft?: boolean
          id?: string
          org_id: string
          program_id: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          county_code?: string
          created_at?: string
          draft?: boolean
          id?: string
          org_id?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "county_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "county_programs_org_id_program_id_fkey"
            columns: ["org_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      disclosure_events: {
        Row: {
          actor_account_id: string | null
          consent_record_id: string
          created_at: string
          id: string
          item_codes: string[]
          org_id: string
          patient_id: string
          purpose_code: string
          recipient_code: string
          simulated: boolean
          updated_at: string
        }
        Insert: {
          actor_account_id?: string | null
          consent_record_id: string
          created_at?: string
          id?: string
          item_codes?: string[]
          org_id: string
          patient_id: string
          purpose_code: string
          recipient_code: string
          simulated?: boolean
          updated_at?: string
        }
        Update: {
          actor_account_id?: string | null
          consent_record_id?: string
          created_at?: string
          id?: string
          item_codes?: string[]
          org_id?: string
          patient_id?: string
          purpose_code?: string
          recipient_code?: string
          simulated?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disclosure_events_org_id_actor_account_id_fkey"
            columns: ["org_id", "actor_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "disclosure_events_org_id_consent_record_id_fkey"
            columns: ["org_id", "consent_record_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "disclosure_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disclosure_events_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          flag_id: string
          id: string
          mode: string
          org_id: string
          simulated: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          flag_id: string
          id?: string
          mode?: string
          org_id: string
          simulated?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          flag_id?: string
          id?: string
          mode?: string
          org_id?: string
          simulated?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      first_visit_handoffs: {
        Row: {
          care_manager_id: string | null
          clinician_id: string | null
          created_at: string
          id: string
          org_id: string
          patient_id: string
          referral_id: string
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          care_manager_id?: string | null
          clinician_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          patient_id: string
          referral_id: string
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          care_manager_id?: string | null
          clinician_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          patient_id?: string
          referral_id?: string
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "first_visit_handoffs_org_id_care_manager_id_fkey"
            columns: ["org_id", "care_manager_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "first_visit_handoffs_org_id_clinician_id_fkey"
            columns: ["org_id", "clinician_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "first_visit_handoffs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "first_visit_handoffs_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "first_visit_handoffs_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      identity_review_items: {
        Row: {
          candidate_patient_ids: string[]
          candidate_referral_ids: string[]
          created_at: string
          decision_code: string | null
          id: string
          item_type: string
          org_id: string
          patient_id: string | null
          referral_id: string | null
          session_id: string | null
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          candidate_patient_ids?: string[]
          candidate_referral_ids?: string[]
          created_at?: string
          decision_code?: string | null
          id?: string
          item_type: string
          org_id: string
          patient_id?: string | null
          referral_id?: string | null
          session_id?: string | null
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          candidate_patient_ids?: string[]
          candidate_referral_ids?: string[]
          created_at?: string
          decision_code?: string | null
          id?: string
          item_type?: string
          org_id?: string
          patient_id?: string | null
          referral_id?: string | null
          session_id?: string | null
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_review_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_review_items_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "identity_review_items_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "identity_review_items_org_id_session_id_fkey"
            columns: ["org_id", "session_id"]
            isOneToOne: false
            referencedRelation: "signup_sessions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      intake_checklists: {
        Row: {
          completed_at: string | null
          contact_checked: boolean
          created_at: string
          handoff_ready: boolean
          id: string
          identity_link_checked: boolean
          org_id: string
          packet_received: boolean
          referral_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_checked?: boolean
          created_at?: string
          handoff_ready?: boolean
          id?: string
          identity_link_checked?: boolean
          org_id: string
          packet_received?: boolean
          referral_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_checked?: boolean
          created_at?: string
          handoff_ready?: boolean
          id?: string
          identity_link_checked?: boolean
          org_id?: string
          packet_received?: boolean
          referral_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_checklists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_checklists_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      intake_form_status: {
        Row: {
          consent_record_id: string | null
          created_at: string
          form_key: string
          id: string
          org_id: string
          referral_id: string
          sent_at: string | null
          signed_at: string | null
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          consent_record_id?: string | null
          created_at?: string
          form_key: string
          id?: string
          org_id: string
          referral_id: string
          sent_at?: string | null
          signed_at?: string | null
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          consent_record_id?: string | null
          created_at?: string
          form_key?: string
          id?: string
          org_id?: string
          referral_id?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_form_status_org_id_consent_record_id_fkey"
            columns: ["org_id", "consent_record_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "intake_form_status_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_status_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      intake_packet_needs: {
        Row: {
          created_at: string
          id: string
          need_kind: string
          org_id: string
          part2_tagged: boolean
          referral_id: string
          source: string
          source_ref: string
          state: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          need_kind: string
          org_id: string
          part2_tagged?: boolean
          referral_id: string
          source: string
          source_ref: string
          state: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          need_kind?: string
          org_id?: string
          part2_tagged?: boolean
          referral_id?: string
          source?: string
          source_ref?: string
          state?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_packet_needs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_packet_needs_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      locations: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
          site_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          site_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          site_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_org_id_site_id_fkey"
            columns: ["org_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      on_call_shifts: {
        Row: {
          clinician_id: string
          created_at: string
          draft_label: string
          ends_at: string
          id: string
          org_id: string
          site_id: string
          starts_at: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          clinician_id: string
          created_at?: string
          draft_label?: string
          ends_at: string
          id?: string
          org_id: string
          site_id: string
          starts_at: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          clinician_id?: string
          created_at?: string
          draft_label?: string
          ends_at?: string
          id?: string
          org_id?: string
          site_id?: string
          starts_at?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_call_shifts_org_id_clinician_id_fkey"
            columns: ["org_id", "clinician_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "on_call_shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_call_shifts_org_id_site_id_fkey"
            columns: ["org_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      orgs: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_self"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      packet_documents: {
        Row: {
          classification: string
          created_at: string
          document_type: string
          file_name: string
          id: string
          org_id: string
          part2_tagged: boolean
          referral_id: string
          source: string
          source_ref: string
          storage_path: string | null
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          classification: string
          created_at?: string
          document_type: string
          file_name: string
          id?: string
          org_id: string
          part2_tagged: boolean
          referral_id: string
          source: string
          source_ref: string
          storage_path?: string | null
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          classification?: string
          created_at?: string
          document_type?: string
          file_name?: string
          id?: string
          org_id?: string
          part2_tagged?: boolean
          referral_id?: string
          source?: string
          source_ref?: string
          storage_path?: string | null
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packet_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_documents_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      patient_contacts: {
        Row: {
          created_at: string
          id: string
          kind: string
          org_id: string
          patient_id: string
          synthetic: boolean
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          org_id: string
          patient_id: string
          synthetic?: boolean
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          patient_id?: string
          synthetic?: boolean
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_contacts_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      patient_site_enrollments: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          org_id: string
          patient_id: string
          site_id: string
          starts_at: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          org_id: string
          patient_id: string
          site_id: string
          starts_at: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          org_id?: string
          patient_id?: string
          site_id?: string
          starts_at?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_site_enrollments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_site_enrollments_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "patient_site_enrollments_org_id_site_id_fkey"
            columns: ["org_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      patients: {
        Row: {
          account_id: string | null
          created_at: string
          dob: string | null
          first_name: string
          id: string
          last_name: string
          org_id: string
          source_key: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          dob?: string | null
          first_name: string
          id?: string
          last_name: string
          org_id: string
          source_key: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          dob?: string | null
          first_name?: string
          id?: string
          last_name?: string
          org_id?: string
          source_key?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_org_id_account_id_fkey"
            columns: ["org_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "patients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_chart_triage: {
        Row: {
          created_at: string
          fallback_visible: boolean
          id: string
          org_id: string
          owner_staff_id: string | null
          referral_id: string | null
          result_tier: string
          signup_session_id: string | null
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          fallback_visible: boolean
          id?: string
          org_id: string
          owner_staff_id?: string | null
          referral_id?: string | null
          result_tier: string
          signup_session_id?: string | null
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          fallback_visible?: boolean
          id?: string
          org_id?: string
          owner_staff_id?: string | null
          referral_id?: string | null
          result_tier?: string
          signup_session_id?: string | null
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_chart_triage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_chart_triage_org_id_owner_staff_id_fkey"
            columns: ["org_id", "owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "pre_chart_triage_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "pre_chart_triage_org_id_signup_session_id_fkey"
            columns: ["org_id", "signup_session_id"]
            isOneToOne: false
            referencedRelation: "signup_sessions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      programs: {
        Row: {
          code: string
          created_at: string
          draft: boolean
          id: string
          name: string
          org_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          draft?: boolean
          id?: string
          name: string
          org_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          draft?: boolean
          id?: string
          name?: string
          org_id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_org_id_site_id_fkey"
            columns: ["org_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      record_access_log: {
        Row: {
          actor_account_id: string
          actor_role: string | null
          created_at: string
          id: string
          kind: string
          last_viewed_at: string
          org_id: string
          patient_id: string
          record_class: string
          simulated: boolean
          updated_at: string
          view_count: number
        }
        Insert: {
          actor_account_id: string
          actor_role?: string | null
          created_at?: string
          id?: string
          kind: string
          last_viewed_at?: string
          org_id: string
          patient_id: string
          record_class: string
          simulated?: boolean
          updated_at?: string
          view_count?: number
        }
        Update: {
          actor_account_id?: string
          actor_role?: string | null
          created_at?: string
          id?: string
          kind?: string
          last_viewed_at?: string
          org_id?: string
          patient_id?: string
          record_class?: string
          simulated?: boolean
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "record_access_log_org_id_actor_account_id_fkey"
            columns: ["org_id", "actor_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "record_access_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_access_log_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          org_id: string
          referral_id: string
          synthetic: boolean
          updated_at: string
          window_started_at: string | null
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          org_id: string
          referral_id: string
          synthetic?: boolean
          updated_at?: string
          window_started_at?: string | null
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          org_id?: string
          referral_id?: string
          synthetic?: boolean
          updated_at?: string
          window_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      referral_outreach_log: {
        Row: {
          actor_account_id: string | null
          created_at: string
          id: string
          org_id: string
          outcome_code: string
          referral_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          actor_account_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          outcome_code: string
          referral_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          actor_account_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          outcome_code?: string
          referral_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_outreach_log_org_id_actor_account_id_fkey"
            columns: ["org_id", "actor_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "referral_outreach_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_outreach_log_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      referral_status_updates: {
        Row: {
          actor_account_id: string | null
          created_at: string
          id: string
          org_id: string
          referral_id: string
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          actor_account_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          referral_id: string
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          actor_account_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          referral_id?: string
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_status_updates_org_id_actor_account_id_fkey"
            columns: ["org_id", "actor_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "referral_status_updates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_status_updates_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      referrals: {
        Row: {
          approx_age: string | null
          created_at: string
          dob: string | null
          dob_unknown: boolean
          first_name: string
          id: string
          identity_confidence: string
          last_name: string
          linked_patient_id: string | null
          org_id: string
          referrer_type: string
          safety_flag_tier: string | null
          source: string
          source_key: string
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          approx_age?: string | null
          created_at?: string
          dob?: string | null
          dob_unknown?: boolean
          first_name: string
          id?: string
          identity_confidence: string
          last_name: string
          linked_patient_id?: string | null
          org_id: string
          referrer_type: string
          safety_flag_tier?: string | null
          source: string
          source_key: string
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          approx_age?: string | null
          created_at?: string
          dob?: string | null
          dob_unknown?: boolean
          first_name?: string
          id?: string
          identity_confidence?: string
          last_name?: string
          linked_patient_id?: string | null
          org_id?: string
          referrer_type?: string
          safety_flag_tier?: string | null
          source?: string
          source_key?: string
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_org_id_linked_patient_id_fkey"
            columns: ["org_id", "linked_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      restricted_record_flags: {
        Row: {
          active: boolean
          created_at: string
          id: string
          org_id: string
          patient_id: string
          reason_code: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          org_id: string
          patient_id: string
          reason_code: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          org_id?: string
          patient_id?: string
          reason_code?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restricted_record_flags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restricted_record_flags_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      restricted_record_opens: {
        Row: {
          account_id: string
          acting_session_id: string
          created_at: string
          id: string
          org_id: string
          patient_id: string
          reason_code: string
          reviewed_at: string | null
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          acting_session_id: string
          created_at?: string
          id?: string
          org_id: string
          patient_id: string
          reason_code: string
          reviewed_at?: string | null
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          acting_session_id?: string
          created_at?: string
          id?: string
          org_id?: string
          patient_id?: string
          reason_code?: string
          reviewed_at?: string | null
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restricted_record_opens_org_id_account_id_fkey"
            columns: ["org_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "restricted_record_opens_org_id_acting_session_id_fkey"
            columns: ["org_id", "acting_session_id"]
            isOneToOne: false
            referencedRelation: "acting_role_sessions"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "restricted_record_opens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restricted_record_opens_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      signup_attempts: {
        Row: {
          attempt_kind: string
          attempted_at: string
          created_at: string
          id: string
          identity_hash: string
          org_id: string
          outcome_code: string
          session_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          attempt_kind: string
          attempted_at?: string
          created_at?: string
          id?: string
          identity_hash: string
          org_id: string
          outcome_code: string
          session_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          attempt_kind?: string
          attempted_at?: string
          created_at?: string
          id?: string
          identity_hash?: string
          org_id?: string
          outcome_code?: string
          session_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_attempts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_attempts_org_id_session_id_fkey"
            columns: ["org_id", "session_id"]
            isOneToOne: false
            referencedRelation: "signup_sessions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      signup_safety_scans: {
        Row: {
          created_at: string
          escalation_id: string | null
          id: string
          org_id: string
          result_tier: string
          session_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          escalation_id?: string | null
          id?: string
          org_id: string
          result_tier: string
          session_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          escalation_id?: string | null
          id?: string
          org_id?: string
          result_tier?: string
          session_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_safety_scans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_safety_scans_org_id_session_id_fkey"
            columns: ["org_id", "session_id"]
            isOneToOne: false
            referencedRelation: "signup_sessions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      signup_sessions: {
        Row: {
          account_id: string
          created_at: string
          expires_at: string
          id: string
          identity_hash: string
          org_id: string
          otp_hash: string | null
          otp_issued_at: string | null
          otp_tries: number
          otp_used: boolean
          patient_id: string | null
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          expires_at: string
          id?: string
          identity_hash: string
          org_id: string
          otp_hash?: string | null
          otp_issued_at?: string | null
          otp_tries?: number
          otp_used?: boolean
          patient_id?: string | null
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          identity_hash?: string
          org_id?: string
          otp_hash?: string | null
          otp_issued_at?: string | null
          otp_tries?: number
          otp_used?: boolean
          patient_id?: string | null
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_sessions_org_id_account_id_fkey"
            columns: ["org_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "signup_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_sessions_org_id_patient_id_fkey"
            columns: ["org_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      sites: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
          synthetic: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          synthetic?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          synthetic?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          account_id: string | null
          active: boolean
          created_at: string
          id: string
          name: string
          org_id: string
          source_key: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          created_at?: string
          id?: string
          name: string
          org_id: string
          source_key: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          source_key?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_org_id_account_id_fkey"
            columns: ["org_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "staff_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_role_assignments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_primary: boolean
          org_id: string
          role: string
          staff_member_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id: string
          role: string
          staff_member_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          role?: string
          staff_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_role_assignments_org_id_staff_member_id_fkey"
            columns: ["org_id", "staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      staff_site_assignments: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          org_id: string
          site_id: string
          staff_member_id: string
          starts_at: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          org_id: string
          site_id: string
          staff_member_id: string
          starts_at: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          org_id?: string
          site_id?: string
          staff_member_id?: string
          starts_at?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_site_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_site_assignments_org_id_site_id_fkey"
            columns: ["org_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "staff_site_assignments_org_id_staff_member_id_fkey"
            columns: ["org_id", "staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      staging_imports: {
        Row: {
          created_at: string
          id: string
          org_id: string
          source: string
          source_ref: string
          status: string
          synthetic: boolean
          template_sha256: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          source: string
          source_ref: string
          status: string
          synthetic?: boolean
          template_sha256: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          source?: string
          source_ref?: string
          status?: string
          synthetic?: boolean
          template_sha256?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staging_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_rows: {
        Row: {
          created_at: string
          id: string
          identity_fields: Json
          import_id: string
          org_id: string
          referral_id: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          identity_fields: Json
          import_id: string
          org_id: string
          referral_id: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          identity_fields?: Json
          import_id?: string
          org_id?: string
          referral_id?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staging_rows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_rows_org_id_import_id_fkey"
            columns: ["org_id", "import_id"]
            isOneToOne: false
            referencedRelation: "staging_imports"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "staging_rows_org_id_referral_id_fkey"
            columns: ["org_id", "referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      tester_attestations: {
        Row: {
          account_id: string
          created_at: string
          id: string
          language: string
          org_id: string
          statement_sha256: string
          statement_version: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          language: string
          org_id: string
          statement_sha256?: string
          statement_version?: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          language?: string
          org_id?: string
          statement_sha256?: string
          statement_version?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tester_attestations_org_id_account_id_fkey"
            columns: ["org_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tester_attestations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      website_inbox_items: {
        Row: {
          channel: string
          created_at: string
          id: string
          org_id: string
          resume_name: string | null
          resume_size: number | null
          status: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          org_id: string
          resume_name?: string | null
          resume_size?: number | null
          status: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          org_id?: string
          resume_name?: string | null
          resume_size?: number | null
          status?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_inbox_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advocate_view_identity: { Args: { p_link: string }; Returns: Json }
      foundation_attest_beta: { Args: { p_language: string }; Returns: string }
      foundation_command: {
        Args: { p_command: string; p_user: string; p_value: string }
        Returns: Json
      }
      foundation_consent_lifecycle: {
        Args: {
          p_reason_code: string
          p_record: string
          p_status: string
          p_user: string
        }
        Returns: string
      }
      foundation_current_context: { Args: never; Returns: Json }
      foundation_log: {
        Args: {
          p_action: string
          p_entity?: string
          p_kind: string
          p_metadata?: Json
          p_patient?: string
          p_registry?: string
          p_user: string
        }
        Returns: string
      }
      foundation_matrix_checksum: { Args: never; Returns: Json }
      foundation_set_acting_role: { Args: { p_role: string }; Returns: string }
      phase2_packet_documents: { Args: { p_referral: string }; Returns: Json }
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
