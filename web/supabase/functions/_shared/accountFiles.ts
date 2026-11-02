// Arquivos que uma conta deixa no Storage: a pasta `<id>/` de cada bucket abaixo. `identidade` (selfie e
// documento) entra aqui para sair NA HORA da exclusão (AUD-001), sem esperar a limpeza diária.
export const ACCOUNT_BUCKETS = ['avatars', 'portfolio', 'vagas', 'identidade'];

/** O mínimo do cliente de Storage que a limpeza usa (deixa o código testável sem Supabase). */
export interface StorageAdmin {
  storage: {
    from(bucket: string): {
      list(
        folder: string,
        options: { limit: number }
      ): PromiseLike<{ data: { id?: string | null; name: string }[] | null; error: unknown }>;
      remove(paths: string[]): PromiseLike<{ error: unknown }>;
    };
  };
}

/** Apaga tudo em `<bucket>/<id>/`, em lotes; devolve quantos arquivos saíram. */
export async function removeFolder(admin: StorageAdmin, bucket: string, id: string): Promise<number> {
  let removed = 0;
  for (let round = 0; round < 50; round++) {
    const { data, error } = await admin.storage.from(bucket).list(id, { limit: 100 });
    if (error) throw error;
    const paths = (data ?? []).filter((f) => f.id).map((f) => `${id}/${f.name}`);
    if (!paths.length) break;
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
    removed += paths.length;
  }
  return removed;
}
