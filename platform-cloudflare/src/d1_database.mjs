// Host functions for CloudflareD1 (d1_database.emel). Each takes the name of the D1 binding first, and a
// statement or a list of statements as JSON (`{"text": ..., "params": [...]}`), and gives an
// outcome: `ok` and the result as JSON, or the message of the error D1 threw.

import { env } from "cloudflare:workers";

function database(binding) {
  const db = env[binding];
  if (db == null || typeof db.prepare !== "function") {
    throw new Error(`no D1 database is bound as \`${binding}\` (add [[d1_databases]] to wrangler.toml)`);
  }
  return db;
}

const prepare = (db, s) => db.prepare(s.text).bind(...s.params);

async function outcome(run) {
  try {
    return { ok: true, value: JSON.stringify(await run()) };
  } catch (e) {
    return { ok: false, value: String(e?.message ?? e) };
  }
}

export function query(binding, json) {
  const db = database(binding);
  return outcome(async () => (await prepare(db, JSON.parse(json)).all()).results);
}

export function execute(binding, json) {
  const db = database(binding);
  return outcome(async () => (await prepare(db, JSON.parse(json)).run()).meta.changes);
}

export function batch(binding, json) {
  const db = database(binding);
  const statements = JSON.parse(json).map((s) => prepare(db, s));
  return outcome(async () => (await db.batch(statements)).map((r) => r.meta.changes));
}

export const ok = (o) => o.ok;
export const value = (o) => o.value;
