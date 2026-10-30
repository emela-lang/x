// Host functions for BunSqlite (sqlite.emel), on `bun:sqlite`. Statements come as JSON
// (`{"text": ..., "params": [...]}`), and each call gives an outcome: `ok` and the result as JSON,
// or the message of the error SQLite threw.
//
// JSON has no bytes, so a BLOB goes both ways as `{"blob": "<hex>"}`: a parameter of that form is
// bound as a Uint8Array, and a BLOB in a row (a Uint8Array from bun:sqlite) is written so. SQLite
// gives no other value that is an object, so the form cannot be mistaken for another value.

import { Database } from "bun:sqlite";

export function open(path) {
  // safeIntegers: integers come back as BigInt, so that no digit is lost on the way to Emela.
  return new Database(path, { create: true, strict: true, safeIntegers: true });
}

export function close(db) {
  db.close();
}

// A row as JSON, by hand: JSON.stringify cannot write a BigInt.
function value(v) {
  if (v === null) return "null";
  if (typeof v === "bigint" || typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (v instanceof Uint8Array) return JSON.stringify({ blob: toHex(v) });
  throw new Error(`bun:sqlite gave a value Emela cannot read: ${typeof v}`);
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

// A parameter as bun:sqlite binds it: `{"blob": "<hex>"}` as a Uint8Array, the others as they are.
const param = (p) => (p !== null && typeof p === "object" && typeof p.blob === "string" ? fromHex(p.blob) : p);

function row(r) {
  return "{" + Object.entries(r).map(([k, v]) => JSON.stringify(k) + ":" + value(v)).join(",") + "}";
}

function outcome(run) {
  try {
    return { ok: true, value: run() };
  } catch (e) {
    return { ok: false, value: String(e?.message ?? e) };
  }
}

const prepare = (db, s) => [db.query(s.text), s.params.map(param)];
const changes = (db, s) => {
  const [statement, params] = prepare(db, s);
  return Number(statement.run(...params).changes);
};

export function query(db, json) {
  return outcome(() => {
    const [statement, params] = prepare(db, JSON.parse(json));
    return "[" + statement.all(...params).map(row).join(",") + "]";
  });
}

export function execute(db, json) {
  return outcome(() => String(changes(db, JSON.parse(json))));
}

export function batch(db, json) {
  return outcome(() => {
    const statements = JSON.parse(json);
    return JSON.stringify(db.transaction(() => statements.map((s) => changes(db, s)))());
  });
}

export const ok = (o) => o.ok;
export const result = (o) => o.value;
