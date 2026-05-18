import { sql, type SQL } from 'drizzle-orm';

/**
 * Drizzle expands a plain JS array in raw SQL templates as scalar params, which
 * is not a valid Postgres uuid[] literal. Build ARRAY[$1::uuid, ...] explicitly.
 */
export function uuidArray(ids: readonly string[]): SQL {
  if (ids.length === 0) return sql`ARRAY[]::uuid[]`;
  return sql`ARRAY[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}]`;
}
