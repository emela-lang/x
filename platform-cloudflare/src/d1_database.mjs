// Host functions for CloudflareD1 (d1_database.emel). Each takes the name of the D1 binding first, and a
// statement or a list of statements as JSON (`{"text": ..., "params": [...]}`), and gives an
// outcome: `ok` and the result as JSON, or the message of the error D1 threw.
//
// JSON has no bytes, so a BLOB goes both ways as `{"blob": "<hex>"}`. A parameter of that form is
// bound as a Uint8Array (D1 takes an ArrayBuffer view as a BLOB). D1 gives a BLOB in a row as an
// array of numbers (`Array.from` of the bytes, https://developers.cloudflare.com/d1/worker-api/),
// and that is written as `{"blob": ...}` too. D1 gives no other value that is an array or an
// object, so neither form can be mistaken for another value.

import { env } from "cloudflare:workers";

function database(binding) {
  const db = env[binding];
  if (db == null || typeof db.prepare !== "function") {
    throw new Error(`no D1 database is bound as \`${binding}\` (add [[d1_databases]] to wrangler.toml)`);
  }
  return db;
}

function toHex(bytes) {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return bytes;
}

// A parameter as D1 binds it: `{"blob": "<hex>"}` as a Uint8Array, the others as they are.
const param = (p) => (p !== null && typeof p === "object" && typeof p.blob === "string" ? fromHex(p.blob) : p);

// A column as Emela reads it: a BLOB (an array of numbers; an ArrayBuffer or a view of one is
// taken too) as `{"blob": "<hex>"}`, the others as they are.
function column(v) {
  if (Array.isArray(v)) return { blob: toHex(v) };
  if (v instanceof ArrayBuffer) return { blob: toHex(new Uint8Array(v)) };
  if (ArrayBuffer.isView(v)) return { blob: toHex(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
  return v;
}

const row = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, column(v)]));

const prepare = (db, s) => db.prepare(s.text).bind(...s.params.map(param));

async function outcome(run) {
  try {
    return { ok: true, value: JSON.stringify(await run()) };
  } catch (e) {
    return { ok: false, value: String(e?.message ?? e) };
  }
}

export function query(binding, json) {
  const db = database(binding);
  return outcome(async () => (await prepare(db, JSON.parse(json)).all()).results.map(row));
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
