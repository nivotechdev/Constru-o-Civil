// The real, deployed Supabase (Postgres) schema this app talks to, typed in the shape
// `supabase gen types typescript` produces, so `createClient<SupabaseDatabase>()` types every query
// and every `.rpc(...)` call. This mirrors the schema in ../../../supabase/migrations/ (000 through
// 012) — that SQL is the source of truth; keep this file in sync with it, not the other way around.
//
// Two things make this schema different from a typical CRUD table set, and from what
// services/supabaseMappers.ts has to do:
//   - One `profiles` table covers BOTH Company and Worker (see `profiles.tipo`), instead of two
//     separate tables — the mapper reads the same row into whichever domain type the caller needs.
//   - Anything that changes more than one row atomically, or that decides what another user is
//     allowed to see (deciding a candidacy, closing a job, revealing a WhatsApp number, exporting or
//     deleting an account), is an RPC (`Functions` below), not a direct table write. Never write to
//     `candidaturas`/`avaliacoes` status columns from the client — always go through the matching RPC.
//
// Some sensitive columns (`documento_cifrado`, `documento_hash`) are deliberately left out of the
// `profiles` Row type below even though they exist in the table: the app must never select them
// directly (the encrypted document only ever comes back through the `meu_documento` RPC), so leaving
// them untyped turns an accidental `select('*')` misuse into a compile error instead of a data leak.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Tipo = 'pedreiro' | 'construtora';
type VagaStatus = 'aberta' | 'preenchida' | 'expirada';
type CandidaturaStatus =
  | 'enviada'
  | 'em_analise'
  | 'pre_selecionado'
  | 'contratado'
  | 'concluida'
  | 'avaliada'
  | 'nao_selecionado';
type Turno = 'Manhã' | 'Tarde' | 'Noite' | 'Integral';
type Dias = 'semana' | 'fimdesemana' | 'qualquer';
type MidiaTipo = 'imagem' | 'video';

