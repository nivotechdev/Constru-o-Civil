// GERADO por scripts/gen-db-types.mjs a partir do banco (todas as migrations aplicadas). Não edite à mão:
// rode `npm run gen:types` (ver o script). Mesmo formato do `supabase gen types typescript`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_prefs: {
        Row: { account_id: string; theme: string; updated_at: string };
        Insert: { account_id: string; theme?: string; updated_at?: string };
        Update: { account_id?: string; theme?: string; updated_at?: string };
        Relationships: [
          {
            foreignKeyName: 'account_prefs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          }
        ];
      };
      accounts: {
        Row: {
          id: string;
          email: string;
          role: Database['public']['Enums']['app_role'];
          document: string;
          document_hash: string | null;
          document_cipher: string | null;
          whatsapp: string;
          whatsapp_verified_at: string | null;
          email_confirmed_at: string | null;
          profile_completed_at: string | null;
          terms_version: string;
          terms_accepted_at: string;
          worker_id: string | null;
          company_id: string | null;
          created_at: string;
          suspended_at: string | null;
          suspended_reason: string | null;
        };
        Insert: {
          id: string;
          email: string;
          role: Database['public']['Enums']['app_role'];
          document?: string;
          document_hash?: string | null;
          document_cipher?: string | null;
          whatsapp?: string;
          whatsapp_verified_at?: string | null;
          email_confirmed_at?: string | null;
          profile_completed_at?: string | null;
          terms_version?: string;
          terms_accepted_at?: string;
          worker_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          suspended_at?: string | null;
          suspended_reason?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          role?: Database['public']['Enums']['app_role'];
          document?: string;
          document_hash?: string | null;
          document_cipher?: string | null;
          whatsapp?: string;
          whatsapp_verified_at?: string | null;
          email_confirmed_at?: string | null;
          profile_completed_at?: string | null;
          terms_version?: string;
          terms_accepted_at?: string;
          worker_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          suspended_at?: string | null;
          suspended_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accounts_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: true;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      addresses: {
        Row: {
          account_id: string;
          cep: string;
          street: string;
          neighborhood: string;
          city: string;
          uf: string;
          lat: number;
          lon: number;
          precision: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          cep: string;
          street: string;
          neighborhood: string;
          city: string;
          uf: string;
          lat: number;
          lon: number;
          precision?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          cep?: string;
          street?: string;
          neighborhood?: string;
          city?: string;
          uf?: string;
          lat?: number;
          lon?: number;
          precision?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'addresses_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          }
        ];
      };
      app_config: {
        Row: { key: string; value: string };
        Insert: { key: string; value: string };
        Update: { key?: string; value?: string };
        Relationships: [];
      };
      application_attempts: {
        Row: { worker_id: string; job_id: string; created_at: string };
        Insert: { worker_id: string; job_id: string; created_at?: string };
        Update: { worker_id?: string; job_id?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: 'application_attempts_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      application_events: {
        Row: {
          id: number;
          application_id: string;
          status: Database['public']['Enums']['application_status'];
          at: string;
          by: Database['public']['Enums']['application_actor'];
          reason: string | null;
        };
        Insert: {
          id?: never;
          application_id: string;
          status: Database['public']['Enums']['application_status'];
          at?: string;
          by: Database['public']['Enums']['application_actor'];
          reason?: string | null;
        };
        Update: {
          id?: never;
          application_id?: string;
          status?: Database['public']['Enums']['application_status'];
          at?: string;
          by?: Database['public']['Enums']['application_actor'];
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'application_events_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          }
        ];
      };
      applications: {
        Row: {
          id: string;
          job_id: string;
          worker_id: string;
          status: Database['public']['Enums']['application_status'];
          created_at: string;
          status_changed_at: string;
          auto_rejected: boolean;
          worker_reviewed: boolean;
          company_reviewed: boolean;
          presence_confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          worker_id: string;
          status?: Database['public']['Enums']['application_status'];
          created_at?: string;
          status_changed_at?: string;
          auto_rejected?: boolean;
          worker_reviewed?: boolean;
          company_reviewed?: boolean;
          presence_confirmed_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          worker_id?: string;
          status?: Database['public']['Enums']['application_status'];
          created_at?: string;
          status_changed_at?: string;
          auto_rejected?: boolean;
          worker_reviewed?: boolean;
          company_reviewed?: boolean;
          presence_confirmed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'applications_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      auth_attempts: {
        Row: { id: number; key: string; at: string };
        Insert: { id?: never; key: string; at?: string };
        Update: { id?: never; key?: string; at?: string };
        Relationships: [];
      };
      avaliacoes: {
        Row: {
          id: string;
          candidatura_id: string;
          avaliador_id: string;
          avaliado_id: string;
          nota: number;
          comentario: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          candidatura_id: string;
          avaliador_id: string;
          avaliado_id: string;
          nota: number;
          comentario?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          candidatura_id?: string;
          avaliador_id?: string;
          avaliado_id?: string;
          nota?: number;
          comentario?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'avaliacoes_avaliado_id_fkey';
            columns: ['avaliado_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'avaliacoes_avaliador_id_fkey';
            columns: ['avaliador_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'avaliacoes_candidatura_id_fkey';
            columns: ['candidatura_id'];
            isOneToOne: false;
            referencedRelation: 'candidaturas';
            referencedColumns: ['id'];
          }
        ];
      };
      blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: { blocker_id: string; blocked_id: string; created_at?: string };
        Update: { blocker_id?: string; blocked_id?: string; created_at?: string };
        Relationships: [];
      };
      boost_payments: {
        Row: {
          id: string;
          job_id: string;
          company_id: string;
          plan: Database['public']['Enums']['boost_plan'];
          method: Database['public']['Enums']['payment_method'];
          amount_cents: number;
          status: Database['public']['Enums']['payment_status'];
          pix_code: string | null;
          card_last4: string | null;
          created_at: string;
          expires_at: string | null;
          confirmed_at: string | null;
          boost_ends_at: string | null;
          provider: string | null;
          provider_payment_id: string | null;
          pix_qr_base64: string | null;
          status_detail: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          company_id: string;
          plan: Database['public']['Enums']['boost_plan'];
          method: Database['public']['Enums']['payment_method'];
          amount_cents: number;
          status?: Database['public']['Enums']['payment_status'];
          pix_code?: string | null;
          card_last4?: string | null;
          created_at?: string;
          expires_at?: string | null;
          confirmed_at?: string | null;
          boost_ends_at?: string | null;
          provider?: string | null;
          provider_payment_id?: string | null;
          pix_qr_base64?: string | null;
          status_detail?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          company_id?: string;
          plan?: Database['public']['Enums']['boost_plan'];
          method?: Database['public']['Enums']['payment_method'];
          amount_cents?: number;
          status?: Database['public']['Enums']['payment_status'];
          pix_code?: string | null;
          card_last4?: string | null;
          created_at?: string;
          expires_at?: string | null;
          confirmed_at?: string | null;
          boost_ends_at?: string | null;
          provider?: string | null;
          provider_payment_id?: string | null;
          pix_qr_base64?: string | null;
          status_detail?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'boost_payments_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'boost_payments_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: true;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          }
        ];
      };
      candidaturas: {
        Row: {
          id: string;
          vaga_id: string;
          candidato_id: string;
          nome_candidato: string;
          email_candidato: string;
          candidatado_em: string;
          status: string;
        };
        Insert: {
          id?: string;
          vaga_id: string;
          candidato_id: string;
          nome_candidato: string;
          email_candidato: string;
          candidatado_em?: string;
          status?: string;
        };
        Update: {
          id?: string;
          vaga_id?: string;
          candidato_id?: string;
          nome_candidato?: string;
          email_candidato?: string;
          candidatado_em?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'candidaturas_candidato_id_fkey';
            columns: ['candidato_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'candidaturas_vaga_id_fkey';
            columns: ['vaga_id'];
            isOneToOne: false;
            referencedRelation: 'vagas';
            referencedColumns: ['id'];
          }
        ];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          cnpj: string | null;
          location: string;
          whatsapp: string;
          rating: number;
          review_count: number;
          verified: boolean;
          verified_since: string | null;
          since_label: string | null;
          respond_time: string | null;
          paid_count: number | null;
          logo_url: string | null;
          cover_url: string | null;
          created_at: string;
          verification_status: Database['public']['Enums']['company_verification'];
          verified_at: string | null;
          contact_name: string | null;
          cnpj_check: Json | null;
          about: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          cnpj?: string | null;
          location: string;
          whatsapp?: string;
          rating?: number;
          review_count?: number;
          verified?: boolean;
          verified_since?: string | null;
          since_label?: string | null;
          respond_time?: string | null;
          paid_count?: number | null;
          logo_url?: string | null;
          cover_url?: string | null;
          created_at?: string;
          verification_status?: Database['public']['Enums']['company_verification'];
          verified_at?: string | null;
          contact_name?: string | null;
          cnpj_check?: Json | null;
          about?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          cnpj?: string | null;
          location?: string;
          whatsapp?: string;
          rating?: number;
          review_count?: number;
          verified?: boolean;
          verified_since?: string | null;
          since_label?: string | null;
          respond_time?: string | null;
          paid_count?: number | null;
          logo_url?: string | null;
          cover_url?: string | null;
          created_at?: string;
          verification_status?: Database['public']['Enums']['company_verification'];
          verified_at?: string | null;
          contact_name?: string | null;
          cnpj_check?: Json | null;
          about?: string | null;
        };
        Relationships: [];
      };
      company_members: {
        Row: {
          company_id: string;
          user_id: string;
          role: Database['public']['Enums']['company_member_role'];
          created_at: string;
        };
        Insert: {
          company_id: string;
          user_id: string;
          role?: Database['public']['Enums']['company_member_role'];
          created_at?: string;
        };
        Update: {
          company_id?: string;
          user_id?: string;
          role?: Database['public']['Enums']['company_member_role'];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'company_members_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          }
        ];
      };
      consentimentos: {
        Row: { id: string; usuario_id: string; documento: string; versao: string; aceito_em: string };
        Insert: { id?: string; usuario_id: string; documento: string; versao: string; aceito_em?: string };
        Update: { id?: string; usuario_id?: string; documento?: string; versao?: string; aceito_em?: string };
        Relationships: [
          {
            foreignKeyName: 'consentimentos_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      cron_alerts: {
        Row: { id: number; jobname: string; runid: number; message: string; sent: boolean; alerted_at: string };
        Insert: { id?: never; jobname: string; runid: number; message: string; sent?: boolean; alerted_at?: string };
        Update: { id?: never; jobname?: string; runid?: number; message?: string; sent?: boolean; alerted_at?: string };
        Relationships: [];
      };
      identity_submissions: {
        Row: {
          id: string;
          worker_id: string;
          selfie_path: string;
          document_path: string;
          created_at: string;
          decided_at: string | null;
          consent_version: string | null;
          consent_at: string | null;
        };
        Insert: {
          id?: string;
          worker_id: string;
          selfie_path: string;
          document_path: string;
          created_at?: string;
          decided_at?: string | null;
          consent_version?: string | null;
          consent_at?: string | null;
        };
        Update: {
          id?: string;
          worker_id?: string;
          selfie_path?: string;
          document_path?: string;
          created_at?: string;
          decided_at?: string | null;
          consent_version?: string | null;
          consent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'identity_submissions_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      job_alerts: {
        Row: {
          worker_id: string;
          city: string;
          uf: string;
          lat: number;
          lon: number;
          radius_km: number | null;
          oficio_id: string | null;
          notified_on: string | null;
          notified_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          worker_id: string;
          city: string;
          uf: string;
          lat: number;
          lon: number;
          radius_km?: number | null;
          oficio_id?: string | null;
          notified_on?: string | null;
          notified_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          worker_id?: string;
          city?: string;
          uf?: string;
          lat?: number;
          lon?: number;
          radius_km?: number | null;
          oficio_id?: string | null;
          notified_on?: string | null;
          notified_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_alerts_oficio_id_fkey';
            columns: ['oficio_id'];
            isOneToOne: false;
            referencedRelation: 'oficios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_alerts_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: true;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      job_invites: {
        Row: {
          job_id: string;
          worker_id: string;
          company_id: string;
          status: string;
          created_at: string;
          answered_at: string | null;
        };
        Insert: {
          job_id: string;
          worker_id: string;
          company_id: string;
          status?: string;
          created_at?: string;
          answered_at?: string | null;
        };
        Update: {
          job_id?: string;
          worker_id?: string;
          company_id?: string;
          status?: string;
          created_at?: string;
          answered_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'job_invites_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_invites_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_invites_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      jobs: {
        Row: {
          id: string;
          company_id: string;
          oficio_id: string | null;
          title: string | null;
          pay: number | null;
          cep: string;
          street: string;
          number: string;
          complement: string | null;
          neighborhood: string;
          city: string;
          uf: string;
          lat: number;
          lon: number;
          date_to_arrange: boolean;
          start_date: string | null;
          end_date: string | null;
          start_time: string | null;
          end_time: string | null;
          diarias: number;
          dias: Database['public']['Enums']['dias_semana'] | null;
          urgent: boolean;
          boost_ends_at: string | null;
          photos: string[] | null;
          slots: number;
          closed: boolean;
          sem_contratacao: boolean;
          description: string;
          requirements: string[];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          area_lat: number | null;
          area_lon: number | null;
          payment_method: string | null;
          payment_note: string | null;
          area_geog: unknown | null;
          hidden_at: string | null;
          hidden_reason: string | null;
          public_slug: string;
          last_day: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          oficio_id?: string | null;
          title?: string | null;
          pay?: number | null;
          cep: string;
          street: string;
          number: string;
          complement?: string | null;
          neighborhood: string;
          city: string;
          uf: string;
          lat: number;
          lon: number;
          date_to_arrange?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          diarias?: number;
          dias?: Database['public']['Enums']['dias_semana'] | null;
          urgent?: boolean;
          boost_ends_at?: string | null;
          photos?: string[] | null;
          slots?: number;
          closed?: boolean;
          sem_contratacao?: boolean;
          description?: string;
          requirements?: string[];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          area_lat?: number | null;
          area_lon?: number | null;
          payment_method?: string | null;
          payment_note?: string | null;
          area_geog?: never;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          public_slug?: string;
          last_day?: never;
        };
        Update: {
          id?: string;
          company_id?: string;
          oficio_id?: string | null;
          title?: string | null;
          pay?: number | null;
          cep?: string;
          street?: string;
          number?: string;
          complement?: string | null;
          neighborhood?: string;
          city?: string;
          uf?: string;
          lat?: number;
          lon?: number;
          date_to_arrange?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          diarias?: number;
          dias?: Database['public']['Enums']['dias_semana'] | null;
          urgent?: boolean;
          boost_ends_at?: string | null;
          photos?: string[] | null;
          slots?: number;
          closed?: boolean;
          sem_contratacao?: boolean;
          description?: string;
          requirements?: string[];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          area_lat?: number | null;
          area_lon?: number | null;
          payment_method?: string | null;
          payment_note?: string | null;
          area_geog?: never;
          hidden_at?: string | null;
          hidden_reason?: string | null;
          public_slug?: string;
          last_day?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_oficio_id_fkey';
            columns: ['oficio_id'];
            isOneToOne: false;
            referencedRelation: 'oficios';
            referencedColumns: ['id'];
          }
        ];
      };
      notification_prefs: {
        Row: { account_id: string; muted_groups: string[]; push_groups: string[]; updated_at: string };
        Insert: { account_id: string; muted_groups?: string[]; push_groups?: string[]; updated_at?: string };
        Update: { account_id?: string; muted_groups?: string[]; push_groups?: string[]; updated_at?: string };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          worker_id: string | null;
          company_id: string | null;
          kind: Database['public']['Enums']['notification_kind'];
          title: string;
          body: string;
          target: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          worker_id?: string | null;
          company_id?: string | null;
          kind: Database['public']['Enums']['notification_kind'];
          title: string;
          body: string;
          target?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          worker_id?: string | null;
          company_id?: string | null;
          kind?: Database['public']['Enums']['notification_kind'];
          title?: string;
          body?: string;
          target?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      oficios: {
        Row: { id: string; nome: string; sinonimos: string[] };
        Insert: { id: string; nome: string; sinonimos?: string[] };
        Update: { id?: string; nome?: string; sinonimos?: string[] };
        Relationships: [];
      };
      payment_webhook_events: {
        Row: {
          id: number;
          provider: string;
          event_id: string;
          provider_payment_id: string | null;
          received_at: string;
          result: string | null;
        };
        Insert: {
          id?: never;
          provider: string;
          event_id: string;
          provider_payment_id?: string | null;
          received_at?: string;
          result?: string | null;
        };
        Update: {
          id?: never;
          provider?: string;
          event_id?: string;
          provider_payment_id?: string | null;
          received_at?: string;
          result?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          nome: string;
          email: string;
          tipo: string | null;
          documento_cifrado: string | null;
          documento_hash: string | null;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
          foto_url: string | null;
          biografia: string | null;
          whatsapp: string | null;
          cargo: string | null;
          regiao: string | null;
          especialidades: string[] | null;
          tipo_obra: string | null;
          regiao_atuacao: string | null;
          capa_url: string | null;
        };
        Insert: {
          id: string;
          nome: string;
          email: string;
          tipo?: string | null;
          documento_cifrado?: string | null;
          documento_hash?: string | null;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
          foto_url?: string | null;
          biografia?: string | null;
          whatsapp?: string | null;
          cargo?: string | null;
          regiao?: string | null;
          especialidades?: string[] | null;
          tipo_obra?: string | null;
          regiao_atuacao?: string | null;
          capa_url?: string | null;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          tipo?: string | null;
          documento_cifrado?: string | null;
          documento_hash?: string | null;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
          foto_url?: string | null;
          biografia?: string | null;
          whatsapp?: string | null;
          cargo?: string | null;
          regiao?: string | null;
          especialidades?: string[] | null;
          tipo_obra?: string | null;
          regiao_atuacao?: string | null;
          capa_url?: string | null;
        };
        Relationships: [];
      };
      public_link_hits: {
        Row: { ip_hash: string; at: string };
        Insert: { ip_hash: string; at?: string };
        Update: { ip_hash?: string; at?: string };
        Relationships: [];
      };
      publicacoes_trabalhador: {
        Row: {
          id: string;
          trabalhador_id: string;
          midia_url: string;
          midia_tipo: string;
          legenda: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          trabalhador_id: string;
          midia_url: string;
          midia_tipo: string;
          legenda?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          trabalhador_id?: string;
          midia_url?: string;
          midia_tipo?: string;
          legenda?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'publicacoes_trabalhador_trabalhador_id_fkey';
            columns: ['trabalhador_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      push_subscriptions: {
        Row: {
          endpoint: string;
          account_id: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          endpoint: string;
          account_id: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          endpoint?: string;
          account_id?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: Database['public']['Enums']['report_target'];
          target_id: string;
          reason: string;
          details: string | null;
          status: string;
          created_at: string;
          resolution: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: Database['public']['Enums']['report_target'];
          target_id: string;
          reason: string;
          details?: string | null;
          status?: string;
          created_at?: string;
          resolution?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: Database['public']['Enums']['report_target'];
          target_id?: string;
          reason?: string;
          details?: string | null;
          status?: string;
          created_at?: string;
          resolution?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          application_id: string | null;
          direction: Database['public']['Enums']['review_direction'];
          company_id: string | null;
          worker_id: string | null;
          author_label: string;
          value: number;
          tags: string[];
          comment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_id?: string | null;
          direction: Database['public']['Enums']['review_direction'];
          company_id?: string | null;
          worker_id?: string | null;
          author_label: string;
          value: number;
          tags?: string[];
          comment?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          application_id?: string | null;
          direction?: Database['public']['Enums']['review_direction'];
          company_id?: string | null;
          worker_id?: string | null;
          author_label?: string;
          value?: number;
          tags?: string[];
          comment?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      saved_jobs: {
        Row: { worker_id: string; job_id: string; saved_at: string };
        Insert: { worker_id: string; job_id: string; saved_at?: string };
        Update: { worker_id?: string; job_id?: string; saved_at?: string };
        Relationships: [
          {
            foreignKeyName: 'saved_jobs_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_jobs_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      staff_actions: {
        Row: {
          id: number;
          staff_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          staff_id?: string | null;
          action: string;
          target_type: string;
          target_id: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          staff_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      staff_members: {
        Row: { user_id: string; role: string; created_at: string };
        Insert: { user_id: string; role?: string; created_at?: string };
        Update: { user_id?: string; role?: string; created_at?: string };
        Relationships: [];
      };
      terms_acceptances: {
        Row: { id: number; account_id: string; document: string; version: string; accepted_at: string };
        Insert: { id?: never; account_id: string; document: string; version: string; accepted_at?: string };
        Update: { id?: never; account_id?: string; document?: string; version?: string; accepted_at?: string };
        Relationships: [
          {
            foreignKeyName: 'terms_acceptances_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          }
        ];
      };
      vagas: {
        Row: {
          id: string;
          autor_id: string;
          autor_nome: string | null;
          titulo: string;
          valor: number | null;
          turno: string | null;
          cidade: string;
          data_servico: string;
          horario: string | null;
          status: string;
          criado_em: string;
          slots: number;
          endereco: string | null;
          duracao: string | null;
          requisitos: string[] | null;
          foto_url: string | null;
          descricao: string | null;
          urgente: boolean;
          impulsionada: boolean;
          sem_contratacao: boolean;
          fotos: string[] | null;
          dias: string | null;
          localizacao: unknown | null;
        };
        Insert: {
          id?: string;
          autor_id: string;
          autor_nome?: string | null;
          titulo: string;
          valor?: number | null;
          turno?: string | null;
          cidade: string;
          data_servico: string;
          horario?: string | null;
          status?: string;
          criado_em?: string;
          slots?: number;
          endereco?: string | null;
          duracao?: string | null;
          requisitos?: string[] | null;
          foto_url?: string | null;
          descricao?: string | null;
          urgente?: boolean;
          impulsionada?: boolean;
          sem_contratacao?: boolean;
          fotos?: string[] | null;
          dias?: string | null;
          localizacao?: unknown | null;
        };
        Update: {
          id?: string;
          autor_id?: string;
          autor_nome?: string | null;
          titulo?: string;
          valor?: number | null;
          turno?: string | null;
          cidade?: string;
          data_servico?: string;
          horario?: string | null;
          status?: string;
          criado_em?: string;
          slots?: number;
          endereco?: string | null;
          duracao?: string | null;
          requisitos?: string[] | null;
          foto_url?: string | null;
          descricao?: string | null;
          urgente?: boolean;
          impulsionada?: boolean;
          sem_contratacao?: boolean;
          fotos?: string[] | null;
          dias?: string | null;
          localizacao?: unknown | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vagas_autor_id_fkey';
            columns: ['autor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      vagas_salvas: {
        Row: { trabalhador_id: string; vaga_id: string; salva_em: string };
        Insert: { trabalhador_id: string; vaga_id: string; salva_em?: string };
        Update: { trabalhador_id?: string; vaga_id?: string; salva_em?: string };
        Relationships: [
          {
            foreignKeyName: 'vagas_salvas_trabalhador_id_fkey';
            columns: ['trabalhador_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vagas_salvas_vaga_id_fkey';
            columns: ['vaga_id'];
            isOneToOne: false;
            referencedRelation: 'vagas';
            referencedColumns: ['id'];
          }
        ];
      };
      whatsapp_verifications: {
        Row: { phone: string; verified_at: string };
        Insert: { phone: string; verified_at?: string };
        Update: { phone?: string; verified_at?: string };
        Relationships: [];
      };
      worker_posts: {
        Row: {
          id: string;
          worker_id: string;
          media_url: string | null;
          media_type: Database['public']['Enums']['media_type'];
          caption: string;
          posted_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          media_url?: string | null;
          media_type?: Database['public']['Enums']['media_type'];
          caption?: string;
          posted_on?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          media_url?: string | null;
          media_type?: Database['public']['Enums']['media_type'];
          caption?: string;
          posted_on?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_posts_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          }
        ];
      };
      workers: {
        Row: {
          id: string;
          name: string;
          initials: string;
          whatsapp: string;
          city: string;
          neighborhood: string | null;
          lat: number;
          lon: number;
          rating: number;
          review_count: number;
          jobs_done: number;
          novo: boolean;
          verified: boolean;
          facts: string[];
          photo_url: string | null;
          cover_url: string | null;
          created_at: string;
          bio: string | null;
          identity_status: string;
          identity_reason: string | null;
          identity_submitted_at: string | null;
          experiences: string[];
        };
        Insert: {
          id?: string;
          name: string;
          initials?: string;
          whatsapp?: string;
          city: string;
          neighborhood?: string | null;
          lat: number;
          lon: number;
          rating?: number;
          review_count?: number;
          jobs_done?: number;
          novo?: boolean;
          verified?: boolean;
          facts?: string[];
          photo_url?: string | null;
          cover_url?: string | null;
          created_at?: string;
          bio?: string | null;
          identity_status?: string;
          identity_reason?: string | null;
          identity_submitted_at?: string | null;
          experiences?: string[];
        };
        Update: {
          id?: string;
          name?: string;
          initials?: string;
          whatsapp?: string;
          city?: string;
          neighborhood?: string | null;
          lat?: number;
          lon?: number;
          rating?: number;
          review_count?: number;
          jobs_done?: number;
          novo?: boolean;
          verified?: boolean;
          facts?: string[];
          photo_url?: string | null;
          cover_url?: string | null;
          created_at?: string;
          bio?: string | null;
          identity_status?: string;
          identity_reason?: string | null;
          identity_submitted_at?: string | null;
          experiences?: string[];
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_terms: { Args: { p_version: string }; Returns: undefined };
      account_from_old_profile: { Args: { p_user_id: string }; Returns: undefined };
      account_history: { Args: { p_account: string }; Returns: Json };
      add_staff_member: { Args: { p_email: string; p_role?: string }; Returns: string };
      admin_actions: {
        Args: { p_limit?: number };
        Returns: {
          id: number;
          staff_email: string;
          action: string;
          target_type: string;
          target_id: string;
          reason: string;
          created_at: string;
        }[];
      };
      admin_company_queue: {
        Args: Record<PropertyKey, never>;
        Returns: {
          company_id: string;
          name: string;
          location: string;
          email: string;
          document: string;
          document_kind: string;
          created_at: string;
          cnpj_check: Json;
        }[];
      };
      admin_decide_company: {
        Args: { p_company: string; p_status: Database['public']['Enums']['company_verification']; p_reason?: string };
        Returns: undefined;
      };
      admin_decide_identity: { Args: { p_worker: string; p_status: string; p_reason?: string }; Returns: undefined };
      admin_hide_job: { Args: { p_job: string; p_reason: string }; Returns: undefined };
      admin_identity_queue: {
        Args: Record<PropertyKey, never>;
        Returns: {
          worker_id: string;
          name: string;
          city: string;
          photo_url: string;
          document: string;
          created_at: string;
          submitted_at: string;
          selfie_path: string;
          document_path: string;
          submissions: number;
        }[];
      };
      admin_report_queue: {
        Args: { p_status?: string };
        Returns: {
          id: string;
          target_type: Database['public']['Enums']['report_target'];
          target_id: string;
          reason: string;
          details: string;
          status: string;
          resolution: string;
          created_at: string;
          resolved_at: string;
          reports_on_target: number;
          target: Json;
          account: Json;
        }[];
      };
      admin_resolve_report: { Args: { p_report: string; p_action: string; p_reason?: string }; Returns: undefined };
      admin_suspend_account: { Args: { p_account: string; p_reason: string }; Returns: undefined };
      admin_unhide_job: { Args: { p_job: string; p_reason?: string }; Returns: undefined };
      admin_unsuspend_account: { Args: { p_account: string; p_reason?: string }; Returns: undefined };
      anonymize_account: {
        Args: { p_account: Database['public']['Tables']['accounts']['Row']; p_reason: string };
        Returns: undefined;
      };
      answer_invite: { Args: { p_job_id: string; p_accept: boolean }; Returns: undefined };
      application_conclude: {
        Args: { p_app_id: string; p_actor: Database['public']['Enums']['application_actor'] };
        Returns: undefined;
      };
      application_next_status: {
        Args: {
          p_action: string;
          p_from: Database['public']['Enums']['application_status'];
          p_actor: Database['public']['Enums']['application_actor'];
        };
        Returns: Database['public']['Enums']['application_status'];
      };
      application_step: {
        Args: {
          p_app_id: string;
          p_action: string;
          p_actor: Database['public']['Enums']['application_actor'];
          p_reason?: string;
        };
        Returns: Database['public']['Tables']['applications']['Row'];
      };
      attach_boost_charge: {
        Args: {
          p_payment_id: string;
          p_provider_payment_id: string;
          p_pix_code: string;
          p_pix_qr_base64: string;
          p_expires_at: string;
          p_card_last4: string;
        };
        Returns: Database['public']['Tables']['boost_payments']['Row'];
      };
      begin_boost_payment: {
        Args: {
          p_account: string;
          p_job_id: string;
          p_plan: Database['public']['Enums']['boost_plan'];
          p_method: Database['public']['Enums']['payment_method'];
        };
        Returns: Database['public']['Tables']['boost_payments']['Row'];
      };
      bicos_today: { Args: Record<PropertyKey, never>; Returns: string };
      block_account: { Args: { p_account: string }; Returns: undefined };
      blocked_between: { Args: { p_a: string; p_b: string }; Returns: boolean };
      boost_blocker: { Args: { p_job: Database['public']['Tables']['jobs']['Row'] }; Returns: string };
      boost_plan_cents: { Args: { p_plan: Database['public']['Enums']['boost_plan'] }; Returns: number };
      boost_plan_hours: { Args: { p_plan: Database['public']['Enums']['boost_plan'] }; Returns: number };
      boostable_job: { Args: { p_job_id: string }; Returns: Database['public']['Tables']['jobs']['Row'] };
      buscar_perfis: {
        Args: { termo?: string };
        Returns: { id: string; nome: string; tipo: string; foto_url: string; biografia: string }[];
      };
      call_storage_cleanup: { Args: Record<PropertyKey, never>; Returns: undefined };
      change_whatsapp: { Args: { p_whatsapp: string }; Returns: Json };
      check_cron_failures: { Args: Record<PropertyKey, never>; Returns: number };
      claim_document_for: { Args: { p_user_id: string; p_digits: string }; Returns: undefined };
      claim_whatsapp_for: { Args: { p_user_id: string; p_phone: string }; Returns: undefined };
      cnpj_valid: { Args: { p_document: string }; Returns: boolean };
      company_cnpj_for_check: { Args: { p_company: string }; Returns: string };
      conclude_finished_jobs: { Args: { p_worker?: string; p_company?: string }; Returns: number };
      conclude_my_finished_jobs: { Args: Record<PropertyKey, never>; Returns: number };
      concluir_candidatura: { Args: { p_candidatura_id: string }; Returns: undefined };
      confirm_boost_payment: {
        Args: { p_payment_id: string };
        Returns: Database['public']['Tables']['boost_payments']['Row'];
      };
      confirm_presence: { Args: { p_job_id: string }; Returns: undefined };
      contato_whatsapp: { Args: { p_candidatura_id: string }; Returns: string };
      cpf_valid: { Args: { p_document: string }; Returns: boolean };
      create_account_for: {
        Args: {
          p_user_id: string;
          p_email: string;
          p_role: Database['public']['Enums']['app_role'];
          p_name: string;
          p_document: string;
          p_whatsapp: string;
          p_terms_version: string;
          p_email_confirmed_at: string;
        };
        Returns: undefined;
      };
      create_my_account: {
        Args: {
          p_role: Database['public']['Enums']['app_role'];
          p_name: string;
          p_document: string;
          p_whatsapp: string;
          p_terms_version: string;
          p_adult: boolean;
          p_contact_name?: string;
        };
        Returns: undefined;
      };
      cron_health: {
        Args: Record<PropertyKey, never>;
        Returns: {
          jobname: string;
          schedule: string;
          active: boolean;
          last_run: string;
          last_status: string;
          failures_in_a_row: number;
          last_error: string;
        }[];
      };
      decidir_candidatura: { Args: { p_candidatura_id: string; p_decisao: string }; Returns: undefined };
      delete_job: { Args: { p_job_id: string }; Returns: undefined };
      delete_job_alert: { Args: Record<PropertyKey, never>; Returns: undefined };
      delete_my_account: { Args: { p_confirm_commitments: boolean }; Returns: undefined };
      delete_push_subscription: { Args: { p_endpoint: string }; Returns: undefined };
      document_available: { Args: { p_document: string }; Returns: boolean };
      document_hash: { Args: { p_document: string }; Returns: string };
      document_login_email: { Args: { p_document: string; p_password: string }; Returns: string };
      document_valid_for: {
        Args: { p_role: Database['public']['Enums']['app_role']; p_document: string };
        Returns: boolean;
      };
      email_verificado: { Args: Record<PropertyKey, never>; Returns: boolean };
      ensure_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      excluir_minha_conta: { Args: Record<PropertyKey, never>; Returns: undefined };
      expirar_vagas_vencidas: { Args: Record<PropertyKey, never>; Returns: undefined };
      expire_pix_payments: { Args: Record<PropertyKey, never>; Returns: number };
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
      exportar_meus_dados: { Args: Record<PropertyKey, never>; Returns: Json };
      fail_boost_payment: {
        Args: { p_payment_id: string; p_status: Database['public']['Enums']['payment_status']; p_detail?: string };
        Returns: Database['public']['Tables']['boost_payments']['Row'];
      };
      fechar_vaga: { Args: { p_vaga_id: string }; Returns: undefined };
      feed_jobs: {
        Args: {
          p_city: string;
          p_uf: string;
          p_lat: number;
          p_lon: number;
          p_radius_km?: number;
          p_oficio?: string;
          p_quando?: string;
          p_search?: string;
          p_all_cities?: boolean;
          p_sort?: string;
          p_limit?: number;
          p_cursor?: Json;
        };
        Returns: Json[];
      };
      finish_sign_up: { Args: { p: Json }; Returns: undefined };
      first_name: { Args: { p_name: string }; Returns: string };
      fold_text: { Args: { p: string }; Returns: string };
      funnel_daily: {
        Args: { p_from: string; p_to: string };
        Returns: {
          dia: string;
          cadastros_iniciados: number;
          emails_confirmados: number;
          cadastros_concluidos: number;
          vagas_publicadas: number;
          candidaturas: number;
          aprovacoes: number;
          contratacoes: number;
          diarias_concluidas: number;
          impulsionamentos_pagos: number;
          receita_centavos: number;
        }[];
      };
      get_contact: { Args: { p_application_id: string }; Returns: { name: string; phone: string }[] };
      get_job_addresses: {
        Args: { p_job_ids: string[] };
        Returns: {
          job_id: string;
          cep: string;
          street: string;
          number: string;
          complement: string;
          neighborhood: string;
          city: string;
          uf: string;
          lat: number;
          lon: number;
        }[];
      };
      get_payment: { Args: { p_payment_id: string }; Returns: Database['public']['Tables']['boost_payments']['Row'] };
      initials_of: { Args: { p_name: string }; Returns: string };
      invite_worker: { Args: { p_job_id: string; p_worker_id: string }; Returns: undefined };
      is_my_job: { Args: { p_job_id: string }; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      job_close_applications: { Args: { p_job: Database['public']['Tables']['jobs']['Row'] }; Returns: undefined };
      job_close_if_team_done: { Args: { p_job_id: string }; Returns: undefined };
      job_extras_from_draft: { Args: { p: Json }; Returns: unknown };
      job_from_draft: {
        Args: { p: Json; p_original_start?: string };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      job_holding: { Args: { p_job_id: string }; Returns: number };
      job_is_open: { Args: { p_job: Database['public']['Tables']['jobs']['Row'] }; Returns: boolean };
      job_last_day: { Args: { p_job: Database['public']['Tables']['jobs']['Row'] }; Returns: string };
      job_reopen_auto_rejected: { Args: { p_job_id: string; p_reason: string }; Returns: number };
      job_runs_on: { Args: { p_job: Database['public']['Tables']['jobs']['Row']; p_day: string }; Returns: boolean };
      job_started: { Args: { p_job: Database['public']['Tables']['jobs']['Row'] }; Returns: boolean };
      job_stats: {
        Args: { p_job_ids: string[] };
        Returns: { job_id: string; holding: number; pending: number; total: number }[];
      };
      job_title: { Args: { p_job: Database['public']['Tables']['jobs']['Row'] }; Returns: string };
      limpar_cadastros_nao_confirmados: { Args: Record<PropertyKey, never>; Returns: undefined };
      mark_whatsapp_verified: { Args: { p_phone: string; p_user?: string }; Returns: undefined };
      mask_document: { Args: { p_digits: string }; Returns: string };
      meu_documento: { Args: Record<PropertyKey, never>; Returns: string };
      meu_tipo: { Args: Record<PropertyKey, never>; Returns: string };
      my_company_id: { Args: Record<PropertyKey, never>; Returns: string };
      my_identity: {
        Args: Record<PropertyKey, never>;
        Returns: { status: string; reason: string; submitted_at: string }[];
      };
      my_job_ids: { Args: Record<PropertyKey, never>; Returns: string[] };
      my_unread_count: { Args: Record<PropertyKey, never>; Returns: number };
      my_worker_id: { Args: Record<PropertyKey, never>; Returns: string };
      new_public_slug: { Args: Record<PropertyKey, never>; Returns: string };
      notification_group: { Args: { p_kind: Database['public']['Enums']['notification_kind'] }; Returns: string };
      notify: {
        Args: {
          p_worker: string;
          p_company: string;
          p_kind: Database['public']['Enums']['notification_kind'];
          p_title: string;
          p_body: string;
          p_target: string;
        };
        Returns: undefined;
      };
      orphan_storage_objects: { Args: { p_limit?: number }; Returns: { bucket: string; name: string }[] };
      own_job_for_update: { Args: { p_job_id: string }; Returns: Database['public']['Tables']['jobs']['Row'] };
      perfil_publico: {
        Args: { p_id: string };
        Returns: {
          id: string;
          nome: string;
          tipo: string;
          foto_url: string;
          capa_url: string;
          biografia: string;
          cargo: string;
          regiao: string;
          especialidades: string[];
          tipo_obra: string;
          regiao_atuacao: string;
          criado_em: string;
          documento: string;
        }[];
      };
      postar_avaliacao: {
        Args: { p_candidatura_id: string; p_nota: number; p_comentario?: string };
        Returns: undefined;
      };
      public_job_card: { Args: { p_slug: string }; Returns: Json };
      publish_job: { Args: { p: Json }; Returns: string };
      purge_auth_attempts: { Args: Record<PropertyKey, never>; Returns: number };
      purge_unconfirmed_signups: { Args: Record<PropertyKey, never>; Returns: number };
      rate_limit_hit: { Args: { p_key: string; p_max: number; p_window: string }; Returns: boolean };
      reiniciar_cadastro_pendente_documento: { Args: { p_documento: string }; Returns: boolean };
      reiniciar_cadastro_pendente_email: { Args: { p_email: string }; Returns: boolean };
      remind_presence: { Args: Record<PropertyKey, never>; Returns: number };
      remove_staff_member: { Args: { p_email: string }; Returns: undefined };
      report_content: {
        Args: {
          p_target_type: Database['public']['Enums']['report_target'];
          p_target_id: string;
          p_reason: string;
          p_details?: string;
        };
        Returns: undefined;
      };
      report_target_info: {
        Args: { p_type: Database['public']['Enums']['report_target']; p_id: string };
        Returns: Json;
      };
      salvar_documento: { Args: { documento_texto: string }; Returns: undefined };
      save_address: { Args: { p_account: string; p: Json }; Returns: undefined };
      save_job_alert: {
        Args: { p_city: string; p_uf: string; p_lat: number; p_lon: number; p_radius_km: number; p_oficio: string };
        Returns: undefined;
      };
      save_notification_prefs: { Args: { p_muted: string[]; p_push: string[] }; Returns: undefined };
      save_push_subscription: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string; p_user_agent: string };
        Returns: undefined;
      };
      scrub_error_text: { Args: { p_text: string }; Returns: string };
      send_sentry_event: { Args: { p_message: string; p_tags: Json }; Returns: boolean };
      session_authenticated_at: { Args: Record<PropertyKey, never>; Returns: string };
      set_company_verification: {
        Args: { p_company: string; p_status: Database['public']['Enums']['company_verification'] };
        Returns: undefined;
      };
      set_identity_status: { Args: { p_worker: string; p_status: string; p_reason?: string }; Returns: undefined };
      set_job_photos: { Args: { p_job_id: string; p_photos: string[] }; Returns: undefined };
      set_my_address: { Args: { p: Json }; Returns: undefined };
      set_my_theme: { Args: { p_theme: string }; Returns: undefined };
      short_datetime_br: { Args: { p_at: string }; Returns: string };
      signup_taken: { Args: { p_kind: string; p_value: string }; Returns: boolean };
      staff_guard: { Args: Record<PropertyKey, never>; Returns: string };
      staff_log: {
        Args: { p_action: string; p_target_type: string; p_target_id: string; p_reason: string };
        Returns: undefined;
      };
      storage_url_ok: { Args: { p_url: string; p_bucket: string; p_owner: string }; Returns: boolean };
      submit_application: { Args: { p_job_id: string }; Returns: undefined };
      submit_identity: {
        Args: { p_selfie_path: string; p_document_path: string; p_consent_version: string };
        Returns: undefined;
      };
      submit_review: {
        Args: {
          p_application_id: string;
          p_direction: Database['public']['Enums']['review_direction'];
          p_value: number;
          p_tags: string[];
          p_comment: string;
        };
        Returns: undefined;
      };
      transition_application: {
        Args: { p_job_id: string; p_worker_id: string; p_action: string; p_reason?: string };
        Returns: undefined;
      };
      unblock_account: { Args: { p_account: string }; Returns: undefined };
      undo_reject: { Args: { p_job_id: string; p_worker_id: string }; Returns: undefined };
      update_job: { Args: { p_job_id: string; p: Json }; Returns: undefined };
      valid_experiences: { Args: { p: string[] }; Returns: boolean };
      whatsapp_recently_verified: { Args: { p_phone: string }; Returns: boolean };
      whatsapp_valid: { Args: { p_phone: string }; Returns: boolean };
      withdraw_application: { Args: { p_job_id: string }; Returns: undefined };
      worker_track_record: {
        Args: { p_worker_ids: string[] };
        Returns: { worker_id: string; faltas: number; desistencias: number }[];
      };
    };
    Enums: {
      app_role: 'trabalhador' | 'recrutador';
      application_actor: 'trabalhador' | 'construtora' | 'sistema';
      application_status:
        | 'enviada'
        | 'em_analise'
        | 'pre_selecionado'
        | 'contratado'
        | 'concluida'
        | 'nao_selecionado'
        | 'desistiu'
        | 'cancelado_pela_construtora'
        | 'nao_compareceu'
        | 'expirada'
        | 'cancelado_pela_equipe';
      boost_plan: '24h' | '3d' | 'whats';
      company_member_role: 'dono' | 'recrutador';
      company_verification: 'pendente' | 'verificada' | 'reprovada';
      dias_semana: 'semana' | 'fimdesemana' | 'qualquer';
      media_type: 'image' | 'video';
      notification_kind:
        | 'novos_candidatos'
        | 'candidatura_em_analise'
        | 'pre_selecionado'
        | 'nao_selecionado'
        | 'contratado'
        | 'desistencia'
        | 'contratacao_cancelada'
        | 'nao_compareceu'
        | 'avaliar_diaria'
        | 'avaliar_trabalhador'
        | 'vaga_editada'
        | 'impulsionamento'
        | 'bico_urgente'
        | 'bico_fechado'
        | 'verificacao'
        | 'bico_novo'
        | 'confirmar_presenca'
        | 'convite';
      payment_method: 'pix' | 'cartao';
      payment_status: 'aguardando' | 'confirmado' | 'recusado' | 'expirado' | 'cancelado' | 'reembolso_pendente';
      report_target: 'vaga' | 'perfil' | 'avaliacao' | 'post';
      review_direction: 'para_construtora' | 'para_trabalhador';
    };
    CompositeTypes: { [_ in never]: never };
  };
};
