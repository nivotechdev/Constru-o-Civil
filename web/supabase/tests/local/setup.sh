#!/usr/bin/env bash
# Sobe um Postgres igual ao do Supabase (imagem supabase/postgres) e aplica, em ordem: o que o Auth e o
# Storage criariam (shim.sql), as migrations do app antigo (../../../../supabase/migrations) e as do app
# novo (../../migrations). Depois disso, rode os testes:
#   DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres node supabase/tests/run.mjs supabase/tests/*.sql
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
web="$(cd "$here/../../.." && pwd)"
root="$(cd "$web/.." && pwd)"
port="${PGPORT_LOCAL:-54322}"
docker rm -f bicosdb >/dev/null 2>&1 || true
docker run -d --name bicosdb -e POSTGRES_PASSWORD=postgres -p "$port:5432" supabase/postgres:17.6.1.011 >/dev/null
for _ in $(seq 1 60); do
  PGPASSWORD=postgres psql -h localhost -p "$port" -U postgres -c 'select 1' >/dev/null 2>&1 && break
  sleep 1
done
sleep 3
export PGPASSWORD=postgres PGOPTIONS="-c client_min_messages=warning"
admin="psql -h localhost -p $port -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q"
$admin -f "$here/shim.sql"
for f in "$root"/supabase/migrations/0*.sql "$web"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  $admin -f "$f"
done
echo "Banco local pronto em postgres://postgres:postgres@localhost:$port/postgres"