export interface SupabaseDatabase {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          email: string;
          tipo: Tipo | null;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
          foto_url: string | null;
          capa_url: string | null;
          biografia: string | null;
          cargo: string | null;
          regiao: string | null;
          especialidades: string[] | null;
          tipo_obra: string | null;
          regiao_atuacao: string | null;
          whatsapp: string | null;
        };
        Insert: {
          id: string;
          nome: string;
          email: string;
          tipo?: Tipo | null;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
          foto_url?: string | null;
          capa_url?: string | null;
          biografia?: string | null;
          cargo?: string | null;
          regiao?: string | null;
          especialidades?: string[] | null;
          tipo_obra?: string | null;
          regiao_atuacao?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          tipo?: Tipo | null;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
          foto_url?: string | null;
          capa_url?: string | null;
          biografia?: string | null;
          cargo?: string | null;
          regiao?: string | null;
          especialidades?: string[] | null;
          tipo_obra?: string | null;
          regiao_atuacao?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      vagas: {
        Row: {
          id: string;
          autor_id: string;
          autor_nome: string | null;
          titulo: string;
          valor: number | null;
          turno: Turno | null;
          cidade: string;
          data_servico: string;
          horario: string | null;
          status: VagaStatus;
          criado_em: string;
          slots: number;
          endereco: string | null;
          duracao: string | null;
          requisitos: string[] | null;
          foto_url: string | null;
          fotos: string[] | null;
          dias: Dias | null;
          descricao: string | null;
          urgente: boolean;
          impulsionada: boolean;
          sem_contratacao: boolean;
        };
        Insert: {
          id?: string;
          autor_id: string;
          autor_nome?: string | null;
          titulo: string;
          valor?: number | null;
          turno?: Turno | null;
          cidade: string;
          data_servico: string;
          horario?: string | null;
          status?: VagaStatus;
          criado_em?: string;
          slots?: number;
          endereco?: string | null;
          duracao?: string | null;
          requisitos?: string[] | null;
          foto_url?: string | null;
          fotos?: string[] | null;
          dias?: Dias | null;
          descricao?: string | null;
          urgente?: boolean;
          impulsionada?: boolean;
          sem_contratacao?: boolean;
        };
        Update: {
          id?: string;
          autor_id?: string;
          autor_nome?: string | null;
          titulo?: string;
          valor?: number | null;
          turno?: Turno | null;
          cidade?: string;
          data_servico?: string;
          horario?: string | null;
          status?: VagaStatus;
          criado_em?: string;
          slots?: number;
          endereco?: string | null;
          duracao?: string | null;
          requisitos?: string[] | null;
          foto_url?: string | null;
          fotos?: string[] | null;
          dias?: Dias | null;
          descricao?: string | null;
          urgente?: boolean;
          impulsionada?: boolean;
          sem_contratacao?: boolean;
        };
        Relationships: [
          { foreignKeyName: 'vagas_autor_id_fkey'; columns: ['autor_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
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
          status: CandidaturaStatus;
        };
        Insert: {
          id?: string;
          vaga_id: string;
          candidato_id: string;
          nome_candidato: string;
          email_candidato: string;
          candidatado_em?: string;
          status?: CandidaturaStatus;
        };
        Update: {
          id?: string;
          vaga_id?: string;
          candidato_id?: string;
          nome_candidato?: string;
          email_candidato?: string;
          candidatado_em?: string;
          status?: CandidaturaStatus;
        };
        Relationships: [
          { foreignKeyName: 'candidaturas_vaga_id_fkey'; columns: ['vaga_id']; isOneToOne: false; referencedRelation: 'vagas'; referencedColumns: ['id'] },
          { foreignKeyName: 'candidaturas_candidato_id_fkey'; columns: ['candidato_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
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
          { foreignKeyName: 'avaliacoes_candidatura_id_fkey'; columns: ['candidatura_id']; isOneToOne: false; referencedRelation: 'candidaturas'; referencedColumns: ['id'] },
          { foreignKeyName: 'avaliacoes_avaliador_id_fkey'; columns: ['avaliador_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'avaliacoes_avaliado_id_fkey'; columns: ['avaliado_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      consentimentos: {
        Row: {
          id: string;
          usuario_id: string;
          documento: 'termos_de_uso' | 'politica_privacidade';
          versao: string;
          aceito_em: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          documento: 'termos_de_uso' | 'politica_privacidade';
          versao: string;
          aceito_em?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          documento?: 'termos_de_uso' | 'politica_privacidade';
          versao?: string;
          aceito_em?: string;
        };
        Relationships: [
          { foreignKeyName: 'consentimentos_usuario_id_fkey'; columns: ['usuario_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      vagas_salvas: {
        Row: { trabalhador_id: string; vaga_id: string; salva_em: string };
        Insert: { trabalhador_id: string; vaga_id: string; salva_em?: string };
        Update: { trabalhador_id?: string; vaga_id?: string; salva_em?: string };
        Relationships: [
          { foreignKeyName: 'vagas_salvas_trabalhador_id_fkey'; columns: ['trabalhador_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'vagas_salvas_vaga_id_fkey'; columns: ['vaga_id']; isOneToOne: false; referencedRelation: 'vagas'; referencedColumns: ['id'] }
        ];
      };
      publicacoes_trabalhador: {
        Row: {
          id: string;
          trabalhador_id: string;
          midia_url: string;
          midia_tipo: MidiaTipo;
          legenda: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          trabalhador_id: string;
          midia_url: string;
          midia_tipo: MidiaTipo;
          legenda?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          trabalhador_id?: string;
          midia_url?: string;
          midia_tipo?: MidiaTipo;
          legenda?: string | null;
          criado_em?: string;
        };
        Relationships: [
          { foreignKeyName: 'publicacoes_trabalhador_trabalhador_id_fkey'; columns: ['trabalhador_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      perfil_publico: {
        Args: { p_id: string };
        Returns: {
          id: string;
          nome: string;
          tipo: Tipo | null;
          foto_url: string | null;
          capa_url: string | null;
          biografia: string | null;
          cargo: string | null;
          regiao: string | null;
          especialidades: string[] | null;
          tipo_obra: string | null;
          regiao_atuacao: string | null;
          criado_em: string;
          documento: string | null;
        }[];
      };
      buscar_perfis: {
        Args: { termo?: string };
        Returns: { id: string; nome: string; tipo: Tipo | null; foto_url: string | null; biografia: string | null }[];
      };
      contato_whatsapp: { Args: { p_candidatura_id: string }; Returns: string | null };
      decidir_candidatura: { Args: { p_candidatura_id: string; p_decisao: 'aprovado' | 'recusado' }; Returns: undefined };
      fechar_vaga: { Args: { p_vaga_id: string }; Returns: undefined };
      concluir_candidatura: { Args: { p_candidatura_id: string }; Returns: undefined };
      postar_avaliacao: {
        Args: { p_candidatura_id: string; p_nota: number; p_comentario?: string | null };
        Returns: undefined;
      };
      exportar_meus_dados: { Args: Record<string, never>; Returns: Json };
      excluir_minha_conta: { Args: Record<string, never>; Returns: undefined };
      meu_documento: { Args: Record<string, never>; Returns: string | null };
      salvar_documento: { Args: { documento_texto: string }; Returns: undefined };
      reiniciar_cadastro_pendente_email: { Args: { p_email: string }; Returns: boolean };
      reiniciar_cadastro_pendente_documento: { Args: { p_documento: string }; Returns: boolean };
    };
    Enums: {
      tipo_perfil: Tipo;
      status_vaga: VagaStatus;
      status_candidatura: CandidaturaStatus;
      turno_vaga: Turno;
      dias_vaga: Dias;
      midia_tipo: MidiaTipo;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

type PublicSchema = SupabaseDatabase['public'];

/** A table's row as a query returns it. */
export type TableRow<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
/** What an insert accepts (defaults and nullable columns may be left out). */
export type TableInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
/** What an update accepts (any subset of columns). */
export type TableUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
/** An RPC's parameters, as `supabase.rpc(name, args)` expects them. */
export type RpcArgs<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Args'];
/** What an RPC resolves to. */
export type RpcReturns<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Returns'];
