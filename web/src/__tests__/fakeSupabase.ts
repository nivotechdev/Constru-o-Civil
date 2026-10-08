// A stand-in for the supabase-js client, for testing services/remote/ without a network: tables answer
// from in-memory rows (with the filters the services use), RPCs and Auth answer what each test sets,
// and every call is recorded so the tests can check what was sent.
type Row = Record<string, unknown>;
type Answer = { data: unknown; error: unknown };

export interface Call {
  kind: 'from' | 'rpc' | 'auth' | 'function' | 'storage';
  name: string;
  /** For tables: the chain of builder calls (["select", "*"], ["eq", "id", "BC-1"], …). */
  ops?: unknown[][];
  args?: unknown;
}

export interface FakeOptions {
  tables?: Record<string, Row[]>;
  rpc?: Record<string, (args: Record<string, unknown>) => Answer | Promise<Answer>>;
  auth?: Partial<Record<string, (...args: unknown[]) => unknown>>;
  functions?: Record<string, (body: unknown) => Answer>;
}

const ok = (data: unknown): Answer => ({ data, error: null });

function applyFilters(rows: Row[], ops: unknown[][]): Row[] {
  let out = rows;
  for (const [op, a, b] of ops) {
    if (op === 'eq') out = out.filter((r) => r[a as string] === b);
    if (op === 'in') out = out.filter((r) => (b as unknown[]).includes(r[a as string]));
    if (op === 'is') out = out.filter((r) => (r[a as string] ?? null) === b);
  }
  return out;
}

export function fakeSupabase(options: FakeOptions = {}) {
  const tables: Record<string, Row[]> = options.tables ?? {};
  const calls: Call[] = [];

  function builder(table: string) {
    const ops: unknown[][] = [];
    const call: Call = { kind: 'from', name: table, ops };
    calls.push(call);
    const answer = (): Answer => {
      const verb = ops.find((o) => ['select', 'insert', 'update', 'delete', 'upsert'].includes(o[0] as string));
      const rows = tables[table] ?? [];
      if (verb?.[0] === 'insert' || verb?.[0] === 'upsert') {
        const values = (Array.isArray(verb[1]) ? verb[1] : [verb[1]]) as Row[];
        tables[table] = [...rows, ...values];
        return ok(null);
      }
      const matched = applyFilters(rows, ops);
      if (verb?.[0] === 'delete') {
        tables[table] = rows.filter((r) => !matched.includes(r));
        return ok(null);
      }
      if (verb?.[0] === 'update') {
        const patch = verb[1] as Row;
        const updated = matched.map((r) => Object.assign(r, patch));
        const single = ops.some((o) => o[0] === 'single');
        return ok(single ? (updated[0] ?? null) : updated);
      }
      if (ops.some((o) => o[0] === 'single')) {
        return matched[0] ? ok(matched[0]) : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      }
      if (ops.some((o) => o[0] === 'maybeSingle')) return ok(matched[0] ?? null);
      return ok(matched);
    };
    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'insert',
      'update',
      'delete',
      'upsert',
      'eq',
      'in',
      'is',
      'or',
      'order',
      'limit',
      'single',
      'maybeSingle'
    ]) {
      chain[m] = (...args: unknown[]) => {
        ops.push([m, ...args]);
        return chain;
      };
    }
    chain.then = (resolve: (a: Answer) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve().then(answer).then(resolve, reject);
    return chain;
  }

  const authDefaults: Record<string, (...args: unknown[]) => unknown> = {
    getSession: () => ({ data: { session: null }, error: null }),
    getUser: () => ({ data: { user: null }, error: null }),
    signOut: () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    setSession: () => ({ data: { user: null, session: null }, error: null }),
    resend: () => ({ data: null, error: null }),
    resetPasswordForEmail: () => ({ data: null, error: null }),
    updateUser: () => ({ data: null, error: null })
  };

  const auth: Record<string, (...args: unknown[]) => unknown> = {};
  for (const [name, fn] of Object.entries({ ...authDefaults, ...options.auth })) {
    auth[name] = async (...args: unknown[]) => {
      calls.push({ kind: 'auth', name, args: args[0] });
      return (fn as (...a: unknown[]) => unknown)(...args);
    };
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ kind: 'rpc', name, args });
      const handler = options.rpc?.[name];
      return Promise.resolve(handler ? handler(args) : ok(null));
    },
    auth,
    functions: {
      invoke: async (name: string, { body }: { body: unknown }) => {
        calls.push({ kind: 'function', name, args: body });
        return options.functions?.[name]?.(body) ?? ok(null);
      }
    },
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: async () => 'ok',
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          calls.push({ kind: 'storage', name: bucket, args: path });
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` }
        }),
        remove: async () => ({ data: null, error: null })
      })
    }
  };

  return { client, calls, tables };
}

/** A Supabase Auth user as the client hands it out. */
export function authUser(id: string, email: string, confirmed = true) {
  return { id, email, email_confirmed_at: confirmed ? '2026-10-01T12:00:00Z' : null, identities: [{ id }] };
}
