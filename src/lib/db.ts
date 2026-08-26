import { neon } from "@neondatabase/serverless";

/**
 * Created on first query, not at module load. Next collects page data at build
 * time, which would otherwise instantiate the client before any environment
 * variable exists and fail the build with a confusing error.
 */
let _sql: any = null;
function client() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add it in the project settings and redeploy.");
    _sql = neon(url);
  }
  return _sql;
}

export const sql: any = (...args: any[]) => client()(...args);

export function money(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
