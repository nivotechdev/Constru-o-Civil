#!/usr/bin/env node
// X14: writes src/types/database.generated.ts from the database itself (tables, views, foreign keys,
// functions and enums of the `public` schema), in the same layout as `supabase gen types typescript`, so
// the app's types can't drift from the SQL. Run against the local database with every migration applied:
//
//   ./supabase/tests/local/setup.sh
//   DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres npm run gen:types
//
// (With Docker able to pull images, `npx supabase gen types typescript --db-url …` gives the same shape.)
// The CI regenerates it and fails when the committed file is stale.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL (ex.: postgres://postgres:postgres@localhost:54322/postgres).');
  process.exit(2);
}
const out = fileURLToPath(new URL('../src/types/database.generated.ts', import.meta.url));

function query(sql) {
  const r = spawnSync('psql', [url, '-AtX', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout.trim() || 'null') ?? [];
}

// Objects that belong to an extension (PostGIS…) are not the app's.
const notExtension = (oid) => `not exists (select 1 from pg_depend d where d.objid = ${oid} and d.deptype = 'e')`;

const enums = query(`
  select json_agg(json_build_object('name', t.typname, 'values',
    (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)) order by t.typname)
    from pg_type t where t.typnamespace = 'public'::regnamespace and t.typtype = 'e' and ${notExtension('t.oid')}`);

const relations = query(`
  select json_agg(json_build_object(
      'name', c.relname, 'kind', c.relkind,
      'columns', (select json_agg(json_build_object(
          'name', a.attname, 'type', format_type(a.atttypid, null), 'typtype', t.typtype,
          'elem', (select format_type(e.oid, null) from pg_type e where e.oid = t.typelem and t.typcategory = 'A'),
          'elemtyptype', (select e.typtype from pg_type e where e.oid = t.typelem and t.typcategory = 'A'),
          'nullable', not a.attnotnull, 'hasDefault', a.atthasdef or a.attidentity <> '',
          'generated', a.attgenerated = 's' or a.attidentity = 'a') order by a.attnum)
        from pg_attribute a join pg_type t on t.oid = a.atttypid
       where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
      'fks', (select json_agg(json_build_object(
          'name', k.conname,
          'columns', (select json_agg(a.attname order by x.n) from unnest(k.conkey) with ordinality x(attnum, n)
                       join pg_attribute a on a.attrelid = k.conrelid and a.attnum = x.attnum),
          'oneToOne', exists (select 1 from pg_index i where i.indrelid = k.conrelid and i.indisunique
                                and i.indkey::int2[] @> k.conkey and i.indkey::int2[] <@ k.conkey),
          'refTable', r.relname,
          'refColumns', (select json_agg(a.attname order by x.n) from unnest(k.confkey) with ordinality x(attnum, n)
                          join pg_attribute a on a.attrelid = k.confrelid and a.attnum = x.attnum)) order by k.conname)
        from pg_constraint k join pg_class r on r.oid = k.confrelid
       where k.conrelid = c.oid and k.contype = 'f' and r.relnamespace = 'public'::regnamespace)
    ) order by c.relname)
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm') and ${notExtension('c.oid')}`);

const functions = query(`
  select json_agg(json_build_object(
      'name', p.proname, 'set', p.proretset,
      'ret', format_type(p.prorettype, null), 'rettyptype', rt.typtype, 'retrel', rt.typrelid <> 0,
      'args', (select json_agg(json_build_object('name', x.name, 'type', format_type(x.type, null),
                 'typtype', (select typtype from pg_type where oid = x.type),
                 'elem', (select format_type(e.oid, null) from pg_type t join pg_type e on e.oid = t.typelem
                           where t.oid = x.type and t.typcategory = 'A'),
                 'optional', x.n > p.pronargs - p.pronargdefaults) order by x.n)
               from unnest(p.proargnames[1:p.pronargs], p.proargtypes::oid[]) with ordinality x(name, type, n)),
      'table', (select json_agg(json_build_object('name', x.name, 'type', format_type(x.type, null),
                  'typtype', (select typtype from pg_type where oid = x.type),
                  'elem', (select format_type(e.oid, null) from pg_type t join pg_type e on e.oid = t.typelem
                            where t.oid = x.type and t.typcategory = 'A')) order by x.n)
                from unnest(p.proargnames, p.proallargtypes, p.proargmodes) with ordinality x(name, type, mode, n)
               where x.mode = 't')
    ) order by p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_type rt on rt.oid = p.prorettype
   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and ${notExtension('p.oid')}
     and rt.typname not in ('trigger', 'event_trigger')
     and not exists (select 1 from unnest(p.proargtypes::oid[]) a join pg_type t on t.oid = a
                      where t.typname in ('internal'))`);

const enumNames = new Set(enums.map((e) => e.name));
const relNames = new Set(relations.map((r) => r.name));
const strip = (t) => t.replace(/^public\./, '').replace(/^"|"$/g, '');

function tsType(type, typtype) {
  const t = strip(type);
  if (typtype === 'e' || enumNames.has(t)) return `Database['public']['Enums']['${t}']`;
  if (relNames.has(t)) return `Database['public']['Tables']['${t}']['Row']`;
  if (/^(smallint|integer|bigint|real|double precision|numeric)/.test(t)) return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'json' || t === 'jsonb') return 'Json';
  if (t === 'void') return 'undefined';
  if (/^(text|character varying|character|uuid|date|time|timestamp|interval|bytea|inet|citext|name)/.test(t))
    return 'string';
  return 'unknown';
}
const colType = (c) => (c.elem ? `${tsType(c.elem, c.elemtyptype)}[]` : tsType(c.type, c.typtype));
const key = (name) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name}'`);

function table(r) {
  const cols = r.columns ?? [];
  const isView = r.kind === 'v' || r.kind === 'm';
  const row = cols.map((c) => `${key(c.name)}: ${colType(c)}${c.nullable || isView ? ' | null' : ''}`);
  const insert = cols.map((c) =>
    c.generated
      ? `${key(c.name)}?: never`
      : `${key(c.name)}${c.nullable || c.hasDefault ? '?' : ''}: ${colType(c)}${c.nullable ? ' | null' : ''}`
  );
  const update = cols.map((c) =>
    c.generated ? `${key(c.name)}?: never` : `${key(c.name)}?: ${colType(c)}${c.nullable ? ' | null' : ''}`
  );
  const rels = (r.fks ?? []).map(
    (f) =>
      `{ foreignKeyName: '${f.name}'; columns: [${f.columns.map((c) => `'${c}'`).join(', ')}]; isOneToOne: ${f.oneToOne}; ` +
      `referencedRelation: '${f.refTable}'; referencedColumns: [${f.refColumns.map((c) => `'${c}'`).join(', ')}] }`
  );
  const body = [`Row: { ${row.join('; ')} }`];
  if (!isView) body.push(`Insert: { ${insert.join('; ')} }`, `Update: { ${update.join('; ')} }`);
  body.push(`Relationships: [${rels.join(', ')}]`);
  return `${key(r.name)}: { ${body.join('; ')} }`;
}

function fn(f) {
  const args = (f.args ?? []).filter((a) => a.name);
  const argsTs = args.length
    ? `{ ${args.map((a) => `${key(a.name)}${a.optional ? '?' : ''}: ${a.elem ? tsType(a.elem) + '[]' : tsType(a.type, a.typtype)}`).join('; ')} }`
    : 'Record<PropertyKey, never>';
  let ret;
  if (f.table)
    ret = `{ ${f.table.map((c) => `${key(c.name)}: ${c.elem ? tsType(c.elem) + '[]' : tsType(c.type, c.typtype)}`).join('; ')} }[]`;
  else {
    const one = tsType(f.ret, f.rettyptype);
    ret = f.set ? `${one}[]` : one;
  }
  return `{ Args: ${argsTs}; Returns: ${ret} }`;
}

const byName = new Map();
for (const f of functions) byName.set(f.name, [...(byName.get(f.name) ?? []), fn(f)]);

const tables = relations.filter((r) => r.kind === 'r' || r.kind === 'p');
const views = relations.filter((r) => r.kind === 'v' || r.kind === 'm');
const src = `// GERADO por scripts/gen-db-types.mjs a partir do banco (todas as migrations aplicadas). Não edite à mão:
// rode \`npm run gen:types\` (ver o script). Mesmo formato do \`supabase gen types typescript\`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: { ${tables.map(table).join('; ')} };
    Views: { ${views.length ? views.map(table).join('; ') : '[_ in never]: never'} };
    Functions: { ${[...byName].map(([n, sigs]) => `${key(n)}: ${sigs.join(' | ')}`).join('; ')} };
    Enums: { ${enums.map((e) => `${key(e.name)}: ${e.values.map((v) => `'${v}'`).join(' | ')}`).join('; ')} };
    CompositeTypes: { [_ in never]: never };
  };
};
`;
writeFileSync(out, src);
const fmt = spawnSync('npx', ['prettier', '--write', out], { encoding: 'utf8' });
if (fmt.status !== 0) throw new Error(fmt.stderr);
console.log('Gerado:', out);
